import json
import os
import re
import tempfile
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

try:
    from backend.deps import PLANS, db, require_completed, require_level, require_role
    from backend.music import ITUNES, _get, song_from_itunes
    from backend.weekly import youtube_search_many
    from backend.storage import APP_NAME, get_object, put_object
except ModuleNotFoundError:
    from deps import PLANS, db, require_completed, require_level, require_role
    from music import ITUNES, _get, song_from_itunes
    from weekly import youtube_search_many
    from storage import APP_NAME, get_object, put_object

features_router = APIRouter(prefix="/api")
LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


def now():
    return datetime.now(timezone.utc)


# ---------- AI helpers ----------
async def transcribe(data: bytes, suffix: str, timestamps: bool = False):
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(data)
        tmp.flush()
        with open(tmp.name, "rb") as f:
            stt = OpenAISpeechToText(api_key=LLM_KEY)
            if timestamps:
                return await stt.transcribe(file=f, model="whisper-1", response_format="verbose_json",
                                            timestamp_granularities=["segment"])
            return await stt.transcribe(file=f, model="whisper-1", response_format="json")


async def identify_songs(text: str) -> list:
    chat = LlmChat(api_key=LLM_KEY, session_id=f"identify-{uuid.uuid4()}",
                   system_message="You identify songs from lyric fragments or transcribed singing. "
                                  "Reply ONLY with JSON: {\"songs\": [{\"title\": str, \"artist\": str}]} with up to 3 best guesses, most likely first. "
                                  "Return {\"songs\": []} if you have no reasonable guess.").with_model("openai", "gpt-5.4")
    out = ""
    async for ev in chat.stream_message(UserMessage(text=f"Fragment: \"{text[:600]}\"")):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    match = re.search(r"\{.*\}", out, re.S)
    try:
        return json.loads(match.group(0)).get("songs", [])[:3] if match else []
    except (ValueError, AttributeError):
        return []


def itunes_find(title: str, artist: str) -> Optional[dict]:
    try:
        res = youtube_search_many(f"{artist} {title} official music video", 1)
    except Exception:
        return None
    return {**res[0], "song_title": title, "artist": artist} if res else None


async def guesses_to_songs(guesses: list) -> list:
    songs = []
    for g in guesses:
        s = await run_in_threadpool(itunes_find, g.get("title", ""), g.get("artist", ""))
        if s and s["video_id"] not in {x["video_id"] for x in songs}:
            songs.append(s)
    return songs


def _words(text: str) -> set:
    return set(re.findall(r"[a-z0-9']+", text.lower()))


def align_lyrics(lines: list[str], segments: list[tuple[float, float, str]]) -> list[dict]:
    times: list[Optional[float]] = []
    j = 0
    for line in lines:
        lw, best, best_k = _words(line), 0.0, None
        for k in range(j, min(j + 5, len(segments))):
            sw = _words(segments[k][2])
            score = len(lw & sw) / max(1, len(lw | sw)) if lw else 0
            if score > best:
                best, best_k = score, k
        if best_k is not None and best >= 0.2:
            times.append(segments[best_k][0])
            j = best_k + 1 if best > 0.6 else best_k
        else:
            times.append(None)
    end = segments[-1][1] if segments else 0
    known = [(i, t) for i, t in enumerate(times) if t is not None]
    for i, t in enumerate(times):
        if t is None:
            prev = next(((pi, pt) for pi, pt in reversed(known) if pi < i), (-1, 0.0))
            nxt = next(((ni, nt) for ni, nt in known if ni > i), (len(times), end or len(times) * 4.0))
            times[i] = prev[1] + (nxt[1] - prev[1]) * (i - prev[0]) / (nxt[0] - prev[0])
    return [{"t": round(t, 2), "text": line} for t, line in zip(times, lines)]


async def sync_track_lyrics(track_id: str, data: bytes, ext: str, lyrics: str):
    lines = [l.strip() for l in lyrics.splitlines() if l.strip()]
    try:
        resp = await transcribe(data, f".{ext}", timestamps=True)
        raw = getattr(resp, "segments", None) or []
        segs = [(float(s["start"]), float(s["end"]), s["text"]) if isinstance(s, dict) else (float(s.start), float(s.end), s.text)
                for s in raw]
        synced = align_lyrics(lines, segs)
        await db.tracks.update_one({"id": track_id}, {"$set": {"synced_lyrics": synced, "lyrics_status": "synced"}})
    except Exception:
        fallback = [{"t": i * 4.0, "text": l} for i, l in enumerate(lines)]
        await db.tracks.update_one({"id": track_id}, {"$set": {"synced_lyrics": fallback, "lyrics_status": "unsynced"}})


# ---------- Search ----------
@features_router.get("/search")
async def search(q: str = Query(..., min_length=1, max_length=120), profile: dict = Depends(require_completed)):
    def load():
        try:
            return youtube_search_many(f"{q} official music video", 18)
        except Exception:
            return []
    songs = await run_in_threadpool(load)
    rx = re.compile(re.escape(q), re.I)
    releases = await db.tracks.find({"is_deleted": False, "$or": [{"title": rx}, {"artist_name": rx}, {"lyrics": rx}]},
                                    {"_id": 0, "id": 1, "title": 1, "artist_name": 1, "location": 1, "cover_path": 1}).to_list(10)
    for r in releases:
        r["has_cover"] = bool(r.pop("cover_path", None))
    return {"songs": songs, "releases": releases}


class LyricsQuery(BaseModel):
    text: str = Field(min_length=3, max_length=600)


@features_router.post("/search/lyrics")
async def search_lyrics(body: LyricsQuery, profile: dict = Depends(require_completed)):
    guesses = await identify_songs(body.text)
    return {"heard": body.text, "songs": await guesses_to_songs(guesses)}


@features_router.post("/search/hum")
async def search_hum(audio: UploadFile = File(...), profile: dict = Depends(require_completed)):
    data = await audio.read()
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Recording must be under 10 MB.")
    ext = "webm" if "webm" in (audio.content_type or "") else "mp4" if "mp4" in (audio.content_type or "") else "wav"
    try:
        heard = (await transcribe(data, f".{ext}")).text.strip()
    except Exception:
        raise HTTPException(502, "Couldn't listen to that recording. Please try again.")
    if len(_words(heard)) < 2:
        return {"heard": heard, "songs": [], "message": "We couldn't make out any words. Try singing a line of the lyrics."}
    return {"heard": heard, "songs": await guesses_to_songs(await identify_songs(heard))}


# ---------- Likes, playlists, visits, my comments ----------
class Item(BaseModel):
    kind: Literal["track", "song", "video"]
    ref_id: str = Field(min_length=1, max_length=60)
    title: str = Field(max_length=200)
    artist: str = Field("", max_length=200)
    artwork: str = Field("", max_length=500)
    preview_url: str = Field("", max_length=500)


def item_doc(item: Item) -> dict:
    return {**item.model_dump(), "key": f"{item.kind}:{item.ref_id}"}


@features_router.get("/me/likes")
async def my_likes(profile: dict = Depends(require_completed)):
    return await db.likes.find({"user_id": profile["user_id"]}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(500)


@features_router.post("/me/likes")
async def like(item: Item, profile: dict = Depends(require_completed)):
    doc = item_doc(item)
    await db.likes.update_one({"user_id": profile["user_id"], "key": doc["key"]},
                              {"$setOnInsert": {**doc, "user_id": profile["user_id"], "created_at": now().isoformat()}}, upsert=True)
    return {"ok": True, "key": doc["key"]}


@features_router.delete("/me/likes/{key}")
async def unlike(key: str, profile: dict = Depends(require_completed)):
    await db.likes.delete_one({"user_id": profile["user_id"], "key": key})
    return {"ok": True}


class PlaylistIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


@features_router.get("/me/playlists")
async def my_playlists(profile: dict = Depends(require_completed)):
    return await db.playlists.find({"user_id": profile["user_id"]}, {"_id": 0, "user_id": 0, "cover_path": 0}).sort("created_at", -1).to_list(100)


@features_router.post("/me/playlists")
async def create_playlist(name: str = Form(..., min_length=1, max_length=60), cover: Optional[UploadFile] = File(None),
                          profile: dict = Depends(require_completed)):
    doc = {"id": str(uuid.uuid4()), "user_id": profile["user_id"], "name": name.strip(), "items": [], "created_at": now().isoformat(), "has_cover": False}
    if cover is not None and cover.filename:
        if cover.content_type not in ("image/png", "image/jpeg", "image/webp"):
            raise HTTPException(400, "Cover must be PNG, JPG or WEBP.")
        data = await cover.read()
        if len(data) > 5 * 1024 * 1024:
            raise HTTPException(400, "Cover must be under 5 MB.")
        res = await run_in_threadpool(put_object, f"{APP_NAME}/playlists/{profile['user_id']}/{doc['id']}", data, cover.content_type)
        doc.update(has_cover=True, cover_path=res["path"], cover_type=cover.content_type)
    await db.playlists.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id", "cover_path", "cover_type")}


@features_router.get("/me/playlists/{pid}/cover")
async def playlist_cover(pid: str, profile: dict = Depends(require_completed)):
    pl = await db.playlists.find_one({"id": pid, "user_id": profile["user_id"]}, {"_id": 0})
    if not pl or not pl.get("cover_path"):
        raise HTTPException(404, "No cover")
    data, ctype = await run_in_threadpool(get_object, pl["cover_path"])
    return Response(content=data, media_type=pl.get("cover_type") or ctype)


@features_router.post("/me/playlists/{pid}/items")
async def add_to_playlist(pid: str, item: Item, profile: dict = Depends(require_completed)):
    doc = item_doc(item)
    res = await db.playlists.update_one({"id": pid, "user_id": profile["user_id"], "items.key": {"$ne": doc["key"]}},
                                        {"$push": {"items": doc}})
    if res.matched_count == 0 and not await db.playlists.find_one({"id": pid, "user_id": profile["user_id"]}, {"_id": 1}):
        raise HTTPException(404, "Playlist not found")
    return {"ok": True}


@features_router.delete("/me/playlists/{pid}/items/{key}")
async def remove_from_playlist(pid: str, key: str, profile: dict = Depends(require_completed)):
    await db.playlists.update_one({"id": pid, "user_id": profile["user_id"]}, {"$pull": {"items": {"key": key}}})
    return {"ok": True}


@features_router.delete("/me/playlists/{pid}")
async def delete_playlist(pid: str, profile: dict = Depends(require_completed)):
    await db.playlists.delete_one({"id": pid, "user_id": profile["user_id"]})
    return {"ok": True}


class VisitIn(BaseModel):
    country: str = Field(min_length=1, max_length=80)
    state: str = Field("", max_length=80)


@features_router.post("/me/visits")
async def add_visit(body: VisitIn, profile: dict = Depends(require_completed)):
    await db.visits.insert_one({"user_id": profile["user_id"], "country": body.country, "state": body.state, "at": now()})
    return {"ok": True}


@features_router.get("/me/visits")
async def my_visits(profile: dict = Depends(require_completed)):
    rows = await db.visits.aggregate([
        {"$match": {"user_id": profile["user_id"]}},
        {"$group": {"_id": {"country": "$country", "state": "$state"}, "count": {"$sum": 1}, "last": {"$max": "$at"}}},
        {"$sort": {"count": -1, "last": -1}}, {"$limit": 8}]).to_list(8)
    return [{"country": r["_id"]["country"], "state": r["_id"]["state"], "count": r["count"]} for r in rows]


@features_router.get("/me/comments")
async def my_comments(profile: dict = Depends(require_completed)):
    return await db.comments.find({"user_id": profile["user_id"]}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(100)


# ---------- Settings ----------
DEFAULT_SETTINGS = {"autoplay": True, "explicit": True, "audio_quality": "high", "crossfade": 0, "normalize": True,
                    "notify_releases": True, "notify_comments": True, "notify_email": False, "private_session": False,
                    "show_activity": True, "language": "English"}


@features_router.get("/me/settings")
async def get_settings(profile: dict = Depends(require_completed)):
    return {**DEFAULT_SETTINGS, **(profile.get("settings") or {})}


@features_router.put("/me/settings")
async def put_settings(body: dict, profile: dict = Depends(require_completed)):
    clean = {k: v for k, v in body.items() if k in DEFAULT_SETTINGS and type(v) is type(DEFAULT_SETTINGS[k])}
    merged = {**DEFAULT_SETTINGS, **(profile.get("settings") or {}), **clean}
    await db.profiles.update_one({"user_id": profile["user_id"]}, {"$set": {"settings": merged}})
    return merged


# ---------- Contact feedback ----------
class FeedbackIn(BaseModel):
    topic: str = Field(min_length=1, max_length=60)
    message: str = Field(min_length=3, max_length=2000)


@features_router.post("/feedback")
async def send_feedback(body: FeedbackIn, profile: dict = Depends(require_completed)):
    await db.feedback.insert_one({"id": str(uuid.uuid4()), "user_id": profile["user_id"], "username": profile.get("username", ""),
                                  "email": profile.get("email", ""), "topic": body.topic, "message": body.message.strip(),
                                  "status": "open", "created_at": now().isoformat()})
    return {"ok": True}


# ---------- Plays + Studio analytics ----------
@features_router.post("/tracks/{track_id}/play")
async def record_play(track_id: str, profile: dict = Depends(require_completed)):
    t = await db.tracks.find_one({"id": track_id}, {"_id": 0, "user_id": 1})
    if not t:
        raise HTTPException(404, "Track not found")
    await db.plays.insert_one({"track_id": track_id, "owner_id": t["user_id"], "listener_id": profile["user_id"], "at": now()})
    return {"ok": True}


@features_router.get("/studio/analytics")
async def studio_analytics(period: Literal["week", "month", "year"] = Query("week", alias="range"), profile: dict = Depends(require_level(3))):
    uid = profile["user_id"]
    tracks = await db.tracks.find({"user_id": uid, "is_deleted": False}, {"_id": 0, "id": 1, "title": 1}).to_list(500)
    titles = {t["id"]: t["title"] for t in tracks}
    days = {"week": 7, "month": 30, "year": 365}[period]
    start = now() - timedelta(days=days)
    plays = await db.plays.find({"owner_id": uid, "at": {"$gte": start}}, {"_id": 0}).to_list(50000)
    buckets = 12 if period == "year" else days
    series = [set() for _ in range(buckets)]
    for p in plays:
        at = p["at"] if p["at"].tzinfo else p["at"].replace(tzinfo=timezone.utc)
        idx = min(buckets - 1, int((at - start).total_seconds() / (days * 86400) * buckets))
        series[idx].add(p["listener_id"])
    labels = []
    for i in range(buckets):
        d = start + timedelta(seconds=(i + 1) * days * 86400 / buckets)
        labels.append(d.strftime("%b") if period == "year" else d.strftime("%a") if period == "week" else d.strftime("%-d %b"))
    played = Counter(p["track_id"] for p in plays)
    liked = Counter()
    async for l in db.likes.find({"kind": "track", "ref_id": {"$in": list(titles)}}, {"ref_id": 1}):
        liked[l["ref_id"]] += 1
    return {"range": period, "total_plays": len(plays), "unique_listeners": len({p["listener_id"] for p in plays}),
            "series": [{"label": labels[i], "listeners": len(s)} for i, s in enumerate(series)],
            "most_played": [{"id": k, "title": titles.get(k, "Removed"), "count": c} for k, c in played.most_common(5)],
            "most_liked": [{"id": k, "title": titles.get(k, "Removed"), "count": c} for k, c in liked.most_common(5)]}


# ---------- Admin ----------
@features_router.get("/admin/feedback")
async def admin_feedback(admin: dict = Depends(require_role("admin"))):
    return await db.feedback.find({}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(300)


class FeedbackStatus(BaseModel):
    status: Literal["open", "resolved"]


@features_router.patch("/admin/feedback/{fid}")
async def admin_feedback_status(fid: str, body: FeedbackStatus, admin: dict = Depends(require_role("admin"))):
    if (await db.feedback.update_one({"id": fid}, {"$set": {"status": body.status}})).matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@features_router.get("/admin/subscriptions")
async def admin_subscriptions(admin: dict = Depends(require_role("admin"))):
    rows = await db.profiles.find({}, {"_id": 0, "username": 1, "email": 1, "plan": 1, "subscription_status": 1,
                                        "plan_started_at": 1, "browsing": 1, "user_id": 1}).to_list(2000)
    for r in rows:
        r["plan_name"] = PLANS[r["plan"]]["name"] if r.get("plan") in PLANS else ("Browsing" if r.get("browsing") else "No plan")
    counts = Counter(r["plan_name"] for r in rows)
    mrr = sum(PLANS[r["plan"]]["price"] for r in rows if r.get("plan") in PLANS)
    return {"users": rows, "counts": counts, "monthly_revenue": round(mrr, 2)}


@features_router.get("/admin/tracks")
async def admin_tracks(admin: dict = Depends(require_role("admin"))):
    return await db.tracks.find({}, {"_id": 0, "id": 1, "title": 1, "artist_name": 1, "location": 1, "created_at": 1,
                                     "is_deleted": 1, "release_type": 1, "album_title": 1}).sort("created_at", -1).to_list(500)


class TrackHidden(BaseModel):
    hidden: bool


@features_router.patch("/admin/tracks/{track_id}")
async def admin_track_hide(track_id: str, body: TrackHidden, admin: dict = Depends(require_role("admin"))):
    if (await db.tracks.update_one({"id": track_id}, {"$set": {"is_deleted": body.hidden}})).matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}

import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone

import requests
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

try:
    from backend.deps import db, require_completed
except ModuleNotFoundError:
    from deps import db, require_completed

weekly_router = APIRouter(prefix="/api/music")
_locks: dict = {}
TOP_N = 15
MAX_SHARED = 3
PROMPT = """You are a music chart researcher. Build the "Top Songs" list for "{region}" for this week ({week}).
This list must feel unique to {region} - a listener from a neighbouring place should not get the same list.
Rules for top_songs (25 items, ranked, all real songs that exist):
- About 2/3 by artists born in, raised in, or strongly tied to {region} (current names and local legends), plus regional scenes and sounds big there.
- About 1/3 current songs that are especially popular in {region} right now (local radio, streaming, local scene), not just the national Top 10.
- At most 3 songs that are generic national/global hits.
- Mix eras: include several songs from the last 5 years by artists from {region}, not only classics.
- Accuracy matters most: only say an artist is from {region} if you are certain (check birthplace/hometown); local_tie must be true.
- Do NOT use these songs, already used for other places this week: {avoid}
Artists from {region} according to Wikipedia (use the well-known ones; do not invent): {artists}
Signature local sounds: {heritage}
Return ONLY JSON:
{{"top_songs": [{{"title": str, "artist": str, "genre": str, "local_tie": str (a few words, e.g. "Houston rapper" or "huge on Austin radio")}}],
 "top_genres": [{{"name": str, "description": str (one sentence about this genre in {region}), "songs": [{{"title": str, "artist": str}}] (8 real songs, prefer artists from {region})}}] (5 genres, most popular in {region} first)}}"""


def week_id() -> str:
    y, w, _ = datetime.now(timezone.utc).isocalendar()
    return f"{y}-W{w:02d}"


def song_key(s: dict) -> str:
    return f"{re.sub(r'[^a-z0-9]', '', s.get('artist', '').lower())}|{re.sub(r'[^a-z0-9]', '', s.get('title', '').lower())}"


def wiki_artists(place: str) -> list:
    names: list = []
    for cat in (f"Singers from {place}", f"Rappers from {place}", f"Musical groups from {place}",
                f"Country musicians from {place}", f"Musicians from {place}"):
        try:
            r = requests.get("https://en.wikipedia.org/w/api.php", timeout=8, headers={"User-Agent": "NewMusiq/1.0 (music discovery app)"},
                             params={"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}",
                                     "cmtype": "page", "cmlimit": 120, "format": "json"})
            names += [re.sub(r"\s*\(.*?\)", "", m["title"]) for m in r.json().get("query", {}).get("categorymembers", [])]
        except (requests.RequestException, ValueError):
            continue
    return list(dict.fromkeys(names))[:220]


async def used_elsewhere(region_key: str) -> dict:
    counts: dict = {}
    async for d in db.region_weekly.find({"week": week_id(), "region_key": {"$ne": region_key}}, {"_id": 0, "top_songs": 1}):
        for s in d.get("top_songs", []):
            counts.setdefault(song_key(s), s)
    return counts


async def ask_llm(region: str, region_key: str = "") -> dict:
    try:
        from backend.regional_genres import GENRES, REGIONS
    except ModuleNotFoundError:
        from regional_genres import GENRES, REGIONS
    place = region.split(",")[0].strip()
    artists = await run_in_threadpool(wiki_artists, place)
    used = await used_elsewhere(region_key)
    heritage = "; ".join(f"{GENRES[g][0]} ({', '.join(f'{a} - {t}' for a, t in songs)})" for g, songs in REGIONS.get(region_key, [])) or "n/a"
    avoid = "; ".join(f"{s['artist']} - {s['title']}" for s in list(used.values())[-150:]) or "none"
    text = PROMPT.format(region=region, week=week_id(), avoid=avoid, artists=", ".join(artists) or "n/a", heritage=heritage)
    chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY"), session_id=f"weekly-{uuid.uuid4()}",
                   system_message="You answer with strict JSON only.").with_model("openai", "gpt-5.5")
    out = ""
    async for ev in chat.stream_message(UserMessage(text=text)):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    match = re.search(r"\{.*\}", out, re.S)
    data = json.loads(match.group(0)) if match else {}
    clean = lambda s: {"title": str(s.get("title", ""))[:120], "artist": str(s.get("artist", ""))[:120]}
    top, seen, shared = [], set(), 0
    for s in data.get("top_songs", []):
        k = song_key(s)
        if not s.get("title") or k in seen:
            continue
        if k in used:
            if shared >= MAX_SHARED:
                continue
            shared += 1
        seen.add(k)
        top.append({**clean(s), "genre": str(s.get("genre", ""))[:40], "local_tie": str(s.get("local_tie", ""))[:60]})
    return {
        "top_songs": top[:TOP_N],
        "top_genres": [{"name": str(g.get("name", ""))[:40], "description": str(g.get("description", ""))[:240],
                        "songs": [clean(s) for s in g.get("songs", [])[:10] if s.get("title")]}
                       for g in data.get("top_genres", [])[:6] if g.get("name")],
    }


async def weekly_lists(region_key: str, label: str) -> dict:
    wk = week_id()
    doc = await db.region_weekly.find_one({"region_key": region_key}, {"_id": 0})
    if doc and doc.get("week") == wk:
        return doc
    lock = _locks.setdefault(region_key, asyncio.Lock())
    async with lock:
        doc = await db.region_weekly.find_one({"region_key": region_key}, {"_id": 0})
        if doc and doc.get("week") == wk:
            return doc
        try:
            data = await ask_llm(label, region_key)
        except Exception:
            data = None
        if not data or not data["top_songs"]:
            if doc:
                return doc
            raise HTTPException(502, "This week's lists aren't ready yet. Please try again in a moment.")
        doc = {"region_key": region_key, "week": wk, "updated_at": datetime.now(timezone.utc).isoformat(), **data}
        await db.region_weekly.update_one({"region_key": region_key}, {"$set": doc}, upsert=True)
        return doc


def youtube_search(query: str) -> dict | None:
    key = os.environ.get("YOUTUBE_API_KEY")
    if key:
        r = requests.get("https://www.googleapis.com/youtube/v3/search", timeout=10, params={
            "key": key, "q": query, "part": "snippet", "type": "video", "maxResults": 1, "videoEmbeddable": "true"})
        r.raise_for_status()
        items = r.json().get("items", [])
        return {"video_id": items[0]["id"]["videoId"], "video_title": items[0]["snippet"]["title"]} if items else None
    r = requests.get("https://www.youtube.com/results", params={"search_query": query}, timeout=10,
                     headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9"})
    r.raise_for_status()
    ids = re.findall(r'"videoRenderer":\{"videoId":"([\w-]{11})"', r.text)
    titles = re.findall(r'"videoRenderer":\{"videoId":"[\w-]{11}".*?"title":\{"runs":\[\{"text":"(.*?)"\}', r.text)
    return {"video_id": ids[0], "video_title": titles[0] if titles else query} if ids else None


def _walk(node, out):
    if isinstance(node, dict):
        vr = node.get("videoRenderer")
        if isinstance(vr, dict) and vr.get("videoId"):
            title = "".join(r.get("text", "") for r in vr.get("title", {}).get("runs", []))
            owner = "".join(r.get("text", "") for r in vr.get("ownerText", {}).get("runs", []))
            out.append({"video_id": vr["videoId"], "title": title, "channel": owner})
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)


def youtube_search_many(query: str, limit: int = 15) -> list:
    r = requests.get("https://www.youtube.com/results", params={"search_query": query}, timeout=10,
                     headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9"})
    r.raise_for_status()
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", r.text, re.S)
    out: list = []
    if m:
        try:
            _walk(json.loads(m.group(1)), out)
        except ValueError:
            pass
    seen, res = set(), []
    for v in out:
        if v["video_id"] not in seen:
            seen.add(v["video_id"])
            res.append({**v, "thumbnail": f"https://i.ytimg.com/vi/{v['video_id']}/mqdefault.jpg"})
    return res[:limit]


@weekly_router.get("/video")
async def find_video(artist: str = Query(..., max_length=120), title: str = Query(..., max_length=120),
                     profile: dict = Depends(require_completed)):
    key = f"{artist.lower()}|{title.lower()}"
    hit = await db.yt_cache.find_one({"key": key}, {"_id": 0})
    if hit:
        return hit
    try:
        found = await run_in_threadpool(youtube_search, f"{artist} {title} official music video")
    except requests.RequestException:
        found = None
    if not found:
        raise HTTPException(404, "No video found for this song.")
    doc = {"key": key, **found, "thumbnail": f"https://i.ytimg.com/vi/{found['video_id']}/mqdefault.jpg"}
    await db.yt_cache.update_one({"key": key}, {"$set": doc}, upsert=True)
    return doc

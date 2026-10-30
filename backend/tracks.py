import asyncio
import logging
import os
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Optional

import imageio_ffmpeg
import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

try:
    from backend.deps import db, require_completed, require_level
    from backend.storage import APP_NAME, get_object, put_object
    from backend.features import sync_track_lyrics
except ModuleNotFoundError:
    from deps import db, require_completed, require_level
    from storage import APP_NAME, get_object, put_object
    from features import sync_track_lyrics

tracks_router = APIRouter(prefix="/api/tracks")
logger = logging.getLogger("newmusiq.tracks")
PREVIEW_SECONDS = 15

AUDIO_TYPES = {"audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
               "audio/wave": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac",
               "audio/ogg": "ogg", "audio/flac": "flac", "audio/x-flac": "flac"}
IMAGE_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_AUDIO = 25 * 1024 * 1024
MAX_IMAGE = 5 * 1024 * 1024


class Track(BaseModel):
    id: str
    title: str
    artist_name: str
    location: str
    has_cover: bool
    created_at: str
    mine: bool
    lat: Optional[float] = None
    lon: Optional[float] = None
    featured: str = ""
    release_type: str = "single"
    album_title: str = ""
    has_lyrics: bool = False


def track_out(doc: dict, user_id: str) -> Track:
    return Track(id=doc["id"], title=doc["title"], artist_name=doc["artist_name"], location=doc.get("location", ""),
                 has_cover=bool(doc.get("cover_path")), created_at=doc["created_at"], mine=doc["user_id"] == user_id,
                 lat=doc.get("lat"), lon=doc.get("lon"), featured=doc.get("featured", ""),
                 release_type=doc.get("release_type", "single"), album_title=doc.get("album_title", ""),
                 has_lyrics=bool(doc.get("synced_lyrics") or doc.get("lyrics")))


def geocode(q: str):
    if len(q.strip()) < 2:
        return None, None
    try:
        r = requests.get("https://nominatim.openstreetmap.org/search", params={"format": "jsonv2", "limit": "1", "q": q},
                         headers={"Accept-Language": "en", "User-Agent": "NewMusiq/1.0"}, timeout=10)
        r.raise_for_status()
        m = r.json()
        return (float(m[0]["lat"]), float(m[0]["lon"])) if m else (None, None)
    except (requests.RequestException, ValueError, KeyError):
        return None, None


def make_preview(data: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        src, out = os.path.join(tmp, "in"), os.path.join(tmp, "out.mp3")
        open(src, "wb").write(data)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", src, "-t", str(PREVIEW_SECONDS),
                        "-vn", "-af", f"afade=t=out:st={PREVIEW_SECONDS - 2}:d=2", "-b:a", "128k", out],
                       check=True, timeout=60)
        return open(out, "rb").read()


async def ensure_preview(doc: dict) -> str:
    if doc.get("preview_path"):
        return doc["preview_path"]
    data, _ = await run_in_threadpool(get_object, doc["audio_path"])
    try:
        clip = await run_in_threadpool(make_preview, data)
    except (subprocess.SubprocessError, OSError) as e:
        logger.error(f"Preview failed for {doc['id']}: {e}")
        raise HTTPException(500, "Preview isn't available for this track.")
    path = f"{APP_NAME}/previews/{doc['user_id']}/{doc['id']}.mp3"
    result = await run_in_threadpool(put_object, path, clip, "audio/mpeg")
    await db.tracks.update_one({"id": doc["id"]}, {"$set": {"preview_path": result["path"]}})
    return result["path"]


async def _store(file: UploadFile, types: dict, limit: int, kind: str, user_id: str):
    if file.content_type not in types:
        raise HTTPException(400, f"Unsupported {kind} file type.")
    data = await file.read()
    if not data or len(data) > limit:
        raise HTTPException(400, f"{kind.capitalize()} must be under {limit // (1024 * 1024)} MB.")
    path = f"{APP_NAME}/tracks/{user_id}/{uuid.uuid4()}.{types[file.content_type]}"
    result = await run_in_threadpool(put_object, path, data, file.content_type)
    return result["path"], file.content_type


@tracks_router.post("", response_model=Track)
async def upload_track(
    title: str = Form(...),
    location: str = Form(""),
    featured: str = Form(""),
    lyrics: str = Form(""),
    release_type: str = Form("single"),
    album_title: str = Form(""),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    audio: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    profile: dict = Depends(require_level(3)),
):
    title = title.strip()
    if not title or len(title) > 100:
        raise HTTPException(400, "Give your track a title (max 100 characters).")
    if release_type not in ("single", "album"):
        raise HTTPException(400, "Release type must be single or album.")
    if release_type == "album" and not album_title.strip():
        raise HTTPException(400, "Give the album a title.")
    if len(lyrics) > 20000:
        raise HTTPException(400, "Lyrics are too long.")
    await audio.seek(0)
    audio_bytes = await audio.read()
    await audio.seek(0)
    audio_path, audio_type = await _store(audio, AUDIO_TYPES, MAX_AUDIO, "audio", profile["user_id"])
    doc = {
        "id": str(uuid.uuid4()), "user_id": profile["user_id"],
        "artist_name": profile.get("username") or profile.get("display_name") or "Artist",
        "title": title, "location": location.strip()[:120],
        "audio_path": audio_path, "audio_type": audio_type, "cover_path": None, "cover_type": None,
        "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat(),
        "featured": featured.strip()[:200], "release_type": release_type, "album_title": album_title.strip()[:120],
        "lyrics": lyrics.strip(), "lyrics_status": "processing" if lyrics.strip() else "none", "synced_lyrics": [],
    }
    if cover is not None and cover.filename:
        doc["cover_path"], doc["cover_type"] = await _store(cover, IMAGE_TYPES, MAX_IMAGE, "cover", profile["user_id"])
    glat, glon = await run_in_threadpool(geocode, doc["location"])
    valid = lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180
    doc["lat"], doc["lon"] = (glat, glon) if glat is not None else ((lat, lon) if valid else (None, None))
    await db.tracks.insert_one(doc)
    try:
        await ensure_preview(doc)
    except HTTPException:
        pass
    if doc["lyrics"]:
        asyncio.create_task(sync_track_lyrics(doc["id"], audio_bytes, AUDIO_TYPES[audio_type], doc["lyrics"]))
    return track_out(doc, profile["user_id"])


@tracks_router.get("", response_model=list[Track])
async def list_tracks(profile: dict = Depends(require_completed)):
    docs = await db.tracks.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [track_out(d, profile["user_id"]) for d in docs]


@tracks_router.get("/mine", response_model=list[Track])
async def my_tracks(profile: dict = Depends(require_level(3))):
    docs = await db.tracks.find({"user_id": profile["user_id"], "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [track_out(d, profile["user_id"]) for d in docs]


async def _get(track_id: str) -> dict:
    doc = await db.tracks.find_one({"id": track_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Track not found")
    return doc


@tracks_router.get("/{track_id}/audio")
async def track_audio(track_id: str, profile: dict = Depends(require_level(1))):
    doc = await _get(track_id)
    data, ctype = await run_in_threadpool(get_object, doc["audio_path"])
    return Response(content=data, media_type=doc.get("audio_type") or ctype)


@tracks_router.get("/{track_id}/lyrics")
async def track_lyrics(track_id: str, profile: dict = Depends(require_completed)):
    doc = await _get(track_id)
    return {"status": doc.get("lyrics_status", "none"), "lines": doc.get("synced_lyrics") or []}


@tracks_router.get("/{track_id}/preview")
async def track_preview(track_id: str, profile: dict = Depends(require_completed)):
    doc = await _get(track_id)
    data, _ = await run_in_threadpool(get_object, await ensure_preview(doc))
    return Response(content=data, media_type="audio/mpeg")


@tracks_router.get("/{track_id}/cover")
async def track_cover(track_id: str, profile: dict = Depends(require_completed)):
    doc = await _get(track_id)
    if not doc.get("cover_path"):
        raise HTTPException(404, "No cover")
    data, ctype = await run_in_threadpool(get_object, doc["cover_path"])
    return Response(content=data, media_type=doc.get("cover_type") or ctype,
                    headers={"Cache-Control": "private, max-age=600"})


@tracks_router.delete("/{track_id}")
async def delete_track(track_id: str, profile: dict = Depends(require_level(3))):
    result = await db.tracks.update_one({"id": track_id, "user_id": profile["user_id"], "is_deleted": False},
                                        {"$set": {"is_deleted": True}})
    if result.matched_count == 0:
        raise HTTPException(404, "Track not found")
    return {"ok": True}

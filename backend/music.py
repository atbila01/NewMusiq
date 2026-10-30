import time
from typing import Optional

import pycountry
import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

try:
    from backend.deps import require_completed
    from backend.regional_genres import GENRES, REGIONS
    from backend.weekly import weekly_lists
except ModuleNotFoundError:
    from deps import require_completed
    from regional_genres import GENRES, REGIONS
    from weekly import weekly_lists

music_router = APIRouter(prefix="/api/music")
CHART_URL = "https://rss.marketingtools.apple.com/api/v2/{cc}/music/most-played/25/songs.json"
ITUNES = "https://itunes.apple.com"
_cache: dict = {}
ALIASES = {"Dem. Rep. Congo": "CD", "Congo": "CG", "Central African Rep.": "CF", "Bosnia and Herz.": "BA",
           "Dominican Rep.": "DO", "S. Sudan": "SS", "Eq. Guinea": "GQ", "eSwatini": "SZ", "Solomon Is.": "SB",
           "Côte d'Ivoire": "CI", "Laos": "LA", "Vietnam": "VN", "Russia": "RU", "South Korea": "KR",
           "North Korea": "KP", "Bolivia": "BO", "Venezuela": "VE", "Tanzania": "TZ", "Iran": "IR", "Syria": "SY",
           "Taiwan": "TW", "Moldova": "MD", "Macedonia": "MK", "Turkey": "TR", "Czechia": "CZ"}


def cached(key: str, ttl: int, fn):
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    value = fn()
    empty = not value or (isinstance(value, dict) and "songs" in value and not value["songs"])
    _cache[key] = (time.time() + (60 if empty else ttl), value)
    return value


def country_code(name: str) -> Optional[str]:
    if name in ALIASES:
        return ALIASES[name]
    try:
        return pycountry.countries.lookup(name).alpha_2
    except LookupError:
        try:
            return pycountry.countries.search_fuzzy(name)[0].alpha_2
        except LookupError:
            return None


def _get(url: str, params: dict | None = None):
    r = requests.get(url, params=params, timeout=12, headers={"User-Agent": "NewMusiq/1.0"})
    r.raise_for_status()
    return r.json()


def song_from_itunes(r: dict) -> dict:
    art = (r.get("artworkUrl100") or "").replace("100x100bb", "300x300bb")
    return {"id": str(r.get("trackId")), "title": r.get("trackName", ""), "artist": r.get("artistName", ""),
            "album": r.get("collectionName", ""), "artwork": art, "genre": r.get("primaryGenreName", ""),
            "release_date": (r.get("releaseDate") or "")[:10], "duration_ms": r.get("trackTimeMillis") or 0,
            "preview_url": r.get("previewUrl", ""), "apple_url": r.get("trackViewUrl", "")}


def fetch_chart(cc: str) -> dict:
    def load():
        try:
            feed = _get(CHART_URL.format(cc=cc.lower()))["feed"]
        except (requests.RequestException, KeyError, ValueError):
            return {"updated": "", "songs": []}
        songs = [{"id": r["id"], "title": r["name"], "artist": r["artistName"],
                  "artwork": r.get("artworkUrl100", "").replace("100x100bb", "300x300bb"),
                  "genres": [g["name"] for g in r.get("genres", []) if g.get("name") != "Music"]}
                 for r in feed.get("results", [])]
        return {"updated": feed.get("updated", ""), "songs": songs}
    return cached(f"chart:{cc}", 3600, load)


def top_genres(songs: list) -> list:
    counts: dict = {}
    for s in songs:
        for g in s["genres"][:1]:
            counts[g] = counts.get(g, 0) + 1
    return [{"name": g, "count": c} for g, c in sorted(counts.items(), key=lambda kv: -kv[1])][:8]


@music_router.get("/region")
async def region_insights(country: str = Query(..., max_length=80), state: str = Query("", max_length=80),
                          profile: dict = Depends(require_completed)):
    cc = country_code(country) or country[:20]
    key = f"{cc}:{state}" if state else f"{cc}:"
    heritage = [{"id": gid, "name": GENRES[gid][0]} for gid, _ in REGIONS.get(key, [])]
    label = f"{state}, {country}" if state else country
    weekly = await weekly_lists(key, label)
    return {"name": state or country, "country": country, "country_code": cc, "state": state, "region_key": key,
            "week": weekly["week"], "updated_at": weekly["updated_at"], "top_songs": weekly["top_songs"],
            "top_genres": weekly["top_genres"], "heritage": heritage}


def resolve_song(artist: str, title: Optional[str]) -> Optional[dict]:
    def load():
        term = f"{artist} {title}" if title else artist
        try:
            results = _get(f"{ITUNES}/search", {"term": term, "entity": "song", "limit": 10, "country": "us"})["results"]
        except (requests.RequestException, KeyError, ValueError):
            return None
        a = artist.lower().replace("the ", "")
        ranked = sorted(results, key=lambda r: (a not in r.get("artistName", "").lower(),
                                                bool(title) and title.lower()[:10] not in r.get("trackName", "").lower()))
        return song_from_itunes(ranked[0]) if ranked else None
    return cached(f"song:{artist}:{title}", 86400, load)


@music_router.get("/heritage/{genre_id}")
async def heritage_genre(genre_id: str, region_key: str = Query(..., max_length=100),
                         profile: dict = Depends(require_completed)):
    entry = next((songs for gid, songs in REGIONS.get(region_key, []) if gid == genre_id), None)
    if entry is None:
        raise HTTPException(404, "Genre not found for this region")
    songs = [{"artist": a, "title": t or ""} for a, t in entry]
    name, summary = GENRES[genre_id]
    return {"id": genre_id, "name": name, "summary": summary, "songs": songs}


@music_router.get("/playlist")
async def genre_playlist(genre: str = Query(..., min_length=2, max_length=60), country: str = Query("us", max_length=2),
                         profile: dict = Depends(require_completed)):
    def load():
        try:
            results = _get(f"{ITUNES}/search", {"term": genre, "entity": "song", "limit": 50, "country": country})["results"]
        except (requests.RequestException, KeyError, ValueError):
            return []
        g = genre.lower()
        matching = [r for r in results if g in r.get("primaryGenreName", "").lower()] or results
        seen, out = set(), []
        for r in matching:
            if r.get("previewUrl") and r.get("artistName") not in seen:
                seen.add(r.get("artistName"))
                out.append(song_from_itunes(r))
        return out[:15]
    songs = await run_in_threadpool(cached, f"pl:{country}:{genre}", 21600, load)
    return {"genre": genre, "songs": songs}


@music_router.get("/song/{song_id}")
async def song_detail(song_id: str, country: str = Query("us", max_length=2), profile: dict = Depends(require_completed)):
    if not song_id.isdigit():
        raise HTTPException(400, "Invalid song")

    def load():
        try:
            results = _get(f"{ITUNES}/lookup", {"id": song_id, "country": country})["results"]
            if not results and country != "us":
                results = _get(f"{ITUNES}/lookup", {"id": song_id, "country": "us"})["results"]
        except (requests.RequestException, KeyError, ValueError):
            return None
        return song_from_itunes(results[0]) if results else None
    song = await run_in_threadpool(cached, f"lk:{country}:{song_id}", 86400, load)
    if not song:
        raise HTTPException(404, "Song not found")
    return song

# Iteration 6: weekly AI region lists (top songs/genres), YouTube video lookup, heritage genres
import json
import os
import time

import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def H(name):
    return {"Authorization": f"Bearer {json.load(open(f'/tmp/tok_{name}.json'))['token']}"}


def api(path, who="listener", **kw):
    return requests.get(f"{BASE_URL}/api{path}", headers=H(who) if who else {}, timeout=120, **kw)


TX = {"country": "United States of America", "state": "Texas"}


def test_region_texas_weekly():
    r = api("/music/region", params=TX)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["region_key"] == "US:Texas" and d["week"].count("-W") == 1
    assert len(d["top_songs"]) >= 5
    assert all(s["title"] and s["artist"] and "genre" in s for s in d["top_songs"])
    assert len(d["top_genres"]) >= 3
    assert all(g["name"] and len(g["songs"]) >= 3 for g in d["top_genres"])
    assert isinstance(d["heritage"], list) and any(h["id"] == "conjunto" for h in d["heritage"]), d["heritage"]
    assert "_id" not in d


def test_region_cached_fast():
    t = time.time()
    r = api("/music/region", params=TX)
    assert r.status_code == 200 and time.time() - t < 5


def test_region_unauth():
    assert api("/music/region", who=None, params=TX).status_code == 401


def test_video_lookup():
    r = api("/music/video", params={"artist": "Queen", "title": "Bohemian Rhapsody"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["video_id"]) == 11 and d["video_id"] in d["thumbnail"] and "_id" not in d
    print("VIDEO:", d)


def test_heritage_conjunto():
    r = api("/music/heritage/conjunto", params={"region_key": "US:Texas"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["summary"] and len(d["songs"]) > 0 and all("artist" in s and "title" in s for s in d["songs"])


def test_heritage_404():
    assert api("/music/heritage/nope", params={"region_key": "US:Texas"}).status_code == 404

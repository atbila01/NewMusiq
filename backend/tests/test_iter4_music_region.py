# Iteration 4: region insights, heritage genres, generated playlists, song lookup (/api/music)
import json
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
USA = "United States of America"


def H(name):
    return {"Authorization": f"Bearer {json.load(open(f'/tmp/tok_{name}.json'))['token']}"}


def get(path, who="listener", **params):
    return requests.get(f"{BASE_URL}/api/music{path}", headers=H(who) if who else {}, params=params, timeout=60)


# ---- region ----
def test_region_texas():
    r = get("/region", country=USA, state="Texas")
    assert r.status_code == 200
    d = r.json()
    assert d["name"] == "Texas" and d["country_code"] == "US" and d["region_key"] == "US:Texas"
    assert len(d["top_songs"]) == 25
    assert d["top_genres"] and all(isinstance(g["count"], int) for g in d["top_genres"])
    ids = [h["id"] for h in d["heritage"]]
    assert len(ids) == 9 and ids[0] == "western_swing" and ids[-1] == "conjunto"


@pytest.mark.parametrize("state,n", [("Washington", 4), ("Oregon", 1), ("California", 15), ("Nevada", 1), ("Montana", 1),
                                     ("Utah", 2), ("Arizona", 2), ("Nebraska", 1), ("Oklahoma", 1), ("Kentucky", 0)])
def test_region_us_states_heritage(state, n):
    d = get("/region", country=USA, state=state).json()
    assert len(d["heritage"]) == n


def test_region_japan():
    d = get("/region", country="Japan").json()
    assert d["country_code"] == "JP" and len(d["top_songs"]) > 0 and d["heritage"] == []


def test_region_brazil_no_heritage():
    d = get("/region", country="Brazil").json()
    assert d["country_code"] == "BR" and d["heritage"] == [] and len(d["top_songs"]) > 0


def test_region_unknown_country():
    r = get("/region", country="Atlantis Nowhere")
    assert r.status_code == 200, r.text
    print(r.json()["country_code"], len(r.json()["top_songs"]))


def test_region_browsing_user_ok():
    assert get("/region", who="newbie", country="Japan").status_code == 200


# ---- heritage ----
def test_heritage_grunge():
    r = get("/heritage/grunge", region_key="US:Washington")
    assert r.status_code == 200
    d = r.json()
    assert d["name"] == "Grunge" and d["summary"].startswith("Grunge emerged in Seattle")
    assert len(d["songs"]) == 2 and all(s["preview_url"] for s in d["songs"])
    print([(s["artist"], s["title"]) for s in d["songs"]])


def test_heritage_conjunto_texas():
    d = get("/heritage/conjunto", region_key="US:Texas").json()
    assert d["name"] == "Conjunto" and len(d["songs"]) >= 1
    print([(s["artist"], s["title"]) for s in d["songs"]])


def test_heritage_wrong_region_404():
    assert get("/heritage/grunge", region_key="US:Texas").status_code == 404
    assert get("/heritage/nope", region_key="US:Washington").status_code == 404


# ---- playlist / song ----
def test_playlist_country():
    d = get("/playlist", genre="Country", country="us").json()
    assert 0 < len(d["songs"]) <= 15 and all(s["preview_url"] for s in d["songs"])
    assert len({s["artist"] for s in d["songs"]}) == len(d["songs"])


def test_playlist_hiphop_slash_genre():
    d = get("/playlist", genre="Hip-Hop/Rap", country="us").json()
    assert len(d["songs"]) > 0


def test_song_detail():
    r = get("/song/1440859107")
    assert r.status_code == 200
    d = r.json()
    assert d["title"] == "Heart-Shaped Box" and d["artist"] == "Nirvana" and d["preview_url"]


def test_song_invalid_and_missing():
    assert get("/song/abc").status_code == 400
    assert get("/song/1").status_code == 404


# ---- auth ----
@pytest.mark.parametrize("path,params", [("/region", {"country": "Japan"}), ("/heritage/grunge", {"region_key": "US:Washington"}),
                                         ("/playlist", {"genre": "Pop"}), ("/song/1440859107", {})])
def test_music_requires_auth(path, params):
    assert get(path, who=None, **params).status_code == 401

# Iteration 5: search (text/lyrics/hum), library (likes/playlists/visits/comments), settings, feedback, admin, studio uploads + analytics
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
AUDIO = "/app/tests/fixtures/test_track.mp3"
SPEECH = "/tmp/s.mp3" if os.path.exists("/tmp/s.mp3") else AUDIO


def H(name):
    return {"Authorization": f"Bearer {json.load(open(f'/tmp/tok_{name}.json'))['token']}"}


def api(method, path, who="listener", **kw):
    return requests.request(method, f"{BASE_URL}/api{path}", headers=H(who) if who else {}, timeout=90, **kw)


# ---- Search ----
def test_search_text():
    r = api("GET", "/search", params={"q": "hello"})
    assert r.status_code == 200
    d = r.json()
    assert len(d["songs"]) > 0 and "releases" in d
    assert {"id", "title"} <= set(d["songs"][0])


def test_search_unauth():
    assert api("GET", "/search", who=None, params={"q": "hello"}).status_code == 401


def test_search_lyrics_bohemian():
    r = api("POST", "/search/lyrics", json={"text": "is this the real life is this just fantasy"})
    assert r.status_code == 200
    titles = [s["title"].lower() for s in r.json()["songs"]]
    assert any("bohemian" in t for t in titles), titles


def test_search_lyrics_validation():
    assert api("POST", "/search/lyrics", json={"text": "a"}).status_code == 422


def test_search_hum():
    with open(SPEECH, "rb") as f:
        r = api("POST", "/search/hum", files={"audio": ("rec.mp3", f, "audio/mp4")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "heard" in d and ("songs" in d)
    print("HUM:", d.get("heard"), [s["title"] for s in d["songs"]], d.get("message"))


# ---- Likes ----
ITEM = {"kind": "song", "ref_id": "TEST_999", "title": "TEST Song", "artist": "TEST Artist", "artwork": "", "preview_url": ""}


def test_likes_crud():
    assert api("POST", "/me/likes", json=ITEM).json()["key"] == "song:TEST_999"
    api("POST", "/me/likes", json=ITEM)  # idempotent
    likes = api("GET", "/me/likes").json()
    assert [l["key"] for l in likes].count("song:TEST_999") == 1
    assert api("DELETE", "/me/likes/song:TEST_999").status_code == 200
    assert "song:TEST_999" not in [l["key"] for l in api("GET", "/me/likes").json()]


def test_likes_bad_kind():
    assert api("POST", "/me/likes", json={**ITEM, "kind": "x"}).status_code == 422


# ---- Playlists ----
def test_playlists_crud():
    p = api("POST", "/me/playlists", json={"name": "TEST_pl"}).json()
    pid = p["id"]
    assert p["name"] == "TEST_pl" and p["items"] == []
    assert api("POST", f"/me/playlists/{pid}/items", json=ITEM).status_code == 200
    api("POST", f"/me/playlists/{pid}/items", json=ITEM)
    pl = next(x for x in api("GET", "/me/playlists").json() if x["id"] == pid)
    assert len(pl["items"]) == 1
    api("DELETE", f"/me/playlists/{pid}/items/song:TEST_999")
    pl = next(x for x in api("GET", "/me/playlists").json() if x["id"] == pid)
    assert pl["items"] == []
    assert api("POST", "/me/playlists/nope/items", json=ITEM).status_code == 404
    api("DELETE", f"/me/playlists/{pid}")
    assert pid not in [x["id"] for x in api("GET", "/me/playlists").json()]


def test_playlist_empty_name():
    assert api("POST", "/me/playlists", json={"name": ""}).status_code == 422


# ---- Visits / comments ----
def test_visits():
    assert api("POST", "/me/visits", json={"country": "Japan", "state": ""}).status_code == 200
    v = api("GET", "/me/visits").json()
    assert any(x["country"] == "Japan" for x in v)


def test_my_comments():
    r = api("GET", "/me/comments")
    assert r.status_code == 200 and isinstance(r.json(), list)
    assert all("_id" not in c and "user_id" not in c for c in r.json())


# ---- Settings ----
def test_settings_put_get():
    orig = api("GET", "/me/settings").json()
    r = api("PUT", "/me/settings", json={"autoplay": not orig["autoplay"], "bogus": 1, "crossfade": "abc"})
    d = r.json()
    assert d["autoplay"] == (not orig["autoplay"]) and "bogus" not in d and d["crossfade"] == orig["crossfade"]
    assert api("GET", "/me/settings").json()["autoplay"] == (not orig["autoplay"])
    api("PUT", "/me/settings", json={"autoplay": orig["autoplay"]})


def test_settings_non_dict_body():
    r = api("PUT", "/me/settings", json=[1, 2])
    assert r.status_code in (400, 422), r.status_code


# ---- Feedback + admin ----
def test_feedback_and_admin():
    msg = f"TEST_feedback {time.time()}"
    assert api("POST", "/feedback", who="newbie", json={"topic": "Bug", "message": msg}).status_code == 200
    fb = api("GET", "/admin/feedback").json()
    row = next(f for f in fb if f["message"] == msg)
    assert row["status"] == "open" and row["username"] == "newbie"
    assert api("PATCH", f"/admin/feedback/{row['id']}", json={"status": "resolved"}).status_code == 200
    assert next(f for f in api("GET", "/admin/feedback").json() if f["id"] == row["id"])["status"] == "resolved"
    assert api("PATCH", f"/admin/feedback/{row['id']}", json={"status": "zzz"}).status_code == 422


def test_admin_subscriptions():
    d = api("GET", "/admin/subscriptions").json()
    assert isinstance(d["users"], list) and isinstance(d["counts"], dict) and isinstance(d["monthly_revenue"], (int, float))
    assert all("_id" not in u for u in d["users"])


@pytest.mark.parametrize("m,p,body", [("GET", "/admin/feedback", None), ("PATCH", "/admin/feedback/x", {"status": "open"}),
                                      ("GET", "/admin/subscriptions", None), ("GET", "/admin/tracks", None),
                                      ("PATCH", "/admin/tracks/x", {"hidden": True})])
def test_admin_forbidden_newbie(m, p, body):
    assert api(m, p, who="newbie", json=body).status_code == 403


# ---- Studio ----
@pytest.fixture(scope="module")
def album_track():
    with open(AUDIO, "rb") as f:
        r = api("POST", "/tracks", data={"title": "TEST_album_song", "location": "", "featured": "TEST Feat",
                                          "release_type": "album", "album_title": "TEST Album",
                                          "lyrics": "line one here\nline two here\nline three"},
                files={"audio": ("t.mp3", f, "audio/mpeg")})
    assert r.status_code == 200, r.text
    yield r.json()
    api("DELETE", f"/tracks/{r.json()['id']}")


def test_upload_album_fields(album_track):
    t = album_track
    assert t["release_type"] == "album" and t["album_title"] == "TEST Album" and t["featured"] == "TEST Feat" and t["has_lyrics"]


def test_upload_album_no_title():
    with open(AUDIO, "rb") as f:
        r = api("POST", "/tracks", data={"title": "TEST_x", "release_type": "album"}, files={"audio": ("t.mp3", f, "audio/mpeg")})
    assert r.status_code == 400


def test_upload_non_artist():
    with open(AUDIO, "rb") as f:
        r = api("POST", "/tracks", who="newbie", data={"title": "TEST_x"}, files={"audio": ("t.mp3", f, "audio/mpeg")})
    assert r.status_code == 403


def test_lyrics_sync(album_track):
    st = None
    for _ in range(12):
        d = api("GET", f"/tracks/{album_track['id']}/lyrics").json()
        st = d["status"]
        if st in ("synced", "unsynced"):
            break
        time.sleep(2.5)
    assert st in ("synced", "unsynced"), st
    assert [l["text"] for l in d["lines"]] == ["line one here", "line two here", "line three"]
    ts = [l["t"] for l in d["lines"]]
    assert ts == sorted(ts), ts
    print("LYRICS:", st, ts)


@pytest.mark.parametrize("rng,n", [("week", 7), ("month", 30), ("year", 12)])
def test_analytics(album_track, rng, n):
    assert api("POST", f"/tracks/{album_track['id']}/play", who="newbie").status_code == 200
    d = api("GET", "/studio/analytics", params={"range": rng}).json()
    assert len(d["series"]) == n and d["total_plays"] >= 1
    assert any(m["id"] == album_track["id"] for m in d["most_played"])
    assert "most_liked" in d and d["series"][-1]["listeners"] >= 1


def test_analytics_non_artist():
    assert api("GET", "/studio/analytics", who="newbie").status_code == 403


def test_play_404():
    assert api("POST", "/tracks/nope/play").status_code == 404


def test_admin_tracks_hide(album_track):
    rows = api("GET", "/admin/tracks").json()
    assert any(r["id"] == album_track["id"] for r in rows)
    api("PATCH", f"/admin/tracks/{album_track['id']}", json={"hidden": True})
    assert album_track["id"] not in [t["id"] for t in api("GET", "/tracks").json()]
    api("PATCH", f"/admin/tracks/{album_track['id']}", json={"hidden": False})
    assert album_track["id"] in [t["id"] for t in api("GET", "/tracks").json()]

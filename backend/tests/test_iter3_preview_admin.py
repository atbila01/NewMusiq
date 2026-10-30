# Iteration 3: previews, geocoded uploads, roles/admin comment moderation, users/roles
import json
import os
import subprocess

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def tok(name):
    return json.load(open(f"/tmp/tok_{name}.json"))


def H(name):
    return {"Authorization": f"Bearer {tok(name)['token']}"}


@pytest.fixture(scope="module", autouse=True)
def setup_pro():
    # prouser1: complete profile + set plan pro
    r = requests.put(f"{BASE_URL}/api/me", headers=H("prouser1"),
                     data={"username": "TEST_prouser1", "country": "US", "state": "KY", "zip_code": "40502"})
    assert r.status_code == 200, r.text
    uid = tok("prouser1")["user_id"]
    subprocess.run(["mongosh", "newmusiq", "--quiet", "--eval",
                    f'db.profiles.updateOne({{user_id:"{uid}"}},{{$set:{{plan:"pro"}}}})'], check=True)
    yield


# ---- tracks / previews ----
def test_browsing_lists_tracks_with_latlon():
    r = requests.get(f"{BASE_URL}/api/tracks", headers=H("newbie"))
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert any(t["lat"] is not None and t["lon"] is not None for t in data)


def _track_id():
    data = requests.get(f"{BASE_URL}/api/tracks", headers=H("newbie")).json()
    return next(t["id"] for t in data if t["title"] == "Desert Echo")


def test_browsing_preview_ok():
    r = requests.get(f"{BASE_URL}/api/tracks/{_track_id()}/preview", headers=H("newbie"))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/mpeg")
    open("/tmp/prev.mp3", "wb").write(r.content)
    ff = subprocess.run(["/root/.venv/bin/python", "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
                        capture_output=True, text=True).stdout.strip()
    out = subprocess.run([ff, "-i", "/tmp/prev.mp3"], capture_output=True, text=True).stderr
    dur = out.split("Duration: ")[1].split(",")[0]
    h, m, s = dur.split(":")
    secs = int(h) * 3600 + int(m) * 60 + float(s)
    print("preview duration", secs)
    assert 13 <= secs <= 16.5


def test_browsing_audio_forbidden():
    r = requests.get(f"{BASE_URL}/api/tracks/{_track_id()}/audio", headers=H("newbie"))
    assert r.status_code == 403


def test_subscriber_audio_ok():
    r = requests.get(f"{BASE_URL}/api/tracks/{_track_id()}/audio", headers=H("prouser1"))
    assert r.status_code == 200
    assert len(r.content) > 1000


def test_preview_unauth_401():
    r = requests.get(f"{BASE_URL}/api/tracks/{_track_id()}/preview")
    assert r.status_code == 401


def test_artist_upload_geocodes_and_previews():
    ff = subprocess.run(["/root/.venv/bin/python", "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
                        capture_output=True, text=True).stdout.strip()
    subprocess.run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=30", "/tmp/t.mp3"], check=True)
    with open("/tmp/t.mp3", "rb") as f:
        r = requests.post(f"{BASE_URL}/api/tracks", headers=H("listener"),
                          data={"title": "TEST_Iter3_Lagos", "location": "Lagos, Nigeria"},
                          files={"audio": ("t.mp3", f, "audio/mpeg")}, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["lat"] is not None and 5 < d["lat"] < 8 and 2 < d["lon"] < 5
    out = subprocess.run(["mongosh", "newmusiq", "--quiet", "--eval",
                          f'print(db.tracks.findOne({{id:"{d["id"]}"}}).preview_path || "")'], capture_output=True, text=True).stdout
    assert "previews" in out
    # cleanup
    assert requests.delete(f"{BASE_URL}/api/tracks/{d['id']}", headers=H("listener")).status_code == 200


# ---- roles / admin ----
def test_role_admin():
    r = requests.get(f"{BASE_URL}/api/me/role", headers=H("listener"))
    assert r.status_code == 200 and r.json()["role"] == "admin"


def test_role_member():
    for n in ("newbie", "prouser1"):
        r = requests.get(f"{BASE_URL}/api/me/role", headers=H(n))
        assert r.status_code == 200 and r.json()["role"] == "member"


def test_admin_comments_member_forbidden():
    assert requests.get(f"{BASE_URL}/api/admin/comments", headers=H("prouser1")).status_code == 403
    assert requests.patch(f"{BASE_URL}/api/admin/comments/x", json={"status": "approved"}, headers=H("prouser1")).status_code == 403
    assert requests.get(f"{BASE_URL}/api/users", headers=H("prouser1")).status_code == 403


def test_admin_comments_invalid_status():
    r = requests.get(f"{BASE_URL}/api/admin/comments?status=bogus", headers=H("listener"))
    assert r.status_code == 422


def test_moderation_flow():
    # pro user posts comment -> pending, admin sees in pending; another user doesn't see it
    msg = "TEST_iter3 comment moderation"
    r = requests.post(f"{BASE_URL}/api/comments", json={"message": msg}, headers=H("prouser1"))
    assert r.status_code == 200 and r.json()["pending"] is True
    cid = r.json()["id"]
    pend = requests.get(f"{BASE_URL}/api/admin/comments?status=pending", headers=H("listener")).json()
    assert any(c["id"] == cid for c in pend)
    assert all("user_id" not in c and "_id" not in c for c in pend)
    seen = requests.get(f"{BASE_URL}/api/comments", headers=H("listener")).json()
    assert not any(c["id"] == cid for c in seen)
    # approve
    r = requests.patch(f"{BASE_URL}/api/admin/comments/{cid}", json={"status": "approved"}, headers=H("listener"))
    assert r.status_code == 200 and r.json()["status"] == "approved"
    seen = requests.get(f"{BASE_URL}/api/comments", headers=H("listener")).json()
    assert any(c["id"] == cid and c["pending"] is False for c in seen)
    appr = requests.get(f"{BASE_URL}/api/admin/comments?status=approved", headers=H("listener")).json()
    assert any(c["id"] == cid for c in appr)
    # hide
    r = requests.patch(f"{BASE_URL}/api/admin/comments/{cid}", json={"status": "hidden"}, headers=H("listener"))
    assert r.status_code == 200
    seen = requests.get(f"{BASE_URL}/api/comments", headers=H("listener")).json()
    assert not any(c["id"] == cid for c in seen)
    seen_own = requests.get(f"{BASE_URL}/api/comments", headers=H("prouser1")).json()
    assert not any(c["id"] == cid for c in seen_own)
    hid = requests.get(f"{BASE_URL}/api/admin/comments?status=hidden", headers=H("listener")).json()
    assert any(c["id"] == cid for c in hid)


def test_moderate_missing_404_and_bad_status():
    assert requests.patch(f"{BASE_URL}/api/admin/comments/nope", json={"status": "approved"}, headers=H("listener")).status_code == 404
    assert requests.patch(f"{BASE_URL}/api/admin/comments/nope", json={"status": "bad"}, headers=H("listener")).status_code == 422


def test_users_list_admin():
    r = requests.get(f"{BASE_URL}/api/users", headers=H("listener"))
    assert r.status_code == 200
    d = r.json()
    assert d["roles"] == ["admin", "member"]
    me = next(u for u in d["users"] if u["user_id"] == tok("listener")["user_id"])
    assert me["role"] == "admin" and me["username"] == "alexmorgan"
    assert all("_id" not in u for u in d["users"])


def test_cannot_demote_last_admin():
    r = requests.patch(f"{BASE_URL}/api/users/{tok('listener')['user_id']}/role", json={"role": "member"}, headers=H("listener"))
    assert r.status_code == 409


def test_role_change_member_roundtrip():
    uid = tok("prouser1")["user_id"]
    r = requests.patch(f"{BASE_URL}/api/users/{uid}/role", json={"role": "admin"}, headers=H("listener"))
    assert r.status_code == 200
    assert requests.get(f"{BASE_URL}/api/me/role", headers=H("prouser1")).json()["role"] == "admin"
    r = requests.patch(f"{BASE_URL}/api/users/{uid}/role", json={"role": "member"}, headers=H("listener"))
    assert r.status_code == 200
    assert requests.get(f"{BASE_URL}/api/me/role", headers=H("prouser1")).json()["role"] == "member"


def test_role_invalid_and_missing():
    uid = tok("prouser1")["user_id"]
    assert requests.patch(f"{BASE_URL}/api/users/{uid}/role", json={"role": "superuser"}, headers=H("listener")).status_code == 403
    assert requests.patch(f"{BASE_URL}/api/users/nobody/role", json={"role": "member"}, headers=H("listener")).status_code == 404

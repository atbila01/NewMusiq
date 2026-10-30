# NewMusiq API regression tests: profile (/api/me), photo, comments visibility, geo search
import io
import json
import os
import subprocess
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c6360f8cfc0f01f0005000201a5f6450a0000000049454e44ae426082"
)


def make_user(email):
    out = subprocess.check_output(["/root/.venv/bin/python", "/app/scripts/clerk_test_user.py", email])
    return json.loads(out)


@pytest.fixture(scope="module")
def user_a():
    return make_user("t1usera+clerk_test@example.com")


@pytest.fixture(scope="module")
def user_b():
    return make_user("t1userb+clerk_test@example.com")


@pytest.fixture(scope="module")
def user_new():
    # fresh user without profile / photo
    return make_user(f"t1new{uuid.uuid4().hex[:6]}+clerk_test@example.com")


def H(u):
    return {"Authorization": f"Bearer {u['token']}"}


def profile_form(name="TEST_UserA"):
    return {"username": name, "country": "USA", "state": "CA", "zip_code": "94016"}


# Auth on /api/me
def test_me_requires_token():
    r = requests.get(f"{BASE_URL}/api/me")
    assert r.status_code == 401


def test_me_with_token(user_new):
    r = requests.get(f"{BASE_URL}/api/me", headers=H(user_new))
    assert r.status_code == 200
    d = r.json()
    assert d["user_id"] == user_new["user_id"]
    assert d["completed"] is False
    assert "_id" not in d


# Profile save
def test_put_me_missing_field(user_a):
    r = requests.put(f"{BASE_URL}/api/me", headers=H(user_a),
                     data={"username": "XYZ", "country": "", "state": "CA", "zip_code": "1"})
    assert r.status_code in (400, 422)


def test_put_me_wrong_photo_type(user_a):
    r = requests.put(f"{BASE_URL}/api/me", headers=H(user_a), data=profile_form(),
                     files={"photo": ("a.gif", b"GIF89a....", "image/gif")})
    assert r.status_code == 400


def test_put_me_with_photo_and_get_photo(user_a):
    r = requests.put(f"{BASE_URL}/api/me", headers=H(user_a), data=profile_form(),
                     files={"photo": ("a.png", io.BytesIO(PNG), "image/png")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["completed"] is True and d["has_photo"] is True
    assert d["username"] == "TEST_UserA"
    g = requests.get(f"{BASE_URL}/api/me", headers=H(user_a)).json()
    assert g["completed"] is True and g["zip_code"] == "94016"
    p = requests.get(f"{BASE_URL}/api/me/photo", headers=H(user_a))
    assert p.status_code == 200
    assert p.headers["content-type"].startswith("image/png")
    assert p.content == PNG


def test_photo_404_for_new_user(user_new):
    r = requests.get(f"{BASE_URL}/api/me/photo", headers=H(user_new))
    assert r.status_code == 404


def test_put_me_without_photo_keeps_photo(user_a):
    r = requests.put(f"{BASE_URL}/api/me", headers=H(user_a), data=profile_form("TEST_UserA2"))
    assert r.status_code == 200
    assert r.json()["has_photo"] is True
    assert r.json()["username"] == "TEST_UserA2"


# Comments (need pro plan -> set via mongo)
def _set_plan(uid, plan):
    from dotenv import load_dotenv
    import pymongo
    load_dotenv("/app/backend/.env")
    c = pymongo.MongoClient(os.environ["MONGO_URL"])
    c[os.environ["DB_NAME"]].profiles.update_one({"user_id": uid}, {"$set": {"plan": plan}})


def test_comment_empty_rejected(user_a, user_b):
    _set_plan(user_a["user_id"], "pro")
    requests.put(f"{BASE_URL}/api/me", headers=H(user_b), data=profile_form("TEST_UserB"))
    _set_plan(user_b["user_id"], "pro")
    r = requests.post(f"{BASE_URL}/api/comments", headers=H(user_a), json={"message": ""})
    assert r.status_code in (400, 422)
    r = requests.post(f"{BASE_URL}/api/comments", headers=H(user_a), json={"message": "   "})
    assert r.status_code in (400, 422)


def test_comment_without_profile_rejected(user_new):
    r = requests.post(f"{BASE_URL}/api/comments", headers=H(user_new), json={"message": "hi"})
    assert r.status_code == 403


def test_comment_requires_auth():
    assert requests.get(f"{BASE_URL}/api/comments").status_code == 401
    assert requests.post(f"{BASE_URL}/api/comments", json={"message": "x"}).status_code == 401


def test_comment_pending_visibility(user_a, user_b):
    requests.put(f"{BASE_URL}/api/me", headers=H(user_b), data=profile_form("TEST_UserB"))
    msg = f"TEST_comment_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE_URL}/api/comments", headers=H(user_a), json={"message": msg})
    assert r.status_code == 200
    c = r.json()
    assert c["pending"] is True and c["message"] == msg and c["display_name"] == "TEST_UserA2"
    mine = requests.get(f"{BASE_URL}/api/comments", headers=H(user_a)).json()
    assert any(x["id"] == c["id"] for x in mine)
    other = requests.get(f"{BASE_URL}/api/comments", headers=H(user_b)).json()
    assert not any(x["id"] == c["id"] for x in other)


# Geo search (public)
def test_geo_search_paris():
    r = requests.get(f"{BASE_URL}/api/geo/search", params={"q": "Paris"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True, d
    assert abs(d["location"]["latitude"] - 48.85) < 1
    assert abs(d["location"]["longitude"] - 2.35) < 1


def test_geo_search_short_query():
    assert requests.get(f"{BASE_URL}/api/geo/search", params={"q": "P"}).status_code == 422

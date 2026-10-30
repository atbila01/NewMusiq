# NewMusiq iteration 2: username validation, plans, Stripe checkout, plan gating (comments/tracks), delete account
import json
import os
import subprocess
import uuid

import pymongo
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")
MP3 = open("/app/tests/fixtures/test_track.mp3", "rb").read()
DB = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def make_user(email):
    return json.loads(subprocess.check_output(["/root/.venv/bin/python", "/app/scripts/clerk_test_user.py", email]))


def H(u):
    return {"Authorization": f"Bearer {u['token']}"}


def set_plan(uid, plan):
    DB.profiles.update_one({"user_id": uid}, {"$set": {"plan": plan}})


def complete(u, name):
    r = requests.put(f"{BASE_URL}/api/me", headers=H(u),
                     data={"username": name, "country": "USA", "state": "Kentucky", "zip_code": "40202",
                           "email": "x+clerk_test@example.com"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def std():
    u = make_user("t2std+clerk_test@example.com")
    complete(u, "TEST_t2std")
    set_plan(u["user_id"], "standard")
    return u


@pytest.fixture(scope="module")
def pro():
    u = make_user("t2pro+clerk_test@example.com")
    complete(u, "TEST_t2pro")
    set_plan(u["user_id"], "pro")
    return u


@pytest.fixture(scope="module")
def artist():
    u = make_user("t2artist+clerk_test@example.com")
    complete(u, "TEST_t2artist")
    set_plan(u["user_id"], "artist")
    return u


@pytest.fixture(scope="module")
def artist2():
    u = make_user("t2artistb+clerk_test@example.com")
    complete(u, "TEST_t2artistb")
    set_plan(u["user_id"], "artist")
    return u


@pytest.fixture(scope="module")
def noplan():
    u = make_user("t2noplan+clerk_test@example.com")
    complete(u, "TEST_t2noplan")
    set_plan(u["user_id"], None)
    return u


# Plans
def test_plans_list():
    r = requests.get(f"{BASE_URL}/api/plans")
    assert r.status_code == 200
    d = {p["id"]: p for p in r.json()}
    assert d["standard"]["price"] == 4.99 and d["pro"]["price"] == 9.99 and d["artist"]["price"] == 14.99
    assert d["standard"]["level"] < d["pro"]["level"] < d["artist"]["level"]


# Username validation
def test_username_invalid(noplan):
    r = requests.put(f"{BASE_URL}/api/me", headers=H(noplan),
                     data={"username": "bad name!", "country": "USA", "state": "KY", "zip_code": "1"})
    assert r.status_code == 400
    assert "Username" in r.json()["detail"]


def test_username_duplicate_case_insensitive(noplan, std):
    r = requests.put(f"{BASE_URL}/api/me", headers=H(noplan),
                     data={"username": "test_T2STD", "country": "USA", "state": "KY", "zip_code": "1"})
    assert r.status_code == 409
    assert "taken" in r.json()["detail"]


def test_me_plan_fields(pro):
    d = requests.get(f"{BASE_URL}/api/me", headers=H(pro)).json()
    assert d["plan"] == "pro" and d["plan_level"] == 2 and d["plan_name"] == "Pro Listener"
    assert d["username"] == "TEST_t2pro"


# Stripe checkout
def test_checkout_requires_auth():
    r = requests.post(f"{BASE_URL}/api/payments/checkout", json={"plan": "standard", "origin_url": BASE_URL})
    assert r.status_code == 401


def test_checkout_unknown_plan(noplan):
    r = requests.post(f"{BASE_URL}/api/payments/checkout", headers=H(noplan),
                      json={"plan": "gold", "origin_url": BASE_URL})
    assert r.status_code == 400


def test_checkout_same_plan_rejected(pro):
    r = requests.post(f"{BASE_URL}/api/payments/checkout", headers=H(pro), json={"plan": "pro", "origin_url": BASE_URL})
    assert r.status_code == 400


def test_checkout_incomplete_profile():
    u = make_user(f"t2fresh{uuid.uuid4().hex[:5]}+clerk_test@example.com")
    r = requests.post(f"{BASE_URL}/api/payments/checkout", headers=H(u), json={"plan": "standard", "origin_url": BASE_URL})
    assert r.status_code == 400


def test_checkout_and_status_pending(noplan):
    r = requests.post(f"{BASE_URL}/api/payments/checkout", headers=H(noplan),
                      json={"plan": "standard", "origin_url": BASE_URL}, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["checkout_url"].startswith("https://checkout.stripe.com")
    assert d["session_id"].startswith("cs_")
    s = requests.get(f"{BASE_URL}/api/payments/status/{d['session_id']}", timeout=60)
    assert s.status_code == 200
    assert s.json()["payment_status"] == "pending"


def test_status_unknown_session():
    assert requests.get(f"{BASE_URL}/api/payments/status/cs_test_nope").status_code == 404


# Comments gating
def test_comments_gating(std, pro, artist, noplan):
    assert requests.get(f"{BASE_URL}/api/comments", headers=H(noplan)).status_code == 403
    assert requests.get(f"{BASE_URL}/api/comments", headers=H(std)).status_code == 403
    assert requests.post(f"{BASE_URL}/api/comments", headers=H(std), json={"message": "hi"}).status_code == 403
    assert requests.get(f"{BASE_URL}/api/comments", headers=H(pro)).status_code == 200
    r = requests.post(f"{BASE_URL}/api/comments", headers=H(artist), json={"message": "TEST_artist comment"})
    assert r.status_code == 200 and r.json()["display_name"] == "TEST_t2artist"


# Tracks gating + CRUD
@pytest.fixture(scope="module")
def track(artist):
    r = requests.post(f"{BASE_URL}/api/tracks", headers=H(artist),
                      data={"title": "TEST_Track One", "location": "Louisville, Kentucky"},
                      files={"audio": ("t.mp3", MP3, "audio/mpeg")}, timeout=60)
    assert r.status_code == 200, r.text
    yield r.json()
    requests.delete(f"{BASE_URL}/api/tracks/{r.json()['id']}", headers=H(artist))


def test_upload_forbidden_for_pro(pro):
    r = requests.post(f"{BASE_URL}/api/tracks", headers=H(pro), data={"title": "x"},
                      files={"audio": ("t.mp3", MP3, "audio/mpeg")})
    assert r.status_code == 403


def test_upload_bad_type(artist):
    r = requests.post(f"{BASE_URL}/api/tracks", headers=H(artist), data={"title": "x"},
                      files={"audio": ("t.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_upload_and_list(track, std, artist):
    assert track["title"] == "TEST_Track One" and track["artist_name"] == "TEST_t2artist" and track["mine"] is True
    lst = requests.get(f"{BASE_URL}/api/tracks", headers=H(std)).json()
    found = [t for t in lst if t["id"] == track["id"]]
    assert found and found[0]["mine"] is False
    mine = requests.get(f"{BASE_URL}/api/tracks/mine", headers=H(artist)).json()
    assert any(t["id"] == track["id"] for t in mine)


def test_list_allowed_noplan(noplan):
    # iteration 3: browsing (completed, no plan) users can list tracks for previews
    assert requests.get(f"{BASE_URL}/api/tracks", headers=H(noplan)).status_code == 200


def test_audio_stream(track, std, noplan):
    r = requests.get(f"{BASE_URL}/api/tracks/{track['id']}/audio", headers=H(std), timeout=60)
    assert r.status_code == 200 and r.content == MP3
    assert r.headers["content-type"].startswith("audio/mpeg")
    assert requests.get(f"{BASE_URL}/api/tracks/{track['id']}/audio", headers=H(noplan)).status_code == 403


def test_delete_only_owner(track, artist2, artist):
    assert requests.delete(f"{BASE_URL}/api/tracks/{track['id']}", headers=H(artist2)).status_code == 404
    r = requests.post(f"{BASE_URL}/api/tracks", headers=H(artist), data={"title": "TEST_ToDelete"},
                      files={"audio": ("t.mp3", MP3, "audio/mpeg")}, timeout=60)
    tid = r.json()["id"]
    assert requests.delete(f"{BASE_URL}/api/tracks/{tid}", headers=H(artist)).status_code == 200
    assert requests.get(f"{BASE_URL}/api/tracks/{tid}/audio", headers=H(artist)).status_code == 404


# Delete account (fresh throwaway)
def test_delete_account():
    u = make_user(f"t2del{uuid.uuid4().hex[:5]}+clerk_test@example.com")
    complete(u, f"TEST_del{uuid.uuid4().hex[:5]}")
    r = requests.delete(f"{BASE_URL}/api/me", headers=H(u), timeout=60)
    assert r.status_code == 200 and r.json()["ok"] is True
    assert DB.profiles.find_one({"user_id": u["user_id"]}) is None
    g = requests.get(f"{BASE_URL}/api/me", headers=H(u))
    assert g.status_code == 401 or g.json().get("completed") is False

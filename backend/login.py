import os
from datetime import datetime, timedelta, timezone

import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

try:
    from backend.deps import db
except ModuleNotFoundError:
    from deps import db

login_router = APIRouter(prefix="/api/auth")
MAX_FAILS = 5
WINDOW = timedelta(minutes=15)
BAD_LOGIN = "That username and password don't match."


class UsernameLogin(BaseModel):
    username: str
    password: str


def _clerk(method: str, path: str, body: dict):
    return requests.request(method, f"https://api.clerk.com/v1{path}", json=body, timeout=15, headers={
        "Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "newmusiq-login"})


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")


@login_router.post("/username-sign-in")
async def username_sign_in(body: UsernameLogin, request: Request):
    name = body.username.strip().lstrip("@").lower()
    keys = [f"u:{name}", f"ip:{_client_ip(request)}"]
    since = (datetime.now(timezone.utc) - WINDOW).isoformat()
    if await db.login_fails.count_documents({"key": keys[0], "at": {"$gte": since}}) >= MAX_FAILS or \
            await db.login_fails.count_documents({"key": keys[1], "at": {"$gte": since}}) >= MAX_FAILS * 4:
        raise HTTPException(status_code=429, detail="Too many attempts. Wait 15 minutes and try again.")

    profile = await db.profiles.find_one({"username_lower": name}, {"_id": 0, "user_id": 1})
    ok = False
    if profile and body.password:
        r = await run_in_threadpool(_clerk, "POST", f"/users/{profile['user_id']}/verify_password", {"password": body.password})
        ok = r.status_code == 200 and r.json().get("verified") is True
    if not ok:
        now = datetime.now(timezone.utc).isoformat()
        await db.login_fails.insert_many([{"key": k, "at": now} for k in keys])
        raise HTTPException(status_code=401, detail=BAD_LOGIN)

    await db.login_fails.delete_many({"key": keys[0]})
    r = await run_in_threadpool(_clerk, "POST", "/sign_in_tokens", {"user_id": profile["user_id"], "expires_in_seconds": 120})
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Sign-in is unavailable right now. Try again.")
    return {"ticket": r.json()["token"]}

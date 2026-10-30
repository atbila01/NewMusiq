import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

try:
    from backend.clerk_auth import require_user
except ModuleNotFoundError:
    from clerk_auth import require_user

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

PLANS = {
    "standard": {"name": "Standard Listener", "price": 4.99, "level": 1, "lookup_key": "nm_standard_monthly",
                 "features": ["Listen to music from around the world", "Interactive globe explorer"]},
    "pro": {"name": "Pro Listener", "price": 9.99, "level": 2, "lookup_key": "nm_pro_monthly",
            "features": ["Everything in Standard", "Commentary service", "Chat with listeners and artists",
                         "Comment on the music you hear"]},
    "artist": {"name": "Artist", "price": 14.99, "level": 3, "lookup_key": "nm_artist_monthly",
               "features": ["Everything in Pro", "Upload and publish your own music", "Artist Studio"]},
}


def plan_level(profile: dict | None) -> int:
    plan = PLANS.get((profile or {}).get("plan") or "")
    return plan["level"] if plan else 0


async def current_profile(user: dict = Depends(require_user)) -> dict:
    doc = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return doc or {"user_id": user["user_id"]}


def require_level(level: int):
    needed = next(p["name"] for p in PLANS.values() if p["level"] == level)

    async def check(profile: dict = Depends(current_profile)) -> dict:
        if plan_level(profile) < level:
            raise HTTPException(status_code=403, detail=f"This needs the {needed} plan.")
        return profile
    return check


# ---------- Roles (Clerk-managed identity, roles in app DB) ----------
import requests as _requests
from pymongo import ReturnDocument

ROLES = ["admin", "member"]
DEFAULT_ROLE = "member"
RETIRED_ROLES = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def _is_admin_email(user_id: str) -> bool:
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    if not admins:
        return False
    r = _requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                      headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    return any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified"
               for e in r.json()["email_addresses"])


async def current_member(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    member = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if member is None or not member.get("role"):
        role = "admin" if _is_admin_email(uid) else DEFAULT_ROLE
        await db.users.update_one({"user_id": uid, "role": {"$in": [None, ""]}}, {"$set": {"role": role}})
        member = await db.users.find_one_and_update({"user_id": uid}, {"$setOnInsert": {"user_id": uid, "role": role}},
                                                    upsert=True, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    return {**member, "env": ENV, "role": effective_role(member["role"])}


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check


async def require_completed(profile: dict = Depends(current_profile)) -> dict:
    if not profile.get("completed"):
        raise HTTPException(status_code=403, detail="Finish your profile first.")
    return profile

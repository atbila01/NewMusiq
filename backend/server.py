import logging
import math
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import requests
import stripe
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

try:
    from backend.deps import PLANS, client, db, plan_level, require_level
    from backend.clerk_auth import clerk_router, require_user
    from backend.storage import APP_NAME, get_object, init_storage, put_object
    from backend.billing import payments_router
    from backend.tracks import tracks_router
    from backend.admin import admin_router
    from backend.music import music_router
    from backend.features import features_router
    from backend.weekly import weekly_router
    from backend.login import login_router
except ModuleNotFoundError:
    from deps import PLANS, client, db, plan_level, require_level
    from clerk_auth import clerk_router, require_user
    from storage import APP_NAME, get_object, init_storage, put_object
    from billing import payments_router
    from tracks import tracks_router
    from admin import admin_router
    from music import music_router
    from features import features_router
    from weekly import weekly_router
    from login import login_router

logger = logging.getLogger("newmusiq")
logging.basicConfig(level=logging.INFO)

app = FastAPI()
api_router = APIRouter(prefix="/api")

TRACK_KEY = "golden-moon"
PHOTO_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,20}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Profile(BaseModel):
    user_id: str
    email: str = ""
    username: str = ""
    country: str = ""
    state: str = ""
    zip_code: str = ""
    has_photo: bool = False
    completed: bool = False
    plan: Optional[str] = None
    plan_name: str = ""
    plan_level: int = 0
    browsing: bool = False
    show_tour: bool = False


class Comment(BaseModel):
    id: str
    display_name: str
    message: str
    created_at: str
    pending: bool


class CommentIn(BaseModel):
    message: str = Field(min_length=1, max_length=600)


def profile_out(doc: Optional[dict], user_id: str) -> Profile:
    if not doc:
        return Profile(user_id=user_id)
    level = plan_level(doc)
    plan = doc.get("plan") if level else None
    return Profile(
        user_id=user_id,
        email=doc.get("email", ""),
        username=doc.get("username") or doc.get("display_name", ""),
        country=doc.get("country", ""),
        state=doc.get("state", ""),
        zip_code=doc.get("zip_code", ""),
        has_photo=bool(doc.get("photo_path")),
        completed=bool(doc.get("completed")),
        plan=plan,
        plan_name=PLANS[plan]["name"] if plan else "",
        plan_level=level,
        browsing=False,
        show_tour=bool(doc.get("tour_pending")) and bool(level),
    )


def comment_out(doc: dict) -> Comment:
    return Comment(id=doc["id"], display_name=doc["display_name"], message=doc["message"],
                   created_at=doc["created_at"], pending=doc["status"] == "pending")


@api_router.get("/")
async def root():
    return {"message": "NewMusiq API"}


@api_router.get("/me", response_model=Profile)
async def get_me(user: dict = Depends(require_user)):
    doc = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return profile_out(doc, user["user_id"])


@api_router.put("/me", response_model=Profile)
async def update_me(
    username: str = Form(...),
    country: str = Form(...),
    state: str = Form(...),
    zip_code: str = Form(...),
    email: str = Form(""),
    photo: Optional[UploadFile] = File(None),
    user: dict = Depends(require_user),
):
    fields = {"username": username.strip(), "country": country.strip(), "state": state.strip(), "zip_code": zip_code.strip()}
    if not all(fields.values()):
        raise HTTPException(status_code=400, detail="Complete all fields to continue.")
    if not USERNAME_RE.match(fields["username"]):
        raise HTTPException(status_code=400, detail="Username must be 3-20 letters, numbers, dots or underscores.")
    if len(fields["zip_code"]) > 12 or len(fields["country"]) > 80 or len(fields["state"]) > 80:
        raise HTTPException(status_code=400, detail="Some fields are too long.")
    taken = await db.profiles.find_one(
        {"username_lower": fields["username"].lower(), "user_id": {"$ne": user["user_id"]}}, {"_id": 1})
    if taken:
        raise HTTPException(status_code=409, detail="That username is taken. Try another one.")

    update = {**fields, "username_lower": fields["username"].lower(), "display_name": fields["username"],
              "email": email.strip()[:200], "completed": True, "updated_at": now_iso()}
    if photo is not None and photo.filename:
        if photo.content_type not in PHOTO_TYPES:
            raise HTTPException(status_code=400, detail="Photo must be PNG, JPG or WEBP.")
        data = await photo.read()
        if len(data) > MAX_PHOTO_BYTES:
            raise HTTPException(status_code=400, detail="Photo must be under 5 MB.")
        path = f"{APP_NAME}/avatars/{user['user_id']}/{uuid.uuid4()}.{PHOTO_TYPES[photo.content_type]}"
        result = await run_in_threadpool(put_object, path, data, photo.content_type)
        update["photo_path"] = result["path"]
        update["photo_type"] = photo.content_type

    existing = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0, "completed": 1})
    if not (existing or {}).get("completed"):
        update["tour_pending"] = True
    await db.profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": update, "$setOnInsert": {"user_id": user["user_id"], "created_at": now_iso()}},
        upsert=True,
    )
    doc = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return profile_out(doc, user["user_id"])


def _delete_clerk_user(user_id: str):
    resp = requests.delete(f"https://api.clerk.com/v1/users/{user_id}", timeout=15,
                           headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "newmusiq"})
    if resp.status_code not in (200, 404):
        resp.raise_for_status()


@api_router.delete("/me")
async def delete_me(user: dict = Depends(require_user)):
    uid = user["user_id"]
    doc = await db.profiles.find_one({"user_id": uid}, {"_id": 0}) or {}
    if doc.get("subscription_id"):
        try:
            await run_in_threadpool(stripe.Subscription.cancel, doc["subscription_id"])
        except stripe.error.StripeError as e:
            if getattr(e, "code", "") != "resource_missing":
                logger.error(f"Cancel on delete failed: {e}")
                raise HTTPException(502, "We couldn't cancel your subscription. Please try again.")
    await db.tracks.update_many({"user_id": uid}, {"$set": {"is_deleted": True}})
    await db.comments.delete_many({"user_id": uid})
    await db.profiles.delete_one({"user_id": uid})
    try:
        await run_in_threadpool(_delete_clerk_user, uid)
    except requests.RequestException as e:
        logger.error(f"Clerk delete failed for {uid}: {e}")
        raise HTTPException(502, "Your data was removed but the login couldn't be deleted. Please try again.")
    return {"ok": True}


@api_router.post("/me/tour-done")
async def tour_done(user: dict = Depends(require_user)):
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": {"tour_pending": False}})
    return {"ok": True}


@api_router.get("/me/photo")
async def get_my_photo(user: dict = Depends(require_user)):
    doc = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not doc or not doc.get("photo_path"):
        raise HTTPException(status_code=404, detail="No photo")
    data, content_type = await run_in_threadpool(get_object, doc["photo_path"])
    return Response(content=data, media_type=doc.get("photo_type", content_type),
                    headers={"Cache-Control": "private, max-age=300"})


@api_router.get("/comments", response_model=list[Comment])
async def list_comments(profile: dict = Depends(require_level(2))):
    query = {"track_key": TRACK_KEY, "$or": [{"status": "approved"}, {"user_id": profile["user_id"], "status": "pending"}]}
    docs = await db.comments.find(query, {"_id": 0}).sort("created_at", -1).to_list(20)
    return [comment_out(d) for d in docs]


@api_router.post("/comments", response_model=Comment)
async def create_comment(body: CommentIn, profile: dict = Depends(require_level(2))):
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Write a comment before sending.")
    doc = {
        "id": str(uuid.uuid4()), "user_id": profile["user_id"],
        "display_name": profile.get("username") or profile.get("display_name") or "Listener",
        "message": message, "track_key": TRACK_KEY, "status": "pending", "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    return comment_out(doc)


def nominatim_search(q: str) -> list:
    resp = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"format": "jsonv2", "limit": "1", "q": q},
        headers={"Accept-Language": "en", "User-Agent": "NewMusiq/1.0"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


@api_router.get("/geo/search")
async def geo_search(q: str = Query(..., min_length=2, max_length=120)):
    try:
        matches = await run_in_threadpool(nominatim_search, q.strip())
    except requests.RequestException:
        return {"ok": False, "error": "Location search is unavailable right now."}
    if not matches:
        return {"ok": False, "error": "No matching location was found."}
    m = matches[0]
    lat, lon = float(m["lat"]), float(m["lon"])
    try:
        south, north, west, east = (float(x) for x in m.get("boundingbox", []))
        lat_span = abs(north - south)
        raw_lon = abs(east - west)
        lon_span = min(raw_lon, 360 - raw_lon)
    except ValueError:
        lat_span = lon_span = 0
    visible = max(lat_span, lon_span * math.cos(math.radians(lat)))
    distance = min(3.2, max(1.38, 1.35 + visible / 25))
    label = (m.get("display_name") or q).split(",")[0]
    return {"ok": True, "location": {"cameraDistance": distance, "label": label, "latitude": lat, "longitude": lon}}


app.include_router(api_router)
app.include_router(tracks_router)
app.include_router(admin_router)
app.include_router(music_router)
app.include_router(features_router)
app.include_router(weekly_router)
app.include_router(payments_router)
app.include_router(clerk_router)
app.include_router(login_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.profiles.create_index("user_id", unique=True)
    await db.profiles.create_index("username_lower", unique=True,
                                   partialFilterExpression={"username_lower": {"$type": "string"}})
    await db.comments.create_index([("track_key", 1), ("created_at", -1)])
    await db.tracks.create_index([("is_deleted", 1), ("created_at", -1)])
    await db.payment_transactions.create_index("session_id", unique=True)
    try:
        await run_in_threadpool(init_storage)
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("startup")
async def move_retired_roles():
    try:
        from backend.deps import RETIRED_ROLES
    except ModuleNotFoundError:
        from deps import RETIRED_ROLES
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})


@app.on_event("shutdown")
async def shutdown():
    client.close()

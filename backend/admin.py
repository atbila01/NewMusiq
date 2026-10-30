from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

try:
    from backend.deps import IN_ENV, RANK, ROLES, current_member, db, effective_role, require_role
except ModuleNotFoundError:
    from deps import IN_ENV, RANK, ROLES, current_member, db, effective_role, require_role

admin_router = APIRouter(prefix="/api")


@admin_router.get("/me/role")
async def my_role(member: dict = Depends(current_member)):
    return {"role": member["role"]}


@admin_router.get("/admin/comments")
async def admin_comments(status: Literal["pending", "approved", "hidden"] = Query("pending"),
                         admin: dict = Depends(require_role("admin"))):
    docs = await db.comments.find({"status": status}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(200)
    return docs


class StatusIn(BaseModel):
    status: Literal["pending", "approved", "hidden"]


@admin_router.patch("/admin/comments/{comment_id}")
async def moderate(comment_id: str, body: StatusIn, admin: dict = Depends(require_role("admin"))):
    result = await db.comments.update_one({"id": comment_id}, {"$set": {"status": body.status}})
    if result.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": comment_id, "status": body.status}


@admin_router.get("/users")
async def list_users(admin: dict = Depends(require_role("admin"))):
    people = await db.users.find(IN_ENV, {"_id": 0}).to_list(1000)
    ids = [p["user_id"] for p in people]
    names = {p["user_id"]: p for p in await db.profiles.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "username": 1, "email": 1}).to_list(1000)}
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{**p, "role": effective_role(p.get("role")),
                       "username": names.get(p["user_id"], {}).get("username", ""),
                       "email": names.get(p["user_id"], {}).get("email", "")} for p in people]}


class RoleIn(BaseModel):
    role: str


@admin_router.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, admin: dict = Depends(require_role("admin"))):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, {"_id": 0})
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    if (effective_role(target.get("role")) == "admin" and body.role != "admin"
            and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1):
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    return {"user_id": user_id, "role": body.role}

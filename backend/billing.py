import logging
import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

try:
    from backend.deps import PLANS, current_profile, db
except ModuleNotFoundError:
    from deps import PLANS, current_profile, db

logger = logging.getLogger("newmusiq.billing")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
TAX_MODE = "full"

payments_router = APIRouter()


class CheckoutRequest(BaseModel):
    plan: str
    origin_url: str = Field(min_length=8, max_length=300)


def now():
    return datetime.now(timezone.utc)


@payments_router.get("/api/plans")
async def list_plans():
    return [{"id": k, **{f: v[f] for f in ("name", "price", "level", "features")}} for k, v in PLANS.items()]


def _create_session(kwargs: dict):
    if TAX_MODE == "full":
        try:
            return stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
        except stripe.error.InvalidRequestError as e:
            msg = (e.user_message or str(e)).lower()
            if "managed payments" not in msg and "ineligible" not in msg and "managed_payments" not in msg:
                raise
    return stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True}, billing_address_collection="required")


@payments_router.post("/api/payments/checkout")
async def create_checkout(req: CheckoutRequest, profile: dict = Depends(current_profile)):
    plan = PLANS.get(req.plan)
    if not plan:
        raise HTTPException(400, "Unknown plan")
    if not profile.get("completed"):
        raise HTTPException(400, "Finish your profile first.")
    if profile.get("plan") == req.plan:
        raise HTTPException(400, "You're already on this plan.")
    if not req.origin_url.startswith(("https://", "http://")):
        raise HTTPException(400, "Invalid origin")
    prices = await run_in_threadpool(lambda: stripe.Price.list(lookup_keys=[plan["lookup_key"]], active=True, limit=1).data)
    if not prices:
        raise HTTPException(500, "Plan price not found")
    price = prices[0]
    origin = req.origin_url.rstrip("/")
    meta = {"user_id": profile["user_id"], "plan": req.plan}
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription",
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/payment/cancel",
        metadata=meta,
        subscription_data={"metadata": meta},
    )
    if profile.get("email"):
        kwargs["customer_email"] = profile["email"]
    try:
        session = await run_in_threadpool(_create_session, kwargs)
    except stripe.error.StripeError as e:
        logger.error(f"Checkout failed: {e}")
        raise HTTPException(502, "Payment checkout is unavailable right now. Please try again.")
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": profile["user_id"], "plan": req.plan,
        "lookup_key": plan["lookup_key"], "amount": float(plan["price"]), "currency": price.currency,
        "status": "initiated", "payment_status": "pending", "created_at": now(), "updated_at": now(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def activate(session_id: str, subscription_id: str | None, payment_intent: str | None):
    result = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "stripe_subscription_id": subscription_id,
                  "stripe_payment_intent_id": payment_intent, "updated_at": now()}},
    )
    if result.modified_count == 0:
        return
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    profile = await db.profiles.find_one({"user_id": tx["user_id"]}, {"_id": 0}) or {}
    old_sub = profile.get("subscription_id")
    await db.profiles.update_one(
        {"user_id": tx["user_id"]},
        {"$set": {"plan": tx["plan"], "subscription_id": subscription_id, "subscription_status": "active",
                  "plan_started_at": now().isoformat()}},
    )
    if old_sub and old_sub != subscription_id:
        try:
            await run_in_threadpool(stripe.Subscription.cancel, old_sub)
        except stripe.error.StripeError as e:
            logger.error(f"Could not cancel old subscription {old_sub}: {e}")


@payments_router.get("/api/payments/status/{session_id}")
async def get_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = await run_in_threadpool(stripe.checkout.Session.retrieve, session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await activate(session_id, s.subscription, s.payment_intent)
            elif s.status == "expired":
                await db.payment_transactions.update_one({"session_id": session_id},
                    {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now()}})
            record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"]}


@payments_router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if obj.get("payment_status") in ("paid", "no_payment_required") or t.endswith("succeeded"):
            await activate(obj["id"], obj.get("subscription"), obj.get("payment_intent"))
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "failed", "payment_status": "failed", "updated_at": now()}})
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now()}})
    elif t == "customer.subscription.deleted":
        await db.profiles.update_one({"subscription_id": obj["id"]},
            {"$set": {"plan": None, "subscription_status": "canceled"}})
    elif t == "customer.subscription.updated":
        status = obj.get("status")
        update = {"subscription_status": status}
        if status in ("canceled", "unpaid", "incomplete_expired"):
            update["plan"] = None
        await db.profiles.update_one({"subscription_id": obj["id"]}, {"$set": update})
    return {"status": "ok"}

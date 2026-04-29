"""
Times-tables.ca backend.
- JWT email/password auth (bcrypt + httpOnly cookies)
- 2-day server-managed trial → Stripe Checkout subscription ($5 CAD/mo)
- Cross-device user-state sync (localStorage shape stored in MongoDB)
"""
from dotenv import load_dotenv
load_dotenv()  # MUST be first

import os
import logging
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Any

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

# ------------------------------------------------------------------ ENV / DB
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@timestables.ca").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin12345")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
PRICE_CAD = float(os.environ.get("SUBSCRIPTION_PRICE_CAD", "5.00"))
TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "2"))
PERIOD_DAYS = 30  # length of one paid period (manual-renew subscription model)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("timestables")


# ------------------------------------------------------------------ HELPERS
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email, "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id, "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=14),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=14 * 24 * 3600, path="/")

def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def serialize_user(doc: dict) -> dict:
    """Strip _id / password and compute trial/access state."""
    now = datetime.now(timezone.utc)
    trial_start = doc.get("trial_start")
    if isinstance(trial_start, str):
        trial_start = datetime.fromisoformat(trial_start)
    if isinstance(trial_start, datetime) and trial_start.tzinfo is None:
        trial_start = trial_start.replace(tzinfo=timezone.utc)
    trial_end = trial_start + timedelta(days=TRIAL_DAYS) if trial_start else None
    sub = doc.get("subscription") or {}
    sub_status = sub.get("status")  # active | trialing | past_due | canceled | incomplete | unpaid
    sub_active = sub_status in ("active", "trialing", "past_due")  # past_due still has access

    in_trial = bool(trial_end and now < trial_end)
    has_access = in_trial or sub_active

    seconds_left_trial = int((trial_end - now).total_seconds()) if trial_end and now < trial_end else 0

    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name") or doc["email"].split("@")[0],
        "role": doc.get("role", "user"),
        "trial_start": trial_start.isoformat() if trial_start else None,
        "trial_end": trial_end.isoformat() if trial_end else None,
        "trial_seconds_left": seconds_left_trial,
        "in_trial": in_trial,
        "has_access": has_access,
        "subscription_status": sub_status,
        "billing": {
            "current_period_end": sub.get("current_period_end"),
            "cancel_at_period_end": sub.get("cancel_at_period_end", False),
            "last4": sub.get("last4"),
            "brand": sub.get("brand"),
            "amount_cad": PRICE_CAD,
            "interval": "month",
        },
    }


async def get_token_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ------------------------------------------------------------------ MODELS
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class StateIn(BaseModel):
    state: dict


# ------------------------------------------------------------------ APP
app = FastAPI(title="timestables.ca")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.user_state.create_index("user_id", unique=True)
    await db.login_attempts.create_index("identifier")
    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
            "trial_start": datetime.now(timezone.utc),
            "subscription": {"status": "active"},  # admin always has access
        })
        log.info("Seeded admin user %s", ADMIN_EMAIL)
    else:
        if not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
            )
            log.info("Updated admin password for %s", ADMIN_EMAIL)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# -------------------------------------------------------- HEALTH
@api.get("/")
async def root():
    return {"app": "timestables.ca", "status": "ok"}


# -------------------------------------------------------- AUTH
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.now(timezone.utc)
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": (payload.name or email.split("@")[0]).strip(),
        "role": "user",
        "created_at": now,
        "trial_start": now,
        "subscription": {"status": None},
    }
    res = await db.users.insert_one(doc)
    user = await db.users.find_one({"_id": res.inserted_id})
    access = create_access_token(str(user["_id"]), user["email"])
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return serialize_user(user)


@api.post("/auth/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{email}"

    # brute force: 5 attempts / 15 min
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    fails = await db.login_attempts.count_documents(
        {"identifier": ident, "ts": {"$gt": cutoff.isoformat()}}
    )
    if fails >= 5:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        await db.login_attempts.insert_one(
            {"identifier": ident, "ts": datetime.now(timezone.utc).isoformat()}
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # success: clear attempts
    await db.login_attempts.delete_many({"identifier": ident})

    access = create_access_token(str(user["_id"]), user["email"])
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return serialize_user(user)


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_token_user)):
    return serialize_user(user)


@api.post("/auth/refresh")
async def refresh_token_route(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = jwt.decode(rt, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(str(user["_id"]), user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=3600, path="/")
    return {"ok": True}


# -------------------------------------------------------- USER STATE SYNC
@api.get("/user/state")
async def get_user_state(user: dict = Depends(get_token_user)):
    doc = await db.user_state.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    if not doc:
        return {"state": None, "updated_at": None}
    return {"state": doc.get("state"), "updated_at": doc.get("updated_at")}


@api.put("/user/state")
async def put_user_state(body: StateIn, user: dict = Depends(get_token_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.user_state.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {"state": body.state, "updated_at": now}},
        upsert=True,
    )
    return {"ok": True, "updated_at": now}


# -------------------------------------------------------- STRIPE
def _stripe_client(request: Request) -> StripeCheckout:
    """Build StripeCheckout from emergentintegrations using current host for webhook."""
    host = str(request.base_url).rstrip("/")
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host}/api/webhook/stripe")


async def _grant_paid_period(user_id: str, days: int = PERIOD_DAYS):
    """Mark a user as 'active' for `days` days from now (or extend existing period)."""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return
    sub = user.get("subscription") or {}
    now = datetime.now(timezone.utc)
    cur_end = sub.get("current_period_end")
    if isinstance(cur_end, str):
        try:
            cur_end_dt = datetime.fromisoformat(cur_end)
            if cur_end_dt.tzinfo is None:
                cur_end_dt = cur_end_dt.replace(tzinfo=timezone.utc)
        except Exception:
            cur_end_dt = None
    else:
        cur_end_dt = None
    base = cur_end_dt if (cur_end_dt and cur_end_dt > now) else now
    new_end = (base + timedelta(days=days)).isoformat()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "subscription.status": "active",
            "subscription.current_period_end": new_end,
            "subscription.cancel_at_period_end": False,
        }},
    )


@api.post("/stripe/checkout")
async def stripe_checkout(request: Request, user: dict = Depends(get_token_user)):
    """Create a $5 CAD one-time checkout. On success, grants 30 days of access."""
    body = await request.json()
    origin = (body.get("origin") or FRONTEND_URL).rstrip("/")

    sc = _stripe_client(request)
    req = CheckoutSessionRequest(
        amount=PRICE_CAD,
        currency="cad",
        success_url=f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/billing/cancel",
        metadata={"user_id": str(user["_id"]), "email": user["email"], "kind": "subscription_period"},
    )
    try:
        session = await sc.create_checkout_session(req)
    except Exception as e:
        log.error("Stripe checkout failed: %s", e)
        raise HTTPException(status_code=502, detail="Payment provider unavailable. Try again in a moment.")

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": str(user["_id"]),
        "email": user["email"],
        "amount": PRICE_CAD,
        "currency": "cad",
        "status": "initiated",
        "payment_status": "unpaid",
        "kind": "subscription_period",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id}


@api.get("/stripe/status/{session_id}")
async def stripe_session_status(session_id: str, request: Request, user: dict = Depends(get_token_user)):
    sc = _stripe_client(request)
    try:
        status = await sc.get_checkout_status(session_id)
    except Exception as e:
        log.error("Stripe status fetch failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not check payment status.")

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    paid = (status.payment_status == "paid")
    if tx and tx.get("payment_status") != "paid" and paid:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": "paid",
                "status": "complete",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        user_id = (status.metadata or {}).get("user_id") or str(user["_id"])
        await _grant_paid_period(user_id, days=PERIOD_DAYS)

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


@api.post("/stripe/cancel-renewal")
async def stripe_cancel_renewal(user: dict = Depends(get_token_user)):
    """Manual-renew flow: user just stops paying. Mark cancel_at_period_end = True."""
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"subscription.cancel_at_period_end": True}},
    )
    return {"ok": True}


@api.post("/stripe/resume-renewal")
async def stripe_resume_renewal(user: dict = Depends(get_token_user)):
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"subscription.cancel_at_period_end": False}},
    )
    return {"ok": True}


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    sc = _stripe_client(request)
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        evt = await sc.handle_webhook(payload, sig)
    except Exception as e:
        log.error("Webhook handler failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook")

    log.info("Webhook event: %s session=%s", evt.event_type, evt.session_id)
    if evt.payment_status == "paid" and evt.session_id:
        tx = await db.payment_transactions.find_one({"session_id": evt.session_id})
        if tx and tx.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {
                    "payment_status": "paid",
                    "status": "complete",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            user_id = (evt.metadata or {}).get("user_id") or tx.get("user_id")
            if user_id:
                await _grant_paid_period(user_id, days=PERIOD_DAYS)
    return {"received": True}


# ------------------------------------------------------------------ MOUNT
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

import stripe

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

stripe.api_key = STRIPE_API_KEY

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
@api.post("/stripe/checkout")
async def stripe_checkout(request: Request, user: dict = Depends(get_token_user)):
    """Create a subscription checkout session for $5 CAD/month."""
    body = await request.json()
    origin = body.get("origin") or FRONTEND_URL
    origin = origin.rstrip("/")

    # Reuse stripe customer if exists
    sub = user.get("subscription") or {}
    customer_id = sub.get("customer_id")
    if not customer_id:
        cust = stripe.Customer.create(email=user["email"], metadata={"user_id": str(user["_id"])})
        customer_id = cust.id
        await db.users.update_one(
            {"_id": user["_id"]}, {"$set": {"subscription.customer_id": customer_id}}
        )

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "cad",
                "unit_amount": int(round(PRICE_CAD * 100)),
                "recurring": {"interval": "month"},
                "product_data": {"name": "timestables.ca Premium"},
            },
            "quantity": 1,
        }],
        success_url=f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/billing/cancel",
        metadata={"user_id": str(user["_id"])},
        subscription_data={"metadata": {"user_id": str(user["_id"])}},
    )

    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "user_id": str(user["_id"]),
        "email": user["email"],
        "amount": PRICE_CAD,
        "currency": "cad",
        "status": "initiated",
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.id}


async def _sync_user_subscription(user_id: str, customer_id: str):
    """Pull latest subscription from Stripe and persist."""
    subs = stripe.Subscription.list(customer=customer_id, status="all", limit=5)
    if not subs.data:
        return
    # pick the most relevant
    priority = {"active": 0, "trialing": 1, "past_due": 2, "unpaid": 3, "canceled": 4, "incomplete": 5}
    chosen = sorted(subs.data, key=lambda s: priority.get(s.status, 9))[0]

    update = {
        "subscription.status": chosen.status,
        "subscription.customer_id": customer_id,
        "subscription.subscription_id": chosen.id,
        "subscription.current_period_end": datetime.fromtimestamp(
            chosen.current_period_end, tz=timezone.utc
        ).isoformat() if chosen.current_period_end else None,
        "subscription.cancel_at_period_end": bool(chosen.cancel_at_period_end),
    }
    # default payment method → card brand + last4
    try:
        cust = stripe.Customer.retrieve(customer_id, expand=["invoice_settings.default_payment_method"])
        pm = cust.invoice_settings.default_payment_method if cust.invoice_settings else None
        if pm and getattr(pm, "card", None):
            update["subscription.brand"] = pm.card.brand
            update["subscription.last4"] = pm.card.last4
    except Exception as e:
        log.warning("Failed to fetch payment method for %s: %s", customer_id, e)

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})


@api.get("/stripe/status/{session_id}")
async def stripe_session_status(session_id: str, user: dict = Depends(get_token_user)):
    """Polled by the success page to mark transaction complete + refresh user."""
    sess = stripe.checkout.Session.retrieve(session_id)
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if tx and tx.get("payment_status") != "paid" and sess.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": "paid",
                "status": "complete",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        # refresh subscription details
        user_id = (sess.metadata or {}).get("user_id") or str(user["_id"])
        if sess.customer:
            await _sync_user_subscription(user_id, sess.customer)
    return {
        "status": sess.status,
        "payment_status": sess.payment_status,
        "amount_total": sess.amount_total,
        "currency": sess.currency,
    }


@api.post("/stripe/portal")
async def stripe_portal(request: Request, user: dict = Depends(get_token_user)):
    body = await request.json()
    origin = (body.get("origin") or FRONTEND_URL).rstrip("/")
    sub = user.get("subscription") or {}
    customer_id = sub.get("customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer on file")
    portal = stripe.billing_portal.Session.create(
        customer=customer_id, return_url=f"{origin}/settings"
    )
    return {"url": portal.url}


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook — uses Stripe SDK. We don't strictly verify signature in
    dev (no STRIPE_WEBHOOK_SECRET), but we re-fetch from Stripe to confirm."""
    payload = await request.body()
    try:
        event = stripe.Event.construct_from(__import__("json").loads(payload), stripe.api_key)
    except Exception as e:
        log.error("Bad webhook payload: %s", e)
        raise HTTPException(status_code=400, detail="Invalid payload")

    etype = event["type"]
    obj = event["data"]["object"]
    log.info("Stripe webhook: %s", etype)

    customer_id = obj.get("customer")
    user_id = (obj.get("metadata") or {}).get("user_id")
    if not user_id and customer_id:
        # find user by stored customer_id
        u = await db.users.find_one({"subscription.customer_id": customer_id})
        if u:
            user_id = str(u["_id"])
    if user_id and customer_id:
        try:
            await _sync_user_subscription(user_id, customer_id)
        except Exception as e:
            log.error("sync failed: %s", e)
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

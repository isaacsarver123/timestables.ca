"""
timestables.ca backend
- JWT email/password auth (bcrypt + httpOnly cookies)
- 2-day server-managed trial → Stripe subscription ($5 CAD/month, mode=subscription)
- IP-based anti-trial-abuse (one trial per IP unless ALLOW_MULTI_SIGNUP_PER_IP=1)
- Admin role (Isaac) — full access without paying, /admin dashboard + CMS
- Cross-device user-state sync
"""
from dotenv import load_dotenv
load_dotenv()

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
import stripe
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ------------------------------------------------------------------ ENV
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "isaac@timestables.ca").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin12345")
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Isaac")
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
PRICE_CAD = float(os.environ.get("SUBSCRIPTION_PRICE_CAD", "5.00"))
TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "2"))
ALLOW_MULTI_SIGNUP_PER_IP = os.environ.get("ALLOW_MULTI_SIGNUP_PER_IP", "0") == "1"

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

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
    return jwt.encode(
        {"sub": user_id, "email": email, "type": "access",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=60)},
        JWT_SECRET, algorithm=JWT_ALG,
    )

def create_refresh_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "type": "refresh",
         "exp": datetime.now(timezone.utc) + timedelta(days=14)},
        JWT_SECRET, algorithm=JWT_ALG,
    )

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=14 * 24 * 3600, path="/")

def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def serialize_user(doc: dict) -> dict:
    now = datetime.now(timezone.utc)
    role = doc.get("role", "user")
    trial_start = doc.get("trial_start")
    if isinstance(trial_start, str):
        trial_start = datetime.fromisoformat(trial_start)
    if isinstance(trial_start, datetime) and trial_start.tzinfo is None:
        trial_start = trial_start.replace(tzinfo=timezone.utc)
    trial_end = trial_start + timedelta(days=TRIAL_DAYS) if trial_start else None
    sub = doc.get("subscription") or {}
    sub_status = sub.get("status")
    sub_active = sub_status in ("active", "trialing", "past_due")
    in_trial = bool(trial_end and now < trial_end)
    # Admins always have access — they don't need to pay.
    has_access = role == "admin" or in_trial or sub_active
    secs_left = int((trial_end - now).total_seconds()) if trial_end and now < trial_end else 0
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name") or doc["email"].split("@")[0],
        "role": role,
        "trial_start": trial_start.isoformat() if trial_start else None,
        "trial_end": trial_end.isoformat() if trial_end else None,
        "trial_seconds_left": secs_left,
        "in_trial": in_trial,
        "has_access": has_access,
        "is_admin": role == "admin",
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


async def get_admin_user(user: dict = Depends(get_token_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def require_stripe():
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Stripe not configured. Add STRIPE_SECRET_KEY to backend/.env."
        )


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

class CMSIn(BaseModel):
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    paywall_blurb: Optional[str] = None
    announcement: Optional[str] = None
    announcement_active: Optional[bool] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    footer_text: Optional[str] = None
    signup_welcome_title: Optional[str] = None
    signup_welcome_body: Optional[str] = None
    signup_pitch_a_title: Optional[str] = None
    signup_pitch_a_body: Optional[str] = None
    signup_pitch_b_title: Optional[str] = None
    signup_pitch_b_body: Optional[str] = None
    login_welcome_title: Optional[str] = None
    login_welcome_body: Optional[str] = None


class UserEditIn(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None  # "user" | "admin"


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    is_private: Optional[bool] = None


class FriendCodeIn(BaseModel):
    code: str


class GemsAdjustIn(BaseModel):
    delta: int  # positive to grant, negative to spend
    reason: Optional[str] = None


class CMSKVIn(BaseModel):
    key: str
    value: Optional[str] = None  # if None → delete


def _gen_friend_code() -> str:
    import secrets
    import string
    alphabet = string.ascii_uppercase + string.digits
    return "TT-" + "".join(secrets.choice(alphabet) for _ in range(5))


# ------------------------------------------------------------------ APP
app = FastAPI(title="timestables.ca")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("signup_ip")
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.user_state.create_index("user_id", unique=True)
    await db.login_attempts.create_index("identifier")
    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    now = datetime.now(timezone.utc)
    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": ADMIN_NAME,
            "role": "admin",
            "created_at": now,
            "trial_start": now,
            "subscription": {"status": "active"},
            "signup_ip": "admin",
        })
        log.info("Seeded admin user %s (%s)", ADMIN_EMAIL, ADMIN_NAME)
    else:
        upd = {"name": ADMIN_NAME, "role": "admin"}
        if not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
            upd["password_hash"] = hash_password(ADMIN_PASSWORD)
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": upd})
    # Default CMS doc
    cms = await db.cms.find_one({"_id": "site"})
    cms_defaults = {
        "hero_title": "Practice multiplication and division.",
        "hero_subtitle": "Pick the tables you want, choose a mode, and go. Progress syncs across your devices.",
        "paywall_blurb": "Our service is just $5 CAD/month — that's what keeps the servers humming and the devs building.",
        "announcement": "",
        "announcement_active": False,
        "support_email": "isaacsarver@icloud.com",
        "support_phone": "825-962-3425",
        "footer_text": "timestables.ca · v3",
        "signup_welcome_title": "Welcome.",
        "signup_welcome_body": "2-day free trial, no card required. After that it's $5 CAD/month — cancel anytime, no funny business.",
        "signup_pitch_a_title": "No $99/mo nonsense.",
        "signup_pitch_a_body": "Other sites charge ridiculous fees for the same thing. We charge $5 — flat. That keeps the servers on and the developers fed. That's it.",
        "signup_pitch_b_title": "No card during the trial.",
        "signup_pitch_b_body": "You only put a card in if you decide to keep going after 2 days. We'll never charge you by surprise.",
        "login_welcome_title": "Welcome back.",
        "login_welcome_body": "Pick up where you left off. Your progress syncs across every device you sign in on.",
    }
    if not cms:
        await db.cms.insert_one({"_id": "site", **cms_defaults, "updated_at": now.isoformat()})
    else:
        # backfill any missing default fields
        missing = {k: v for k, v in cms_defaults.items() if k not in cms}
        if missing:
            await db.cms.update_one({"_id": "site"}, {"$set": missing})


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# -------------------------------------------------------- HEALTH / CMS
@api.get("/")
async def root():
    return {"app": "timestables.ca", "status": "ok",
            "stripe_configured": bool(STRIPE_SECRET_KEY)}


@api.get("/cms/public")
async def cms_public():
    doc = await db.cms.find_one({"_id": "site"}) or {}
    doc.pop("_id", None)
    doc.pop("updated_at", None)
    return doc


# -------------------------------------------------------- AUTH
@api.post("/auth/register")
async def register(payload: RegisterIn, request: Request, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered. Sign in instead.")

    ip = client_ip(request)
    if not ALLOW_MULTI_SIGNUP_PER_IP:
        prior = await db.users.find_one({"signup_ip": ip, "role": {"$ne": "admin"}})
        if prior:
            raise HTTPException(
                status_code=400,
                detail="A trial account already exists from this network. Sign in to your existing account."
            )

    now = datetime.now(timezone.utc)
    res = await db.users.insert_one({
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": (payload.name or email.split("@")[0]).strip(),
        "role": "user",
        "created_at": now,
        "trial_start": now,
        "subscription": {"status": None},
        "signup_ip": ip,
    })
    user = await db.users.find_one({"_id": res.inserted_id})
    set_auth_cookies(
        response,
        create_access_token(str(user["_id"]), user["email"]),
        create_refresh_token(str(user["_id"])),
    )
    return serialize_user(user)


@api.post("/auth/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower().strip()
    ip = client_ip(request)
    ident = f"{ip}:{email}"
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
    await db.login_attempts.delete_many({"identifier": ident})
    set_auth_cookies(
        response,
        create_access_token(str(user["_id"]), user["email"]),
        create_refresh_token(str(user["_id"])),
    )
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
    response.set_cookie(
        "access_token",
        create_access_token(str(user["_id"]), user["email"]),
        httponly=True, secure=True, samesite="none", max_age=3600, path="/",
    )
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


# -------------------------------------------------------- STRIPE (raw SDK, subscription mode)
async def _ensure_stripe_customer(user: dict) -> str:
    sub = user.get("subscription") or {}
    customer_id = sub.get("customer_id")
    if customer_id:
        return customer_id
    cust = stripe.Customer.create(
        email=user["email"],
        name=user.get("name"),
        metadata={"user_id": str(user["_id"])},
    )
    await db.users.update_one(
        {"_id": user["_id"]}, {"$set": {"subscription.customer_id": cust.id}}
    )
    return cust.id


async def _sync_subscription_from_stripe(user_id: str, customer_id: str):
    try:
        subs = stripe.Subscription.list(customer=customer_id, status="all", limit=5)
    except Exception as e:
        log.error("Subscription.list failed: %s", e)
        return
    if not subs.data:
        return
    priority = {"active": 0, "trialing": 1, "past_due": 2, "unpaid": 3,
                "canceled": 4, "incomplete": 5, "incomplete_expired": 6}
    chosen = sorted(subs.data, key=lambda s: priority.get(s.status, 9))[0]
    upd = {
        "subscription.status": chosen.status,
        "subscription.customer_id": customer_id,
        "subscription.subscription_id": chosen.id,
        "subscription.current_period_end": (
            datetime.fromtimestamp(chosen.current_period_end, tz=timezone.utc).isoformat()
            if chosen.current_period_end else None
        ),
        "subscription.cancel_at_period_end": bool(chosen.cancel_at_period_end),
    }
    try:
        cust = stripe.Customer.retrieve(
            customer_id, expand=["invoice_settings.default_payment_method"]
        )
        pm = (cust.invoice_settings or {}).default_payment_method if cust.invoice_settings else None
        if pm and getattr(pm, "card", None):
            upd["subscription.brand"] = pm.card.brand
            upd["subscription.last4"] = pm.card.last4
    except Exception as e:
        log.warning("payment-method fetch failed: %s", e)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": upd})


@api.post("/stripe/checkout")
async def stripe_checkout(request: Request, user: dict = Depends(get_token_user)):
    require_stripe()
    body = await request.json()
    origin = (body.get("origin") or FRONTEND_URL).rstrip("/")
    customer_id = await _ensure_stripe_customer(user)
    try:
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
            allow_promotion_codes=True,
        )
    except stripe.error.StripeError as e:
        log.error("Stripe checkout failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:160]}")

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


@api.get("/stripe/status/{session_id}")
async def stripe_status(session_id: str, user: dict = Depends(get_token_user)):
    require_stripe()
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
        user_id = (sess.metadata or {}).get("user_id") or str(user["_id"])
        if sess.customer:
            await _sync_subscription_from_stripe(user_id, sess.customer)
    return {
        "status": sess.status,
        "payment_status": sess.payment_status,
        "amount_total": sess.amount_total,
        "currency": sess.currency,
    }


@api.post("/stripe/portal")
async def stripe_portal(request: Request, user: dict = Depends(get_token_user)):
    require_stripe()
    body = await request.json()
    origin = (body.get("origin") or FRONTEND_URL).rstrip("/")
    customer_id = (user.get("subscription") or {}).get("customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer on file")
    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer_id, return_url=f"{origin}/settings"
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:160]}")
    return {"url": portal.url}


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    require_stripe()
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        else:
            import json as _json
            event = stripe.Event.construct_from(_json.loads(payload), STRIPE_SECRET_KEY)
    except Exception as e:
        log.error("Webhook parse failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook")

    obj = event["data"]["object"]
    log.info("Stripe webhook: %s", event["type"])
    customer_id = obj.get("customer")
    user_id = (obj.get("metadata") or {}).get("user_id")
    if not user_id and customer_id:
        u = await db.users.find_one({"subscription.customer_id": customer_id})
        if u:
            user_id = str(u["_id"])
    if user_id and customer_id:
        try:
            await _sync_subscription_from_stripe(user_id, customer_id)
        except Exception as e:
            log.error("subscription sync failed: %s", e)
    return {"received": True}


# -------------------------------------------------------- ADMIN
@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(get_admin_user)):
    now = datetime.now(timezone.utc)
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    active_subs = await db.users.count_documents({"subscription.status": {"$in": ["active", "trialing", "past_due"]}})
    trialing = await db.users.count_documents({
        "subscription.status": {"$nin": ["active", "trialing", "past_due"]},
        "trial_start": {"$gte": now - timedelta(days=TRIAL_DAYS)},
    })

    paid_tx = db.payment_transactions.find({"payment_status": "paid"}, {"_id": 0})
    total_revenue = 0.0
    by_day = {}
    async for t in paid_tx:
        amt = float(t.get("amount") or 0)
        total_revenue += amt
        day = (t.get("completed_at") or t.get("created_at") or "")[:10]
        if day:
            by_day[day] = by_day.get(day, 0) + amt
    mrr = active_subs * PRICE_CAD

    # signups last 30 days
    cutoff = now - timedelta(days=30)
    signups = []
    cur = db.users.find(
        {"role": {"$ne": "admin"}, "created_at": {"$gte": cutoff}},
        {"_id": 0, "created_at": 1},
    )
    by_signup_day = {}
    async for u in cur:
        ts = u.get("created_at")
        if isinstance(ts, datetime):
            day = ts.date().isoformat()
        else:
            day = str(ts)[:10]
        by_signup_day[day] = by_signup_day.get(day, 0) + 1
    for i in range(30, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        signups.append({"date": d, "count": by_signup_day.get(d, 0)})

    revenue_series = []
    for i in range(30, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        revenue_series.append({"date": d, "amount": round(by_day.get(d, 0), 2)})

    recent_payments = []
    cur = db.payment_transactions.find(
        {"payment_status": "paid"}, {"_id": 0}
    ).sort("completed_at", -1).limit(8)
    async for t in cur:
        recent_payments.append({
            "email": t.get("email"),
            "amount": t.get("amount"),
            "currency": t.get("currency"),
            "completed_at": t.get("completed_at"),
        })

    return {
        "total_users": total_users,
        "active_subs": active_subs,
        "trialing": trialing,
        "mrr_cad": round(mrr, 2),
        "total_revenue_cad": round(total_revenue, 2),
        "signups_30d": signups,
        "revenue_30d": revenue_series,
        "recent_payments": recent_payments,
    }


@api.get("/admin/users")
async def admin_users(_: dict = Depends(get_admin_user), q: str = "", limit: int = 50):
    flt = {}
    if q:
        flt["email"] = {"$regex": q, "$options": "i"}
    cur = db.users.find(flt, {"password_hash": 0}).sort("created_at", -1).limit(limit)
    out = []
    async for u in cur:
        out.append(serialize_user(u))
    return {"users": out}


@api.put("/admin/users/{user_id}")
async def admin_users_edit(user_id: str, body: UserEditIn, admin: dict = Depends(get_admin_user)):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    target = await db.users.find_one({"_id": oid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    upd = {}
    if body.email is not None:
        new_email = body.email.lower().strip()
        if new_email != target["email"]:
            clash = await db.users.find_one({"email": new_email, "_id": {"$ne": oid}})
            if clash:
                raise HTTPException(status_code=400, detail="That email is already in use.")
            upd["email"] = new_email
    if body.name is not None:
        upd["name"] = body.name.strip()
    if body.role is not None:
        if body.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
        # block demoting yourself
        if body.role == "user" and str(target["_id"]) == str(admin["_id"]):
            raise HTTPException(status_code=400, detail="Can't demote yourself.")
        upd["role"] = body.role
    if not upd:
        return serialize_user(target)
    await db.users.update_one({"_id": oid}, {"$set": upd})
    refreshed = await db.users.find_one({"_id": oid})
    return serialize_user(refreshed)


@api.delete("/admin/users/{user_id}")
async def admin_users_delete(user_id: str, admin: dict = Depends(get_admin_user)):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    if str(oid) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Can't delete yourself.")
    target = await db.users.find_one({"_id": oid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Can't delete the last admin.")
    await db.users.delete_one({"_id": oid})
    await db.user_state.delete_many({"user_id": str(oid)})
    await db.payment_transactions.delete_many({"user_id": str(oid)})
    if target.get("email"):
        await db.login_attempts.delete_many({"identifier": {"$regex": f":{target['email']}$"}})
    return {"deleted": True, "id": str(oid)}


@api.get("/admin/cms")
async def admin_cms_get(_: dict = Depends(get_admin_user)):
    doc = await db.cms.find_one({"_id": "site"}) or {}
    doc.pop("_id", None)
    return doc


@api.put("/admin/cms")
async def admin_cms_put(body: CMSIn, _: dict = Depends(get_admin_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.cms.update_one({"_id": "site"}, {"$set": upd}, upsert=True)
    doc = await db.cms.find_one({"_id": "site"}) or {}
    doc.pop("_id", None)
    return doc


# ------------------------------------------------------------------ MOUNT
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "isaacsarver100@gmail.com").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Isabella0412!")
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
    # XP boost
    xpb_raw = doc.get("xp_boost_until")
    xpb_dt = None
    if isinstance(xpb_raw, str):
        try:
            xpb_dt = datetime.fromisoformat(xpb_raw)
            if xpb_dt.tzinfo is None:
                xpb_dt = xpb_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            xpb_dt = None
    xp_boost_active = bool(xpb_dt and xpb_dt > now)
    xp_boost_seconds_left = int((xpb_dt - now).total_seconds()) if xp_boost_active else 0
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
        "gems": int(doc.get("gems") or 0),
        "xp_boost_until": xpb_dt.isoformat() if xpb_dt else None,
        "xp_boost_active": xp_boost_active,
        "xp_boost_seconds_left": xp_boost_seconds_left,
        "streak_freezes": int(doc.get("streak_freezes") or 0),
        "username": doc.get("username"),
        "bio": doc.get("bio") or "",
        "is_private": bool(doc.get("is_private", False)),
        "avatar": doc.get("avatar") or {},
        "created_at": (doc.get("created_at").isoformat()
                       if isinstance(doc.get("created_at"), datetime)
                       else doc.get("created_at")),
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
    """DEPRECATED: prefer `await ensure_stripe()`. Still here for any legacy callers."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Stripe not configured. Add the Secret Key in Admin → CMS."
        )


async def _resolve_stripe_key() -> str:
    """Prefer CMS-stored key (so admins can rotate via the dashboard); fall back to .env."""
    doc = await db.cms.find_one({"_id": "site"}, {"stripe_secret_key": 1}) or {}
    cms_key = (doc.get("stripe_secret_key") or "").strip()
    return cms_key or STRIPE_SECRET_KEY


async def ensure_stripe() -> str:
    key = await _resolve_stripe_key()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Stripe not configured. Paste your Secret Key in Admin → CMS."
        )
    stripe.api_key = key
    return key


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
    app_version: Optional[str] = None
    signup_welcome_title: Optional[str] = None
    signup_welcome_body: Optional[str] = None
    signup_pitch_a_title: Optional[str] = None
    signup_pitch_a_body: Optional[str] = None
    signup_pitch_b_title: Optional[str] = None
    signup_pitch_b_body: Optional[str] = None
    login_welcome_title: Optional[str] = None
    login_welcome_body: Optional[str] = None
    wrong_answer_flash_ms: Optional[int] = None
    lesson_drift_amount: Optional[float] = None
    lesson_mouse_force: Optional[float] = None
    lesson_mouse_radius: Optional[float] = None
    stripe_secret_key: Optional[str] = None


class UserEditIn(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None  # "user" | "admin"


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    is_private: Optional[bool] = None
    username: Optional[str] = None  # 3-20 chars, [a-z0-9_]
    avatar: Optional[dict] = None   # arbitrary config blob


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
    # Migration: drop legacy admin if present so we don't end up with two admins.
    legacy_admins = ["isaac@timestables.ca"]
    for legacy in legacy_admins:
        if legacy != ADMIN_EMAIL:
            await db.users.delete_one({"email": legacy, "role": "admin"})
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
        "app_version": "v5",
        "footer_text": "timestables.ca · v5",
        "signup_welcome_title": "Welcome.",
        "signup_welcome_body": "2-day free trial, no card required. After that it's $5 CAD/month — cancel anytime, no funny business.",
        "signup_pitch_a_title": "No $99/mo nonsense.",
        "signup_pitch_a_body": "Other sites charge ridiculous fees for the same thing. We charge $5 a month — flat. That keeps the servers on and the developers fed. That's it.",
        "signup_pitch_b_title": "No card during the trial.",
        "signup_pitch_b_body": "You only put a card in if you decide to keep going after 2 days. We'll never charge you by surprise.",
        "login_welcome_title": "Welcome back.",
        "login_welcome_body": "Pick up where you left off. Your progress syncs across every device you sign in on.",
        "wrong_answer_flash_ms": 1500,
        "lesson_drift_amount": 1.0,
        "lesson_mouse_force": 0.75,
        "lesson_mouse_radius": 1.8,
        "stripe_secret_key": "",
    }
    if not cms:
        await db.cms.insert_one({"_id": "site", **cms_defaults, "updated_at": now.isoformat()})
    else:
        # backfill any missing default fields
        missing = {k: v for k, v in cms_defaults.items() if k not in cms}
        if missing:
            await db.cms.update_one({"_id": "site"}, {"$set": missing})
        # Auto-bump footer/version stamp when it still points at an older build.
        cur_footer = (cms.get("footer_text") or "").strip()
        if cur_footer in ("timestables.ca · v3", "timestables.ca · v4"):
            await db.cms.update_one(
                {"_id": "site"},
                {"$set": {"footer_text": cms_defaults["footer_text"], "app_version": cms_defaults["app_version"]}},
            )
        # Migrate old 3000ms flash default down to the new 1500ms default.
        if int(cms.get("wrong_answer_flash_ms") or 0) in (3000,):
            await db.cms.update_one(
                {"_id": "site"},
                {"$set": {"wrong_answer_flash_ms": 1500}},
            )


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# -------------------------------------------------------- HEALTH / CMS
@api.get("/")
async def root():
    key = await _resolve_stripe_key()
    return {"app": "timestables.ca", "status": "ok",
            "stripe_configured": bool(key)}


@api.get("/cms/public")
async def cms_public():
    doc = await db.cms.find_one({"_id": "site"}) or {}
    doc.pop("_id", None)
    doc.pop("updated_at", None)
    # Never expose secrets through the public endpoint.
    doc.pop("stripe_secret_key", None)
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
    await db.user_state.update_one(
        {"user_id": str(user["_id"])},
        {"$setOnInsert": {"state": {}, "updated_at": now.isoformat()}},
        upsert=True,
    )
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
    await ensure_stripe()
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


async def _credit_gem_pack_if_needed(session_id: str) -> int:
    """Atomically marks a gem-pack payment tx as credited and increments the
    user's gem balance. Safe to call multiple times — second call is a no-op."""
    tx = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "kind": "gem_pack",
         "payment_status": "paid", "gems_credited": {"$ne": True}},
        {"$set": {"gems_credited": True,
                  "gems_credited_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
    )
    if not tx:
        return 0
    gems = int(tx.get("gems") or 0)
    user_id = tx.get("user_id")
    if gems <= 0 or not user_id:
        return 0
    try:
        from bson import ObjectId
        _id = ObjectId(user_id)
    except Exception:
        return 0
    await db.users.update_one({"_id": _id}, {"$inc": {"gems": gems}})
    await db.gem_transactions.insert_one({
        "user_id": user_id,
        "delta": gems,
        "reason": f"gem_pack_{tx.get('pack_id') or 'unknown'}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return gems


@api.get("/stripe/status/{session_id}")
async def stripe_status(session_id: str, user: dict = Depends(get_token_user)):
    await ensure_stripe()
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
        kind = (sess.metadata or {}).get("kind") or (tx.get("kind") if tx else None)
        if kind == "gem_pack":
            await _credit_gem_pack_if_needed(session_id)
        elif sess.customer:
            await _sync_subscription_from_stripe(user_id, sess.customer)
    elif tx and tx.get("kind") == "gem_pack" and sess.payment_status == "paid":
        # Tx already marked paid (e.g. webhook beat us) — ensure credit is in.
        await _credit_gem_pack_if_needed(session_id)
    return {
        "status": sess.status,
        "payment_status": sess.payment_status,
        "amount_total": sess.amount_total,
        "currency": sess.currency,
        "kind": (sess.metadata or {}).get("kind") or (tx.get("kind") if tx else None),
    }


@api.post("/stripe/portal")
async def stripe_portal(request: Request, user: dict = Depends(get_token_user)):
    await ensure_stripe()
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
    key = await ensure_stripe()
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        else:
            import json as _json
            event = stripe.Event.construct_from(_json.loads(payload), key)
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

    # Gem-pack one-time checkout — credit gems on session completion.
    if event["type"] == "checkout.session.completed":
        session_id = obj.get("id")
        kind = (obj.get("metadata") or {}).get("kind")
        if session_id and (kind == "gem_pack" or
                           (await db.payment_transactions.find_one(
                               {"session_id": session_id, "kind": "gem_pack"}, {"_id": 0}))):
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "status": "complete",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            try:
                await _credit_gem_pack_if_needed(session_id)
            except Exception as e:
                log.error("gem credit failed: %s", e)
            return {"received": True}

    if user_id and customer_id:
        try:
            await _sync_subscription_from_stripe(user_id, customer_id)
        except Exception as e:
            log.error("subscription sync failed: %s", e)
    return {"received": True}


# -------------------------------------------------------- PROFILE / FOLLOW
import re as _re

def _validate_username(u: str) -> str:
    u = (u or "").lower().strip().lstrip("@")
    if not _re.fullmatch(r"[a-z0-9_]{3,20}", u):
        raise HTTPException(status_code=400, detail="Username must be 3–20 chars: a-z, 0-9, _.")
    return u


async def _user_public(doc: dict) -> dict:
    """Public-safe view of a user (no email unless self)."""
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name") or (doc.get("email") or "").split("@")[0],
        "username": doc.get("username"),
        "bio": doc.get("bio") or "",
        "is_private": bool(doc.get("is_private", False)),
        "avatar": doc.get("avatar") or {},
        "created_at": (doc.get("created_at").isoformat()
                       if isinstance(doc.get("created_at"), datetime)
                       else doc.get("created_at")),
    }


async def _follow_counts(user_id: str) -> dict:
    following = await db.follows.count_documents({"follower_id": user_id})
    followers = await db.follows.count_documents({"following_id": user_id})
    return {"following": following, "followers": followers}


@api.put("/profile")
async def profile_update(payload: ProfileUpdateIn, user: dict = Depends(get_token_user)):
    upd = {}
    if payload.name is not None:
        upd["name"] = payload.name.strip()[:60]
    if payload.bio is not None:
        upd["bio"] = payload.bio.strip()[:200]
    if payload.is_private is not None:
        upd["is_private"] = bool(payload.is_private)
    if payload.avatar is not None:
        upd["avatar"] = payload.avatar
    if payload.username is not None:
        u = _validate_username(payload.username)
        clash = await db.users.find_one({"username": u, "_id": {"$ne": user["_id"]}})
        if clash:
            raise HTTPException(status_code=400, detail="Username taken.")
        upd["username"] = u
    if not upd:
        return serialize_user(user)
    await db.users.update_one({"_id": user["_id"]}, {"$set": upd})
    refreshed = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(refreshed)


@api.get("/profile/me")
async def profile_me(user: dict = Depends(get_token_user)):
    """Own profile + follow stats."""
    counts = await _follow_counts(str(user["_id"]))
    pub = await _user_public(user)
    return {**pub, **counts, "email": user["email"]}


@api.get("/u/{username}")
async def profile_by_username(username: str, user: dict = Depends(get_token_user)):
    u = _validate_username(username)
    target = await db.users.find_one({"username": u})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    pub = await _user_public(target)
    counts = await _follow_counts(str(target["_id"]))
    am_following = await db.follows.find_one({
        "follower_id": str(user["_id"]),
        "following_id": str(target["_id"]),
    })
    return {
        **pub, **counts,
        "is_self": str(target["_id"]) == str(user["_id"]),
        "am_following": bool(am_following),
        "private_locked": bool(target.get("is_private")) and str(target["_id"]) != str(user["_id"]),
    }


@api.post("/u/{username}/follow")
async def follow_user(username: str, user: dict = Depends(get_token_user)):
    u = _validate_username(username)
    target = await db.users.find_one({"username": u})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if str(target["_id"]) == str(user["_id"]):
        raise HTTPException(status_code=400, detail="Can't follow yourself.")
    if target.get("is_private"):
        raise HTTPException(status_code=403, detail="This user's profile is private.")
    await db.follows.update_one(
        {"follower_id": str(user["_id"]), "following_id": str(target["_id"])},
        {"$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "am_following": True}


@api.delete("/u/{username}/follow")
async def unfollow_user(username: str, user: dict = Depends(get_token_user)):
    u = _validate_username(username)
    target = await db.users.find_one({"username": u})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.follows.delete_one({
        "follower_id": str(user["_id"]),
        "following_id": str(target["_id"]),
    })
    return {"ok": True, "am_following": False}


@api.get("/profile/suggestions")
async def profile_suggestions(user: dict = Depends(get_token_user), limit: int = 10):
    """Users with usernames that the current user isn't already following."""
    already = {d["following_id"] async for d in db.follows.find(
        {"follower_id": str(user["_id"])}, {"following_id": 1}
    )}
    already.add(str(user["_id"]))
    cur = db.users.find(
        {"username": {"$ne": None, "$exists": True}, "is_private": {"$ne": True}},
        {"password_hash": 0},
    ).limit(50)
    out = []
    async for u in cur:
        if str(u["_id"]) in already:
            continue
        out.append(await _user_public(u))
        if len(out) >= limit:
            break
    return {"suggestions": out}


@api.get("/profile/search")
async def profile_search(q: str, user: dict = Depends(get_token_user), limit: int = 20):
    if not q or len(q) < 2:
        return {"results": []}
    safe_q = _re.escape(q.lower().lstrip("@"))
    cur = db.users.find(
        {
            "$or": [
                {"username": {"$regex": safe_q, "$options": "i"}},
                {"name": {"$regex": safe_q, "$options": "i"}},
            ]
        },
        {"password_hash": 0},
    ).limit(min(limit, 50))
    out = []
    async for u in cur:
        if str(u["_id"]) == str(user["_id"]):
            continue
        out.append(await _user_public(u))
    return {"results": out}


# Add username unique index on startup
@app.on_event("startup")
async def _profile_indexes():
    await db.users.create_index(
        "username",
        unique=True,
        partialFilterExpression={"username": {"$type": "string"}},
    )
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.follows.create_index("following_id")


# Re-add the LESSONS / GEMS routes block separator below.
# -------------------------------------------------------- LESSONS / GEMS
class LessonFinishIn(BaseModel):
    topics: list[str]            # any of: multiplication, division, long_mul, long_div
    difficulty: str              # easy | medium | hard
    questions_total: int
    correct: int
    hard_correct: int = 0
    seconds_taken: int = 0


def _lesson_xp(payload: LessonFinishIn) -> int:
    """XP proportional to existing economy (Quick-Fire ≈ 3 XP per correct).
    Max 75 for a perfect Hard lesson; min 0 for 0/total."""
    diff_factor = {"easy": 1, "medium": 2, "hard": 3}.get(payload.difficulty, 2)
    base = 15 + 3 * diff_factor                    # 18 / 21 / 24
    accuracy = (payload.correct / payload.questions_total) if payload.questions_total else 0
    xp = int(round(base * accuracy * 1.6))         # tune so hard-perfect ≈ 38
    if payload.questions_total > 0 and payload.correct == payload.questions_total:
        xp += 25                                   # perfect bonus
    return max(0, xp)


def _lesson_gems(payload: LessonFinishIn) -> int:
    if payload.questions_total > 0 and payload.correct == payload.questions_total:
        return 5
    return 0


@api.post("/lessons/finish")
async def lessons_finish(payload: LessonFinishIn, user: dict = Depends(get_token_user)):
    if payload.questions_total <= 0 or payload.correct < 0 or payload.correct > payload.questions_total:
        raise HTTPException(status_code=400, detail="Invalid lesson result")
    xp_earned = _lesson_xp(payload)
    gems_earned = _lesson_gems(payload)
    now = datetime.now(timezone.utc)
    # Apply XP Boost 2× if active at finish time.
    xpb_raw = user.get("xp_boost_until")
    xpb_dt = None
    if isinstance(xpb_raw, str):
        try:
            xpb_dt = datetime.fromisoformat(xpb_raw)
            if xpb_dt.tzinfo is None:
                xpb_dt = xpb_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            xpb_dt = None
    boost_active = bool(xpb_dt and xpb_dt > now)
    if boost_active:
        xp_earned *= 2
    await db.lesson_runs.insert_one({
        "user_id": str(user["_id"]),
        "topics": payload.topics,
        "difficulty": payload.difficulty,
        "questions_total": payload.questions_total,
        "correct": payload.correct,
        "hard_correct": payload.hard_correct,
        "seconds_taken": payload.seconds_taken,
        "xp_earned": xp_earned,
        "gems_earned": gems_earned,
        "xp_boost_applied": boost_active,
        "created_at": now,
    })
    if gems_earned:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"gems": gems_earned}})
        await db.gem_transactions.insert_one({
            "user_id": str(user["_id"]),
            "delta": gems_earned,
            "reason": f"perfect_lesson_{payload.difficulty}",
            "created_at": now.isoformat(),
        })
    return {"xp_earned": xp_earned, "gems_earned": gems_earned, "xp_boost_applied": boost_active}


@api.post("/gems/grant")
async def gems_grant(payload: GemsAdjustIn, user: dict = Depends(get_token_user)):
    """Internal endpoint the frontend pings on perfect Quick-Fire / streak
    milestones. Hard-capped at +50 per call to prevent client tampering."""
    if payload.delta == 0:
        return {"gems": int(user.get("gems") or 0)}
    if payload.delta < -200 or payload.delta > 50:
        raise HTTPException(status_code=400, detail="Out-of-range gem adjustment")
    res = await db.users.find_one_and_update(
        {"_id": user["_id"]},
        {"$inc": {"gems": payload.delta}},
        return_document=True,
    )
    await db.gem_transactions.insert_one({
        "user_id": str(user["_id"]),
        "delta": payload.delta,
        "reason": payload.reason or "client_grant",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"gems": int((res or {}).get("gems") or 0)}


@api.get("/gems/history")
async def gems_history(user: dict = Depends(get_token_user), limit: int = 30):
    cur = db.gem_transactions.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).limit(min(limit, 100))
    return {"transactions": [t async for t in cur]}


# -------------------------------------------------------- SHOP
# Gem-priced consumables. Mirrored values live in frontend `/shop` page.
SHOP_ITEMS = {
    "xp_boost_30m":  {"cost": 50,  "duration_min": 30},
    "streak_freeze": {"cost": 100, "cap": 2},
}

# Gem packs — one-time Stripe checkouts. Values mirrored in frontend.
GEM_PACKS = {
    "pack_100":  {"gems": 100,  "amount_cad": 1.99},
    "pack_500":  {"gems": 500,  "amount_cad": 7.99},
    "pack_1200": {"gems": 1200, "amount_cad": 14.99},
}


@api.get("/shop/catalog")
async def shop_catalog(user: dict = Depends(get_token_user)):
    """Returns the current price/limits + user snapshot so the Shop UI can
    render disabled/enabled states and countdowns without guessing."""
    u = serialize_user(user)
    return {
        "items": SHOP_ITEMS,
        "gem_packs": GEM_PACKS,
        "user": {
            "gems": u["gems"],
            "xp_boost_until": u["xp_boost_until"],
            "xp_boost_active": u["xp_boost_active"],
            "xp_boost_seconds_left": u["xp_boost_seconds_left"],
            "streak_freezes": u["streak_freezes"],
        },
    }


@api.post("/shop/buy-xp-boost")
async def buy_xp_boost(user: dict = Depends(get_token_user)):
    item = SHOP_ITEMS["xp_boost_30m"]
    gems = int(user.get("gems") or 0)
    if gems < item["cost"]:
        raise HTTPException(status_code=400, detail=f"Not enough gems (need {item['cost']}, have {gems})")
    now = datetime.now(timezone.utc)
    cur_raw = user.get("xp_boost_until")
    cur_dt = None
    if isinstance(cur_raw, str):
        try:
            cur_dt = datetime.fromisoformat(cur_raw)
            if cur_dt.tzinfo is None:
                cur_dt = cur_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            cur_dt = None
    base = cur_dt if (cur_dt and cur_dt > now) else now
    new_until = base + timedelta(minutes=item["duration_min"])
    res = await db.users.find_one_and_update(
        {"_id": user["_id"], "gems": {"$gte": item["cost"]}},
        {"$inc": {"gems": -item["cost"]},
         "$set": {"xp_boost_until": new_until.isoformat()}},
        return_document=True,
    )
    if not res:
        # Lost the race (concurrent buy) — gems dropped below threshold.
        raise HTTPException(status_code=400, detail="Not enough gems")
    await db.gem_transactions.insert_one({
        "user_id": str(user["_id"]),
        "delta": -item["cost"],
        "reason": "shop_xp_boost_30m",
        "created_at": now.isoformat(),
    })
    return {
        "xp_boost_until": new_until.isoformat(),
        "gems": int(res.get("gems") or 0),
    }


@api.post("/shop/buy-streak-freeze")
async def buy_streak_freeze(user: dict = Depends(get_token_user)):
    item = SHOP_ITEMS["streak_freeze"]
    gems = int(user.get("gems") or 0)
    owned = int(user.get("streak_freezes") or 0)
    if owned >= item["cap"]:
        raise HTTPException(status_code=400, detail=f"Already holding the max ({item['cap']}) streak freezes")
    if gems < item["cost"]:
        raise HTTPException(status_code=400, detail=f"Not enough gems (need {item['cost']}, have {gems})")
    now = datetime.now(timezone.utc)
    res = await db.users.find_one_and_update(
        {"_id": user["_id"],
         "gems": {"$gte": item["cost"]},
         "$or": [{"streak_freezes": {"$exists": False}},
                 {"streak_freezes": {"$lt": item["cap"]}}]},
        {"$inc": {"gems": -item["cost"], "streak_freezes": 1}},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=400, detail="Purchase rejected")
    await db.gem_transactions.insert_one({
        "user_id": str(user["_id"]),
        "delta": -item["cost"],
        "reason": "shop_streak_freeze",
        "created_at": now.isoformat(),
    })
    return {
        "streak_freezes": int(res.get("streak_freezes") or 0),
        "gems": int(res.get("gems") or 0),
    }


@api.post("/streak/use-freeze")
async def use_streak_freeze(user: dict = Depends(get_token_user)):
    """Client-initiated when it detects a one-day gap and the user has a
    freeze. Idempotent-ish: we just decrement atomically; the client is
    expected to reset its local `dailyStreak.lastDate` to yesterday."""
    res = await db.users.find_one_and_update(
        {"_id": user["_id"], "streak_freezes": {"$gt": 0}},
        {"$inc": {"streak_freezes": -1}},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=400, detail="No streak freezes to use")
    return {"streak_freezes": int(res.get("streak_freezes") or 0)}


# -------------------------------------------------------- STRIPE GEM PACKS
@api.post("/stripe/gems-checkout")
async def stripe_gems_checkout(payload: dict, request: Request, user: dict = Depends(get_token_user)):
    """One-time checkout for a gem pack. Webhook credits the user on
    payment_intent.succeeded / checkout.session.completed."""
    pack_id = (payload.get("pack_id") or "").strip()
    origin = (payload.get("origin") or "").rstrip("/") or (FRONTEND_URL or "").rstrip("/")
    pack = GEM_PACKS.get(pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail="Unknown gem pack")
    await ensure_stripe()
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": "cad",
                    "unit_amount": int(round(pack["amount_cad"] * 100)),
                    "product_data": {
                        "name": f"{pack['gems']} Gems",
                        "description": "timestables.ca gem pack",
                    },
                },
            }],
            success_url=f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/billing/cancel",
            customer_email=user["email"],
            client_reference_id=str(user["_id"]),
            metadata={
                "user_id": str(user["_id"]),
                "kind": "gem_pack",
                "pack_id": pack_id,
                "gems": str(pack["gems"]),
            },
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:160]}")
    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "user_id": str(user["_id"]),
        "email": user["email"],
        "amount": pack["amount_cad"],
        "currency": "cad",
        "status": "pending",
        "payment_status": session.payment_status,
        "kind": "gem_pack",
        "pack_id": pack_id,
        "gems": pack["gems"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.id}


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


def _mask_stripe_for_admin(doc: dict) -> dict:
    """Return doc with `stripe_secret_key` swapped for a masked preview so the
    full live key is never re-shipped to the browser. The Admin UI uses the
    `stripe_secret_key_set` flag to render an "already-set" badge."""
    out = dict(doc)
    raw = (out.get("stripe_secret_key") or "").strip()
    out["stripe_secret_key_set"] = bool(raw)
    if raw:
        out["stripe_secret_key"] = ""  # never echo the real key back
        out["stripe_secret_key_preview"] = (
            raw[:7] + "…" + raw[-4:] if len(raw) > 14 else "set"
        )
    else:
        out["stripe_secret_key"] = ""
        out["stripe_secret_key_preview"] = ""
    return out


@api.get("/admin/cms")
async def admin_cms_get(_: dict = Depends(get_admin_user)):
    doc = await db.cms.find_one({"_id": "site"}) or {}
    doc.pop("_id", None)
    return _mask_stripe_for_admin(doc)


@api.put("/admin/cms")
async def admin_cms_put(body: CMSIn, _: dict = Depends(get_admin_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    # Only persist a Stripe key when admin actually typed a new one.
    if "stripe_secret_key" in upd:
        new_key = (upd["stripe_secret_key"] or "").strip()
        if not new_key:
            upd.pop("stripe_secret_key", None)  # blank == leave existing alone
        else:
            upd["stripe_secret_key"] = new_key
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.cms.update_one({"_id": "site"}, {"$set": upd}, upsert=True)
    doc = await db.cms.find_one({"_id": "site"}) or {}
    doc.pop("_id", None)
    return _mask_stripe_for_admin(doc)


# ------------------------------------------------------------------ MOUNT
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

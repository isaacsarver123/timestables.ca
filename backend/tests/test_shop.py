"""Shop & XP-Boost & Streak-Freeze & Stripe-gem-pack tests (v5.8).

Covers:
- /api/shop/catalog structure + user snapshot
- /api/shop/buy-xp-boost (insufficient gems 400, success debits 50, extends timer)
- /api/shop/buy-streak-freeze (increments, cap 2, atomic: no debit when capped)
- /api/streak/use-freeze (decrements, 400 at 0)
- /api/lessons/finish 2x XP when boost active, 1x when inactive
- /api/stripe/gems-checkout (400 bad pack, 503 when stripe not configured, 401 unauth)
- _credit_gem_pack_if_needed idempotency (direct Mongo atomic-flag test)
"""
import os
import re
import uuid
import time
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta

import pymongo
from bson import ObjectId

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://calc-arena-4.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "isaacsarver100@gmail.com"
ADMIN_PASSWORD = "Isabella0412!"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"


# ---------------- helpers ----------------
def _spoof_ip():
    return f"203.0.{uuid.uuid4().int % 254}.{(uuid.uuid4().int % 253) + 1}"


def _mongo():
    return pymongo.MongoClient(MONGO_URL)[DB_NAME]


def _reset_admin_shop_state(gems=1000, freezes=0, xp_boost_until=None):
    db = _mongo()
    db.users.update_one(
        {"email": ADMIN_EMAIL},
        {"$set": {
            "gems": gems,
            "streak_freezes": freezes,
            "xp_boost_until": xp_boost_until,
        }},
    )


@pytest.fixture
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def fresh_user_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_shop_{uuid.uuid4().hex[:8]}@timestables.ca"
    r = s.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "testpass123", "name": "ShopTester"},
        headers={"X-Forwarded-For": _spoof_ip()},
    )
    assert r.status_code == 200, r.text
    return s, email, r.json()["id"]


# ======================== CATALOG ========================
class TestShopCatalog:
    def test_catalog_shape_and_user_snapshot(self, admin_session):
        _reset_admin_shop_state(gems=250, freezes=1, xp_boost_until=None)
        r = admin_session.get(f"{BASE_URL}/api/shop/catalog")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "gem_packs" in data and "user" in data
        # Items
        assert data["items"]["xp_boost_30m"]["cost"] == 50
        assert data["items"]["xp_boost_30m"]["duration_min"] == 30
        assert data["items"]["streak_freeze"]["cost"] == 100
        assert data["items"]["streak_freeze"]["cap"] == 2
        # Gem packs
        assert data["gem_packs"]["pack_100"]["gems"] == 100
        assert abs(data["gem_packs"]["pack_100"]["amount_cad"] - 1.99) < 0.001
        assert data["gem_packs"]["pack_500"]["gems"] == 500
        assert abs(data["gem_packs"]["pack_500"]["amount_cad"] - 7.99) < 0.001
        assert data["gem_packs"]["pack_1200"]["gems"] == 1200
        assert abs(data["gem_packs"]["pack_1200"]["amount_cad"] - 14.99) < 0.001
        # User snapshot
        u = data["user"]
        for k in ("gems", "xp_boost_until", "xp_boost_active",
                  "xp_boost_seconds_left", "streak_freezes"):
            assert k in u
        assert u["gems"] == 250
        assert u["streak_freezes"] == 1
        assert u["xp_boost_active"] is False
        assert u["xp_boost_seconds_left"] == 0

    def test_catalog_requires_auth(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/shop/catalog")
        assert r.status_code == 401


# ======================== BUY XP BOOST ========================
class TestBuyXpBoost:
    def test_buy_xp_boost_insufficient_gems_400(self, fresh_user_session):
        s, email, _ = fresh_user_session
        # Fresh user has 0 gems
        r = s.post(f"{BASE_URL}/api/shop/buy-xp-boost")
        assert r.status_code == 400, r.text
        assert "not enough gems" in r.json().get("detail", "").lower()

    def test_buy_xp_boost_success_debits_50_and_sets_timer(self, admin_session):
        _reset_admin_shop_state(gems=1000, freezes=0, xp_boost_until=None)
        t0 = datetime.now(timezone.utc)
        r = admin_session.post(f"{BASE_URL}/api/shop/buy-xp-boost")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["gems"] == 950  # 1000 - 50
        until = datetime.fromisoformat(data["xp_boost_until"])
        delta_from_now = (until - t0).total_seconds()
        # ~30 min +/- 10s
        assert 30 * 60 - 15 <= delta_from_now <= 30 * 60 + 15, delta_from_now

        # Catalog reflects it
        r2 = admin_session.get(f"{BASE_URL}/api/shop/catalog")
        u = r2.json()["user"]
        assert u["gems"] == 950
        assert u["xp_boost_active"] is True
        assert 29 * 60 < u["xp_boost_seconds_left"] <= 30 * 60

    def test_buy_xp_boost_extends_timer_on_second_purchase(self, admin_session):
        _reset_admin_shop_state(gems=1000, freezes=0, xp_boost_until=None)
        # First buy
        r1 = admin_session.post(f"{BASE_URL}/api/shop/buy-xp-boost")
        assert r1.status_code == 200
        until1 = datetime.fromisoformat(r1.json()["xp_boost_until"])
        time.sleep(1)
        # Second buy — should extend by another 30 min from until1 (since until1 > now)
        r2 = admin_session.post(f"{BASE_URL}/api/shop/buy-xp-boost")
        assert r2.status_code == 200
        until2 = datetime.fromisoformat(r2.json()["xp_boost_until"])
        delta = (until2 - until1).total_seconds()
        assert 30 * 60 - 5 <= delta <= 30 * 60 + 5, f"Expected +30min extension, got {delta}s"
        assert r2.json()["gems"] == 900  # 1000 - 50 - 50


# ======================== BUY STREAK FREEZE ========================
class TestBuyStreakFreeze:
    def test_increment_then_cap(self, admin_session):
        _reset_admin_shop_state(gems=1000, freezes=0, xp_boost_until=None)
        # 1st
        r1 = admin_session.post(f"{BASE_URL}/api/shop/buy-streak-freeze")
        assert r1.status_code == 200, r1.text
        assert r1.json()["streak_freezes"] == 1
        assert r1.json()["gems"] == 900
        # 2nd
        r2 = admin_session.post(f"{BASE_URL}/api/shop/buy-streak-freeze")
        assert r2.status_code == 200, r2.text
        assert r2.json()["streak_freezes"] == 2
        assert r2.json()["gems"] == 800
        # 3rd — cap; atomic, no debit
        before = _mongo().users.find_one({"email": ADMIN_EMAIL})
        r3 = admin_session.post(f"{BASE_URL}/api/shop/buy-streak-freeze")
        assert r3.status_code == 400, r3.text
        detail = r3.json().get("detail", "").lower()
        assert "max" in detail and "2" in detail
        after = _mongo().users.find_one({"email": ADMIN_EMAIL})
        # Gems unchanged (atomic rejection)
        assert after["gems"] == before["gems"] == 800
        assert after["streak_freezes"] == 2

    def test_buy_streak_freeze_not_enough_gems(self, fresh_user_session):
        s, email, _ = fresh_user_session
        r = s.post(f"{BASE_URL}/api/shop/buy-streak-freeze")
        assert r.status_code == 400
        assert "not enough gems" in r.json().get("detail", "").lower()


# ======================== USE STREAK FREEZE ========================
class TestUseStreakFreeze:
    def test_decrement_until_zero_then_400(self, admin_session):
        _reset_admin_shop_state(gems=500, freezes=2, xp_boost_until=None)
        r1 = admin_session.post(f"{BASE_URL}/api/streak/use-freeze")
        assert r1.status_code == 200
        assert r1.json()["streak_freezes"] == 1
        r2 = admin_session.post(f"{BASE_URL}/api/streak/use-freeze")
        assert r2.status_code == 200
        assert r2.json()["streak_freezes"] == 0
        r3 = admin_session.post(f"{BASE_URL}/api/streak/use-freeze")
        assert r3.status_code == 400
        assert "no streak" in r3.json().get("detail", "").lower()


# ======================== LESSONS FINISH 2X ========================
class TestLessonsFinishBoost:
    def test_xp_doubled_when_boost_active(self, admin_session):
        # Activate boost via shop
        _reset_admin_shop_state(gems=500, freezes=0, xp_boost_until=None)
        rb = admin_session.post(f"{BASE_URL}/api/shop/buy-xp-boost")
        assert rb.status_code == 200

        payload = {
            "topics": [2],
            "difficulty": "easy",
            "questions_total": 10,
            "correct": 10,
            "hard_correct": 0,
            "seconds_taken": 45,
        }
        r = admin_session.post(f"{BASE_URL}/api/lessons/finish", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["xp_boost_applied"] is True
        boosted_xp = data["xp_earned"]
        assert boosted_xp > 0

        # Clear boost, compare
        _reset_admin_shop_state(gems=500, freezes=0, xp_boost_until=None)
        r2 = admin_session.post(f"{BASE_URL}/api/lessons/finish", json=payload)
        assert r2.status_code == 200
        data2 = r2.json()
        assert data2["xp_boost_applied"] is False
        base_xp = data2["xp_earned"]
        assert base_xp > 0
        assert boosted_xp == 2 * base_xp, f"Expected {2*base_xp} boosted, got {boosted_xp}"


# ======================== STRIPE GEM PACK CHECKOUT ========================
class TestStripeGemsCheckout:
    def test_unknown_pack_returns_400(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/stripe/gems-checkout",
                               json={"pack_id": "bogus_pack", "origin": BASE_URL})
        assert r.status_code == 400, r.text
        assert "unknown" in r.json().get("detail", "").lower() or "pack" in r.json().get("detail", "").lower()

    def test_valid_pack_no_stripe_returns_503(self, admin_session):
        # Stripe key is empty in env + CMS (per environment)
        r = admin_session.post(f"{BASE_URL}/api/stripe/gems-checkout",
                               json={"pack_id": "pack_100", "origin": BASE_URL})
        # Either 503 (no stripe configured) OR 200 (if admin pasted a real key)
        if r.status_code == 503:
            detail = r.json().get("detail", "").lower()
            assert "stripe" in detail
        elif r.status_code == 200:
            data = r.json()
            assert "url" in data and "session_id" in data
            # Verify tx row inserted with kind=gem_pack
            tx = _mongo().payment_transactions.find_one({"session_id": data["session_id"]})
            assert tx is not None
            assert tx.get("kind") == "gem_pack"
            assert tx.get("pack_id") == "pack_100"
            assert tx.get("gems") == 100
        else:
            pytest.fail(f"Unexpected status {r.status_code}: {r.text}")

    def test_unauthenticated_returns_401(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/stripe/gems-checkout",
                   json={"pack_id": "pack_100", "origin": BASE_URL})
        assert r.status_code == 401


# ======================== IDEMPOTENCY: _credit_gem_pack_if_needed ========================
class TestCreditGemPackIdempotency:
    """Simulates webhook/status replay by seeding a fake paid gem_pack tx and
    asserting the atomic 'gems_credited' flag only credits once."""

    def test_double_credit_no_op(self):
        db = _mongo()
        admin = db.users.find_one({"email": ADMIN_EMAIL})
        assert admin is not None
        admin_id = str(admin["_id"])

        # Reset admin gems to a known value
        db.users.update_one({"_id": admin["_id"]}, {"$set": {"gems": 0}})

        session_id = f"cs_test_idem_{uuid.uuid4().hex[:12]}"
        db.payment_transactions.insert_one({
            "session_id": session_id,
            "user_id": admin_id,
            "email": ADMIN_EMAIL,
            "amount": 1.99,
            "currency": "cad",
            "status": "complete",
            "payment_status": "paid",
            "kind": "gem_pack",
            "pack_id": "pack_100",
            "gems": 100,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        # Import and call the function directly twice.
        import sys
        sys.path.insert(0, "/app/backend")
        from server import _credit_gem_pack_if_needed  # type: ignore

        loop = asyncio.new_event_loop()
        try:
            credited1 = loop.run_until_complete(_credit_gem_pack_if_needed(session_id))
            credited2 = loop.run_until_complete(_credit_gem_pack_if_needed(session_id))
        finally:
            loop.close()

        assert credited1 == 100, f"First call should credit 100, got {credited1}"
        assert credited2 == 0, f"Second call should be no-op, got {credited2}"

        # Admin gems should now be 100, not 200
        admin2 = db.users.find_one({"_id": admin["_id"]})
        assert admin2["gems"] == 100, f"Expected gems=100, got {admin2['gems']}"

        # Cleanup
        db.payment_transactions.delete_one({"session_id": session_id})

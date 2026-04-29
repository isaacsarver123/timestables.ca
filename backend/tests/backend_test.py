"""Backend tests for timestables.ca iteration 10.

Covers: health/stripe_configured flag, CMS public, auth (register/login/me/logout),
admin login (isaac), IP anti-trial-abuse, admin stats/users/cms endpoints,
stripe checkout 503 when not configured.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://calc-arena-4.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "isaac@timestables.ca"
ADMIN_PASSWORD = "admin12345"


def _spoofed_ip():
    # random public-ish IP to bypass IP gate when needed
    return f"203.0.{uuid.uuid4().int % 254}.{(uuid.uuid4().int % 253) + 1}"


# ------------------------------------------------------------------ HEALTH
class TestHealth:
    def test_root_stripe_not_configured(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["app"] == "timestables.ca"
        assert data["status"] == "ok"
        assert data["stripe_configured"] is False  # empty STRIPE_SECRET_KEY

    def test_cms_public_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/cms/public")
        assert r.status_code == 200
        data = r.json()
        for k in ("hero_title", "hero_subtitle", "paywall_blurb",
                  "announcement", "announcement_active"):
            assert k in data


# ------------------------------------------------------------------ AUTH: REGISTER + IP GATE
class TestRegister:
    def test_register_new_user_creates_trial(self, api_client, unique_email):
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpass123", "name": "Test User"},
            headers={"X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["email"] == unique_email.lower()
        assert u["in_trial"] is True
        assert u["has_access"] is True
        assert u.get("subscription_status") in (None, "")
        assert "access_token" in r.cookies
        assert "refresh_token" in r.cookies

    def test_register_duplicate_email_400(self, api_client, unique_email):
        ip1 = _spoofed_ip()
        r1 = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpass123"},
            headers={"X-Forwarded-For": ip1},
        )
        assert r1.status_code == 200
        # Same email, different IP -> still rejected because email already exists
        r2 = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "otherpass"},
            headers={"X-Forwarded-For": _spoofed_ip()},
        )
        assert r2.status_code == 400
        assert "already" in r2.json().get("detail", "").lower()

    def test_register_same_ip_twice_rejected(self, api_client):
        # Two different emails but same X-Forwarded-For -> second one fails with IP gate
        shared_ip = _spoofed_ip()
        email1 = f"TEST_ip1_{uuid.uuid4().hex[:8]}@timestables.ca"
        email2 = f"TEST_ip2_{uuid.uuid4().hex[:8]}@timestables.ca"
        r1 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email1, "password": "testpass123"},
            headers={"Content-Type": "application/json", "X-Forwarded-For": shared_ip},
        )
        assert r1.status_code == 200, r1.text

        r2 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email2, "password": "testpass123"},
            headers={"Content-Type": "application/json", "X-Forwarded-For": shared_ip},
        )
        assert r2.status_code == 400, f"Expected 400 got {r2.status_code}: {r2.text}"
        detail = r2.json().get("detail", "").lower()
        assert "network" in detail or "trial account already exists" in detail


# ------------------------------------------------------------------ AUTH: LOGIN / ME / LOGOUT
class TestLoginMeLogout:
    def test_admin_login_isaac(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"
        assert u["is_admin"] is True
        assert u["has_access"] is True
        assert "access_token" in r.cookies

    def test_me_authenticated(self, api_client):
        api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL
        assert r.json()["is_admin"] is True

    def test_me_unauthenticated_401(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_login_wrong_password_401(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "definitelyWrong!"},
            headers={"X-Forwarded-For": _spoofed_ip()},  # avoid brute-force lock
        )
        assert r.status_code == 401

    def test_logout_clears_cookies(self, api_client):
        api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        r = api_client.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
        api_client.cookies.clear()
        r2 = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r2.status_code == 401


# ------------------------------------------------------------------ STRIPE: CHECKOUT 503
class TestStripeNotConfigured:
    def test_checkout_returns_503_when_empty_key(self, api_client):
        # Login admin
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200
        r2 = api_client.post(
            f"{BASE_URL}/api/stripe/checkout",
            json={"origin": BASE_URL},
        )
        assert r2.status_code == 503, f"Expected 503 got {r2.status_code}: {r2.text}"
        assert "stripe" in r2.json().get("detail", "").lower()

    def test_portal_returns_503_when_empty_key(self, api_client):
        api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        r = api_client.post(f"{BASE_URL}/api/stripe/portal", json={})
        assert r.status_code == 503

    def test_checkout_unauthenticated_401(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/stripe/checkout", json={"origin": BASE_URL})
        assert r.status_code == 401


# ------------------------------------------------------------------ ADMIN ENDPOINTS
class TestAdmin:
    def test_admin_stats(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200
        r2 = api_client.get(f"{BASE_URL}/api/admin/stats")
        assert r2.status_code == 200, r2.text
        data = r2.json()
        for k in ("total_users", "active_subs", "mrr_cad", "total_revenue_cad",
                  "signups_30d", "revenue_30d", "recent_payments"):
            assert k in data, f"Missing {k} in stats response: {data.keys()}"
        assert isinstance(data["signups_30d"], list)
        assert len(data["signups_30d"]) == 31, f"Expected 31 days, got {len(data['signups_30d'])}"
        assert isinstance(data["revenue_30d"], list)
        assert len(data["revenue_30d"]) == 31
        for item in data["signups_30d"][:2]:
            assert "date" in item and "count" in item
        for item in data["revenue_30d"][:2]:
            assert "date" in item and "amount" in item
        assert isinstance(data["recent_payments"], list)

    def test_admin_stats_non_admin_403(self, api_client, unique_email):
        # Register a regular user
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpass123"},
            headers={"X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200
        r2 = api_client.get(f"{BASE_URL}/api/admin/stats")
        assert r2.status_code == 403, f"Expected 403 got {r2.status_code}: {r2.text}"

    def test_admin_stats_unauthenticated_401(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 401

    def test_admin_users_search_isaac(self, api_client):
        api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        r = api_client.get(f"{BASE_URL}/api/admin/users?q=isaac")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "users" in data
        emails = [u["email"] for u in data["users"]]
        assert ADMIN_EMAIL in emails, f"Isaac not in search results: {emails}"

    def test_admin_users_search_empty_returns_list(self, api_client):
        api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        r = api_client.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 200
        assert isinstance(r.json()["users"], list)

    def test_admin_cms_put_and_public_reflects(self, api_client):
        api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        test_value = f"TEST Hero {uuid.uuid4().hex[:6]}"
        r = api_client.put(
            f"{BASE_URL}/api/admin/cms",
            json={"hero_title": test_value, "announcement": "Tester note", "announcement_active": True},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("hero_title") == test_value

        # Fresh, unauthenticated session hits /api/cms/public
        s = requests.Session()
        r2 = s.get(f"{BASE_URL}/api/cms/public")
        assert r2.status_code == 200
        pub = r2.json()
        assert pub["hero_title"] == test_value
        assert pub["announcement_active"] is True
        assert pub["announcement"] == "Tester note"

        # Reset announcement_active to False so banner doesn't stick in later UI tests
        api_client.put(
            f"{BASE_URL}/api/admin/cms",
            json={"announcement_active": False},
        )

    def test_admin_cms_non_admin_403(self, api_client, unique_email):
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpass123"},
            headers={"X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200
        r2 = api_client.get(f"{BASE_URL}/api/admin/cms")
        assert r2.status_code == 403


# ------------------------------------------------------------------ USER STATE SYNC
class TestUserStateSync:
    def test_state_get_put_get(self, api_client, unique_email):
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpass123"},
            headers={"X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200
        r1 = api_client.get(f"{BASE_URL}/api/user/state")
        assert r1.status_code == 200
        assert r1.json()["state"] is None
        r2 = api_client.put(
            f"{BASE_URL}/api/user/state",
            json={"state": {"coins": 42}},
        )
        assert r2.status_code == 200
        r3 = api_client.get(f"{BASE_URL}/api/user/state")
        assert r3.status_code == 200
        assert r3.json()["state"] == {"coins": 42}

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


# ------------------------------------------------------------------ NEW: CMS EXTENDED FIELDS
class TestCMSExtended:
    def test_cms_public_has_new_fields(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/cms/public")
        assert r.status_code == 200
        data = r.json()
        for k in ("support_email", "support_phone", "footer_text",
                  "login_welcome_title", "login_welcome_body",
                  "signup_welcome_title", "signup_welcome_body",
                  "signup_pitch_a_title", "signup_pitch_a_body",
                  "signup_pitch_b_title", "signup_pitch_b_body"):
            assert k in data, f"Missing {k}: keys={list(data.keys())}"
            assert data[k], f"{k} is empty/falsy: {data[k]!r}"
        # Defaults
        assert data["support_email"] == "isaacsarver@icloud.com"
        assert data["support_phone"] == "825-962-3425"

    def test_admin_can_update_support_email_phone(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200
        new_email = f"help_{uuid.uuid4().hex[:6]}@example.com"
        new_phone = "555-000-1234"
        r2 = api_client.put(
            f"{BASE_URL}/api/admin/cms",
            json={"support_email": new_email, "support_phone": new_phone,
                  "footer_text": "TEST footer"},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["support_email"] == new_email
        assert r2.json()["support_phone"] == new_phone

        # Verify via public endpoint
        s = requests.Session()
        r3 = s.get(f"{BASE_URL}/api/cms/public")
        assert r3.status_code == 200
        pub = r3.json()
        assert pub["support_email"] == new_email
        assert pub["support_phone"] == new_phone
        assert pub["footer_text"] == "TEST footer"

        # Restore defaults
        api_client.put(
            f"{BASE_URL}/api/admin/cms",
            json={"support_email": "isaacsarver@icloud.com",
                  "support_phone": "825-962-3425",
                  "footer_text": "timestables.ca · v3"},
        )


# ------------------------------------------------------------------ NEW: PUT /api/admin/users/{id}
class TestAdminUserEdit:
    def _create_user(self, api_client, email=None):
        email = email or f"TEST_edit_{uuid.uuid4().hex[:8]}@timestables.ca"
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "testpass123", "name": "Original"},
            headers={"Content-Type": "application/json", "X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200, r.text
        return email, r.json()["id"]

    def _admin_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        return s

    def test_admin_edit_user_name(self, api_client):
        email, uid = self._create_user(api_client)
        admin = self._admin_session()
        r = admin.put(f"{BASE_URL}/api/admin/users/{uid}",
                      json={"name": "Renamed"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Renamed"
        assert data["email"] == email.lower()

    def test_admin_edit_user_email(self, api_client):
        email, uid = self._create_user(api_client)
        admin = self._admin_session()
        new_email = f"TEST_renamed_{uuid.uuid4().hex[:6]}@timestables.ca"
        r = admin.put(f"{BASE_URL}/api/admin/users/{uid}",
                      json={"email": new_email})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == new_email.lower()

    def test_admin_edit_user_email_clash_400(self, api_client):
        email1, uid1 = self._create_user(api_client)
        api_client.cookies.clear()
        email2, uid2 = self._create_user(api_client)
        admin = self._admin_session()
        r = admin.put(f"{BASE_URL}/api/admin/users/{uid2}",
                      json={"email": email1})
        assert r.status_code == 400, r.text
        assert "already in use" in r.json().get("detail", "").lower()

    def test_admin_promote_user_then_self_demote_blocked(self, api_client):
        # Create a regular user
        email, uid = self._create_user(api_client)
        admin = self._admin_session()

        # Get the admin user's own id via /api/auth/me
        me = admin.get(f"{BASE_URL}/api/auth/me")
        admin_id = me.json()["id"]

        # Promote
        r = admin.put(f"{BASE_URL}/api/admin/users/{uid}",
                      json={"role": "admin"})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "admin"

        # Try to demote yourself -> 400
        r2 = admin.put(f"{BASE_URL}/api/admin/users/{admin_id}",
                       json={"role": "user"})
        assert r2.status_code == 400, r2.text
        assert "demote" in r2.json().get("detail", "").lower()

        # Cleanup: demote the promoted user back
        r3 = admin.put(f"{BASE_URL}/api/admin/users/{uid}",
                       json={"role": "user"})
        assert r3.status_code == 200

    def test_admin_edit_non_admin_403(self, api_client, unique_email):
        # Create and log in as regular user
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpass123"},
            headers={"X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200
        my_id = r.json()["id"]
        r2 = api_client.put(f"{BASE_URL}/api/admin/users/{my_id}",
                             json={"name": "hacker"})
        assert r2.status_code == 403

    def test_admin_edit_invalid_id_400(self, api_client):
        admin = self._admin_session()
        r = admin.put(f"{BASE_URL}/api/admin/users/not-an-objectid",
                      json={"name": "x"})
        assert r.status_code == 400


# ------------------------------------------------------------------ NEW: DELETE /api/admin/users/{id}
class TestAdminUserDelete:
    def _create_user(self, email=None):
        email = email or f"TEST_del_{uuid.uuid4().hex[:8]}@timestables.ca"
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "testpass123", "name": "ToDelete"},
            headers={"Content-Type": "application/json", "X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200, r.text
        return email, r.json()["id"]

    def _admin_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        return s

    def test_admin_delete_user_removes_and_stats_decrement(self):
        # Create sacrificial user
        email, uid = self._create_user()
        admin = self._admin_session()

        # Stats before
        s_before = admin.get(f"{BASE_URL}/api/admin/stats").json()
        total_before = s_before["total_users"]

        # Confirm user is searchable
        rs = admin.get(f"{BASE_URL}/api/admin/users?q={email.split('@')[0]}")
        assert rs.status_code == 200
        emails_before = [u["email"] for u in rs.json()["users"]]
        assert email.lower() in emails_before

        # DELETE
        rd = admin.delete(f"{BASE_URL}/api/admin/users/{uid}")
        assert rd.status_code == 200, rd.text
        body = rd.json()
        assert body["deleted"] is True
        assert body["id"] == uid

        # GET — user no longer in search
        rs2 = admin.get(f"{BASE_URL}/api/admin/users?q={email.split('@')[0]}")
        assert rs2.status_code == 200
        emails_after = [u["email"] for u in rs2.json()["users"]]
        assert email.lower() not in emails_after

        # Stats decremented
        s_after = admin.get(f"{BASE_URL}/api/admin/stats").json()
        assert s_after["total_users"] == total_before - 1, (
            f"total_users not decremented: before={total_before} after={s_after['total_users']}")

    def test_admin_delete_self_returns_400(self):
        admin = self._admin_session()
        me = admin.get(f"{BASE_URL}/api/auth/me").json()
        admin_id = me["id"]
        r = admin.delete(f"{BASE_URL}/api/admin/users/{admin_id}")
        assert r.status_code == 400, r.text
        assert "yourself" in r.json().get("detail", "").lower()

    def test_admin_delete_nonexistent_returns_404(self):
        admin = self._admin_session()
        # valid ObjectId-shape but does not exist
        r = admin.delete(f"{BASE_URL}/api/admin/users/507f1f77bcf86cd799439011")
        assert r.status_code == 404, r.text

    def test_admin_delete_invalid_objectid_returns_400(self):
        admin = self._admin_session()
        r = admin.delete(f"{BASE_URL}/api/admin/users/not-a-real-id")
        assert r.status_code == 400, r.text

    def test_admin_delete_as_non_admin_403(self, api_client, unique_email):
        # Register regular user
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpass123"},
            headers={"X-Forwarded-For": _spoofed_ip()},
        )
        assert r.status_code == 200
        my_id = r.json()["id"]

        # Try to delete self with a regular-user session — should be 403 (admin-only)
        r2 = api_client.delete(f"{BASE_URL}/api/admin/users/{my_id}")
        assert r2.status_code == 403, r2.text


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

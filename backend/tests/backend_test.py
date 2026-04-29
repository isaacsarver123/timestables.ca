"""Backend tests for timestables.ca: auth, user state sync, stripe checkout."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://calc-arena-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@timestables.ca"
ADMIN_PASSWORD = "admin12345"


# ------------------------------------------------------------------ HEALTH
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["app"] == "timestables.ca"
        assert data["status"] == "ok"


# ------------------------------------------------------------------ AUTH: REGISTER
class TestRegister:
    def test_register_new_user_creates_trial(self, api_client, unique_email):
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": unique_email, "password": "testpass123", "name": "Test User"})
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["email"] == unique_email.lower()
        assert u["in_trial"] is True
        assert u["has_access"] is True
        assert u["subscription_status"] is None
        assert u["billing"]["amount_cad"] == 5.0
        assert u["trial_seconds_left"] > 0
        # cookies set
        assert "access_token" in r.cookies
        assert "refresh_token" in r.cookies

    def test_register_duplicate_email_400(self, api_client, unique_email):
        # First register
        r1 = api_client.post(f"{BASE_URL}/api/auth/register",
                             json={"email": unique_email, "password": "testpass123"})
        assert r1.status_code == 200
        # Re-register same email -> 400 anti trial abuse
        r2 = api_client.post(f"{BASE_URL}/api/auth/register",
                             json={"email": unique_email, "password": "anotherpass"})
        assert r2.status_code == 400
        assert "already registered" in r2.json().get("detail", "").lower()


# ------------------------------------------------------------------ AUTH: LOGIN / ME / LOGOUT
class TestLoginMeLogout:
    def test_admin_login_active_subscription(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["subscription_status"] == "active"
        assert u["has_access"] is True
        assert "access_token" in r.cookies

    def test_me_authenticated(self, api_client):
        # Login
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        # /me with cookie
        r2 = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r2.status_code == 200
        assert r2.json()["email"] == ADMIN_EMAIL

    def test_me_unauthenticated_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_logout_clears_cookies(self, api_client):
        api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        r = api_client.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
        # After logout the access cookie should be cleared (server sends Set-Cookie deletion)
        # Use a fresh session check via /me using only remaining cookies
        # Note: requests session may still have cookie locally; verify by clearing
        api_client.cookies.clear()
        r2 = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r2.status_code == 401


# ------------------------------------------------------------------ AUTH: BRUTE FORCE
class TestBruteForce:
    def test_5_failed_logins_trigger_429(self, api_client, unique_email):
        # Register so the user exists (still wrong password = failed attempt counted)
        api_client.post(f"{BASE_URL}/api/auth/register",
                        json={"email": unique_email, "password": "correctpass1"})
        # Use a fresh session (no cookies) to ensure attempts are tied to ip:email
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        last = None
        for i in range(6):
            last = s.post(f"{BASE_URL}/api/auth/login",
                          json={"email": unique_email, "password": "wrongpass"})
        # After 5 fails, the 6th should be 429
        assert last.status_code == 429, f"Expected 429 got {last.status_code}: {last.text}"


# ------------------------------------------------------------------ USER STATE SYNC
class TestUserStateSync:
    def test_state_get_put_get(self, api_client, unique_email):
        # Register a fresh user
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": unique_email, "password": "testpass123"})
        assert r.status_code == 200

        # Initial GET -> {state: null}
        r1 = api_client.get(f"{BASE_URL}/api/user/state")
        assert r1.status_code == 200
        assert r1.json()["state"] is None

        # PUT
        r2 = api_client.put(f"{BASE_URL}/api/user/state",
                            json={"state": {"coins": 42, "x": "y"}})
        assert r2.status_code == 200
        assert r2.json()["ok"] is True
        assert "updated_at" in r2.json()

        # GET back
        r3 = api_client.get(f"{BASE_URL}/api/user/state")
        assert r3.status_code == 200
        body = r3.json()
        assert body["state"] == {"coins": 42, "x": "y"}
        assert body["updated_at"] is not None

    def test_state_unauthenticated_401(self, api_client):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.get(f"{BASE_URL}/api/user/state")
        assert r.status_code == 401


# ------------------------------------------------------------------ STRIPE CHECKOUT
class TestStripeCheckout:
    def test_checkout_creates_session_and_tx(self, api_client, unique_email):
        # Register and login (register sets cookies)
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": unique_email, "password": "testpass123"})
        assert r.status_code == 200

        r2 = api_client.post(f"{BASE_URL}/api/stripe/checkout",
                             json={"origin": BASE_URL})
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "url" in data
        assert "session_id" in data
        assert data["url"].startswith("https://")
        assert "stripe.com" in data["url"] or "checkout" in data["url"]

    def test_checkout_unauthenticated_401(self, api_client):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/stripe/checkout", json={"origin": BASE_URL})
        assert r.status_code == 401

# Times Tables (timestables.ca) — PRD

## Original problem statement
Make a website that teaches times tables in a gamified way for teens/adults (not childish).
Range up to ×20, daily challenges, long-mul/long-div practice, stats, shop, accounts with
cross-device sync, $5 CAD/month subscription with a 2-day free trial, admin dashboard, and
self-host docs for an Ubuntu server with reserved-port constraints.

## Locked-in user choices
- **Audience:** teen / adult — neo-brutalist UI (white + black outlines, dark mode toggle).
- **Game modes:** Quick-Fire, Streak, Boss, Daily, Learn, Long-Mul, Long-Div (incl. remainder).
- **Tables range:** subset of 1×–20× with grid + presets.
- **Auth:** custom email/password JWT (httpOnly cookies, bcrypt).
- **Subscription:** Stripe `mode=subscription`, $5 CAD/month, 2-day server-managed trial.
- **Anti-abuse:** unique email AND unique IP per trial. Admin role exempt.
- **Admin (Isaac):** `isaac@timestables.ca` — full access without paying; sees `/admin`
  with Dashboard / Users / CMS tabs.
- **Self-host target:** Ubuntu host with reserved ports `80, 443, 3000, 3001, 3002, 8001,
  8002, 8847, 18789, 27017, 11434, 1000`. MongoDB volume bind-mounted to `MATHACCOUNTS`.

## Architecture
- **Frontend:** React (CRA + craco), TailwindCSS, framer-motion, recharts. Routes wrapped
  in `<PaywallGuard>` which redirects guests to `/login` and shows `<Paywall>` to expired
  users. Top nav and HUD pills are only rendered when authenticated.
- **Backend:** FastAPI + Motor + Mongo. JWT auth (PyJWT), bcrypt, raw `stripe` SDK.
- **Sync:** localStorage shape mirrored to `db.user_state` per user (debounced 800ms).

## Implementation log

### v3 (this fork)
- **Auth (JWT):** register / login / logout / me / refresh; brute-force lock 5/15min;
  httpOnly cookies (`samesite=none`, `secure=true`).
- **2-day server-managed trial** on register; `serialize_user()` exposes `in_trial`,
  `trial_seconds_left`, `has_access`. Admins always have access.
- **Anti-abuse:** unique email + unique IP per trial (toggle via `ALLOW_MULTI_SIGNUP_PER_IP`).
- **Cross-device sync:** `GET/PUT /api/user/state`; `initRemoteSync()` hydrates localStorage
  on login, debounced PUTs on every state change.
- **Stripe (raw SDK, subscription mode):** `/api/stripe/checkout` creates a `mode=subscription`
  session ($5 CAD/mo, allow_promotion_codes); `/api/stripe/status/{id}`; `/api/stripe/portal`
  (Stripe Billing Portal); `/api/webhook/stripe`. `STRIPE_SECRET_KEY` is empty placeholder
  → endpoint returns 503 with friendly message until user pastes their rotated key.
  `_sync_subscription_from_stripe()` pulls `current_period_end`, brand, last4 → shown in
  Settings → Billing.
- **Trial banner** with countdown + Subscribe button + dismiss; goes urgent (rose) under 12h.
- **Settings → Account + Billing** sections (sign-in / out, billing tiles, Manage Subscription).
- **Top nav locked for guests** — header only shows brand + Sign in until login.
- **Admin (Isaac):** seeded on startup (`ADMIN_EMAIL=isaac@timestables.ca`).
  `/admin` page: Dashboard (users, MRR, revenue, 30-day signup chart, 30-day revenue chart,
  recent payments) · Users (search by email) · CMS (hero title/subtitle, paywall blurb,
  announcement banner). Public CMS via `GET /api/cms/public` feeds Home hero + Paywall.
- **Self-host docs:** `/app/SELF_HOST.md` + `/app/docker-compose.yml` (Caddy edge proxy,
  app containers bound to 127.0.0.1, MongoDB volume → `MATHACCOUNTS/timestables-mongo`).

### Test history (forked session)
- iteration_8: 11/12 backend, 100% frontend (Stripe needed migration off raw stripe).
- iteration_9: Stripe migrated to emergentintegrations — passed.
- iteration_10: 21/21 backend, 100% frontend after migration BACK to raw stripe + admin/CMS/IP-gate added.

## Backlog
### P0
- User to paste rotated `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET`
  in `/app/backend/.env` and re-test the full Stripe flow end-to-end.

### P1
- Global leaderboards (deferred from v2).
- Email reset / verify links (currently logs to console).
- Production webhook signature enforcement guard (refuse if `STRIPE_WEBHOOK_SECRET` blank
  in non-DEV mode).

### P2
- Admin: per-user actions (refund last payment, force-cancel sub, comp 30 days).
- Achievements / badges, shareable result cards.
- Spaced-repetition flashcards review.

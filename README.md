# timestables.ca

Gamified multiplication & division practice for **teens and adults** — Duolingo-style
1005-lesson zig-zag path, Brilliant-style interactive visualizers, daily streaks,
gems and coins economy, profiles, friends, and a $5 CAD/month subscription with a
2-day free trial.

> **Live:** [timestables.ca](https://timestables.ca)
> **Stack:** React (CRA + craco) · FastAPI · MongoDB · Stripe · TailwindCSS · framer-motion
> **Audience:** teen / adult — neo-brutalist UI (white + black outlines, dark mode toggle)

---

## Table of contents
1. [Features](#features)
2. [Quick start](#quick-start)
3. [Architecture](#architecture)
4. [Project layout](#project-layout)
5. [Environment variables](#environment-variables)
6. [API reference](#api-reference)
7. [Game modes](#game-modes)
8. [Data model](#data-model)
9. [Self-hosting](#self-hosting)
10. [Admin](#admin)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)
13. [Contributing](#contributing)
14. [Roadmap](#roadmap)
15. [License](#license)

---

## Features

### Practice
- **Lesson path** — 67 levels × 15 lessons = **1005 total**. Difficulty ramps
  continuously from `×2/×5/×10` factor-≤ 5 (Beginner) up to mixed Grand Master
  factor ≤ 25.
- **Quick-Fire** — fast-paced timed mode.
- **Streak** — answer-as-many-in-a-row.
- **Boss** — escalating boss levels with rewards.
- **Daily Challenge** — fresh question set every day; counts toward the daily streak.
- **Long Multiplication / Long Division** — multi-digit pencil-and-paper style.
- **Learn** — typed tip cards (TRICK / RULE / PATTERN / ANCHOR / FORMULA).

### Gamification
- **XP, levels, coins, gems** — dual-currency economy.
- **Daily streak** with milestone gem rewards (1, 3, 7, 14, 25, 50, 100, 200, 365 days).
- **Universal completion celebration** — XP count-up + streak fire-lit reveal +
  gem-milestone badge. Drop-in component (`<CompletionCelebration>`) used by every mode.
- **Powerup shop** — Extra Time, Skip, Freeze, Coin Doubler.
  *XP Boost (50 gems) and Streak Freeze (100 gems, cap 2) coming next — see `HANDOFF.md`.*
- **Jump-here mechanic** — 20-Q / 5-heart calibrated test-out. Pass to skip every
  prior lesson and unlock the target level.

### Social
- **Profile** with avatar editor, public stats, `@username`, bio, privacy toggle.
- **Friends** — follow/unfollow, friend suggestions, public profile pages at `/u/:username`.

### Account & billing
- **JWT auth** — email/password, bcrypt, httpOnly cookies, brute-force lock
  (5 fails / 15 min per `IP:email`).
- **2-day free trial** automatically on registration; no card required.
- **Stripe subscription** at $5 CAD/month after trial (`mode=subscription`).
- **Cross-device sync** — localStorage state mirrors to `db.user_state` per user,
  debounced 800ms.
- **Anti-abuse** — one trial per IP unless `ALLOW_MULTI_SIGNUP_PER_IP=1`.
- **Admin dashboard** with users / CMS / live stats / 30-day charts / recent payments.

---

## Quick start

Services are managed by **supervisor** in this Kubernetes-hosted preview environment.

```bash
# Restart backend (after .env or dependency change)
sudo supervisorctl restart backend
tail -n 100 /var/log/supervisor/backend.err.log

# Restart frontend
sudo supervisorctl restart frontend

# API smoke test
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -s "$API/api/" | python3 -m json.tool
```

For self-hosted deploys, see [Self-hosting](#self-hosting) below and `OPS_HANDOFF.md`.

---

## Architecture

```
React (CRA + craco)
        │
        │  axios (withCredentials, /auth/refresh on 401)
        ▼
FastAPI on :8001  ──►  Stripe (raw SDK, subscription mode)
        │
        ▼
MongoDB (Motor async)
  ├─ users               (auth, gems, avatar, subscription)
  ├─ user_state          (cross-device localStorage mirror)
  ├─ lesson_runs         (history of every finished lesson)
  ├─ gem_transactions    (audit log for gem grants/spends)
  ├─ payment_transactions
  ├─ login_attempts      (brute-force counter)
  ├─ follows             (compound unique [follower, following])
  └─ cms                 (single doc `_id: "site"`)
```

### Auth flow
1. `POST /api/auth/register` or `/api/auth/login` → backend sets two `httpOnly`
   cookies: `access_token` (60min) + `refresh_token` (14d).
2. Every API request from the browser includes both cookies (`withCredentials`).
3. On 401, the axios interceptor in `lib/api.js` calls `POST /api/auth/refresh`
   once, then retries the original request. Returning users with a stale access
   token but a valid refresh cookie stay signed in.

### State sync
- localStorage is the canonical source on the client (`tt_arena_state_v2` key).
- On boot / login, `initRemoteSync()` GETs `/api/user/state`. If found, it
  hydrates localStorage. If not, it pushes the local state up.
- Every `saveState` schedules a debounced (800ms) PUT to `/api/user/state`.
- `_id` is never returned from any Mongo find/aggregate; we use Pydantic
  response shapes to stay JSON-clean.

---

## Project layout

```
backend/
  server.py                    # 1093 lines — auth, stripe, admin, profile, lessons, gems
  .env
  requirements.txt
  tests/                       # add pytest fixtures here for regressions
frontend/
  src/
    components/
      Layout.jsx               # header, HUD pills, footer
      LessonQuestion.jsx       # interactive visualizers
      LessonLoading.jsx        # 4.5s splash with random tip
      CompletionCelebration.jsx
      PaywallGuard.jsx
      TrialBanner.jsx
      ConfirmLeaveModal.jsx
      Question.jsx             # typed-input question (used in Quick-Fire etc.)
      ui/                      # shadcn primitives (button, popover, dialog, …)
    pages/
      Home.jsx
      Lessons.jsx              # the 1005-lesson zig-zag + jump-here engine
      QuickFire.jsx
      Streak.jsx
      Boss.jsx
      Daily.jsx
      LongMul.jsx
      LongDiv.jsx
      Learn.jsx
      Stats.jsx
      Shop.jsx
      Settings.jsx
      Profile.jsx · ProfileAvatar.jsx · UserProfile.jsx
      Admin.jsx
      Login.jsx · Register.jsx
      BillingSuccess.jsx · BillingCancel.jsx
    lib/
      api.js                   # axios instance, 401 → /auth/refresh interceptor
      auth.jsx                 # AuthProvider + useAuth()
      storage.js               # localStorage state + remote sync (debounced 800ms)
      game.js                  # question generation + table tips
      lessonPath.js            # 1005-lesson generator (deterministic)
      lessonTips.js            # 163 "did you know" tips
      cms.js                   # public-CMS cache + getFlashMs()
      sound.js                 # SFX
      leaveGuard.js            # useNavGuard + ConfirmLeaveModal
  .env                         # REACT_APP_BACKEND_URL only
memory/
  PRD.md                       # implementation log + backlog (v3 → v5.6)
  test_credentials.md          # admin creds + endpoint cheatsheet
HANDOFF.md                     # snapshot for the next dev/agent
OPS_HANDOFF.md                 # ops/sysadmin runbook
README.md
SELF_HOST.md                   # condensed Ubuntu/Caddy recipe
docker-compose.yml             # MongoDB + app stack with Caddy edge proxy
```

---

## Environment variables

### `/app/backend/.env`
Protected — do **not** rename keys. Missing required keys cause boot failure
(intentional: fail fast).

| Key | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGO_URL` | yes | — | MongoDB connection string |
| `DB_NAME` | yes | — | Database name |
| `JWT_SECRET` | yes | — | HS256 signing key for access + refresh tokens |
| `ADMIN_EMAIL` | no | `isaacsarver100@gmail.com` | Seeded on every backend boot |
| `ADMIN_PASSWORD` | no | `Isabella0412!` | Re-hashed if it doesn't match the stored hash |
| `ADMIN_NAME` | no | `Isaac` | Display name for admin |
| `STRIPE_SECRET_KEY` | no | empty | `.env` fallback. CMS-stored key takes precedence |
| `STRIPE_WEBHOOK_SECRET` | no | empty | If blank, signature check is skipped (dev only) |
| `FRONTEND_URL` | no | `http://localhost:3000` | CORS allow + Stripe redirects |
| `SUBSCRIPTION_PRICE_CAD` | no | `5.00` | Subscription price |
| `TRIAL_DAYS` | no | `2` | Free-trial length |
| `ALLOW_MULTI_SIGNUP_PER_IP` | no | `0` | `1` to disable IP gating (testing) |

### `/app/frontend/.env`
Only one variable. The frontend bakes this into the static bundle at build time.

| Key | Required | Purpose |
| --- | --- | --- |
| `REACT_APP_BACKEND_URL` | yes | Public URL the browser hits (no trailing slash) |

---

## API reference

All routes are prefixed with `/api`. Auth-required routes need both
`access_token` and `refresh_token` cookies (or `Authorization: Bearer <jwt>`).

### Health / public
| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/` | — | `{ app, status, stripe_configured }` |
| GET | `/api/cms/public` | — | Site content (Stripe key stripped) |

### Auth
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{email, password, name?}` | Sets cookies. Rejects duplicate email AND duplicate IP |
| POST | `/api/auth/login` | `{email, password}` | Brute-force lock 5/15min |
| POST | `/api/auth/logout` | — | Clears cookies |
| GET | `/api/auth/me` | — | User shape (see [Data model](#data-model)) |
| POST | `/api/auth/refresh` | — | New access cookie if refresh is valid |

### User state sync (auth required)
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/user/state` | — | `{state, updated_at}` or `{state:null,...}` |
| PUT | `/api/user/state` | `{state}` | Upsert per user |

### Stripe (auth required)
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/stripe/checkout` | `{origin}` | Returns `{url, session_id}` |
| GET | `/api/stripe/status/{session_id}` | — | Mirrors session payment status |
| POST | `/api/stripe/portal` | `{origin}` | Stripe Billing Portal URL |
| POST | `/api/webhook/stripe` | Stripe event | Signature-verified if secret set |

### Profiles & friends (auth required)
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| PUT | `/api/profile` | `{name?, bio?, is_private?, username?, avatar?}` | Username 3–20 chars `[a-z0-9_]`, unique |
| GET | `/api/profile/me` | — | Self profile + follow counts + email |
| GET | `/api/u/{username}` | — | Public profile + `am_following` |
| POST | `/api/u/{username}/follow` | — | Idempotent follow |
| DELETE | `/api/u/{username}/follow` | — | Idempotent unfollow |
| GET | `/api/profile/suggestions?limit=` | — | Users you don't follow yet |
| GET | `/api/profile/search?q=` | — | Username + name regex |

### Gameplay (auth required)
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/lessons/finish` | `{topics, difficulty, questions_total, correct, hard_correct?, seconds_taken?}` | Returns `{xp_earned, gems_earned}` |
| POST | `/api/gems/grant` | `{delta, reason?}` | `delta` clamped to `[-200, +50]` |
| GET | `/api/gems/history?limit=` | — | Last N transactions |

### Admin (admin role required)
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/stats` | — | Users, MRR, revenue, 30-day charts, recent payments |
| GET | `/api/admin/users?q=&limit=` | — | Email-substring search |
| PUT | `/api/admin/users/{user_id}` | `{email?, name?, role?}` | Can't demote self |
| DELETE | `/api/admin/users/{user_id}` | — | Cascades user_state, payments, login_attempts |
| GET | `/api/admin/cms` | — | Full CMS doc; Stripe key masked back |
| PUT | `/api/admin/cms` | `CMSIn` | Empty `stripe_secret_key` is treated as no-change |

### Common errors
| HTTP | When |
| --- | --- |
| 400 | Validation, duplicate username, duplicate IP on signup |
| 401 | Missing / invalid token; `/auth/me` skips the refresh interceptor |
| 403 | Role mismatch (admin-only route), private profile |
| 429 | Brute-force lock (5 fails / 15 min) |
| 502 | Stripe SDK error |
| 503 | Stripe not configured |

---

## Game modes

Every mode flows through the same XP / streak / completion plumbing:
- `recordAnswer({a, b, op, correct, ms})` for per-table stats.
- `addCoinsAndXp(coins, xp)` for HUD ticks.
- `markCompletedActivityToday()` for the universal daily streak.

| Mode | Route | Question count | XP source |
| --- | --- | --- | --- |
| Quick-Fire | `/play/quickfire` | timed (60s default) | Per-correct + completion bonus |
| Streak | `/play/streak` | until first wrong | Per-correct |
| Boss | `/play/boss` | escalating | Per-correct + boss-clear bonus |
| Daily | `/play/daily` | 10 fixed | Per-correct + first-of-day bonus |
| Lesson | `/lessons/play/:lesson` | 20 (17 base + 3 hard) | `15 + 3*diff` × accuracy × 1.6 + 25 perfect bonus |
| Long Mul / Div | `/play/longmul`, `/play/longdiv` | per-step | Step-correct + final-correct |
| Test-out | from `Lessons` page | 20 / 5 hearts | Flat 30 (lesson) or 80 (level) |
| Learn | `/learn` | open-ended | Light XP per tip explored |

---

## Data model

`serialize_user(doc)` is the canonical shape returned by every auth-touching
endpoint. It computes derived fields server-side so the client never has to
re-implement trial / sub access logic.

```json
{
  "id": "65e…",
  "email": "user@example.com",
  "name": "User",
  "role": "user",                          // "user" | "admin"
  "trial_start": "2026-02-01T12:00:00+00:00",
  "trial_end":   "2026-02-03T12:00:00+00:00",
  "trial_seconds_left": 0,
  "in_trial": false,
  "has_access": true,
  "is_admin": false,
  "subscription_status": "active",         // active | trialing | past_due | canceled | null
  "gems": 42,
  "username": "user_handle",
  "bio": "…",
  "is_private": false,
  "avatar": { "...": "..." },
  "created_at": "2026-01-15T10:00:00+00:00",
  "billing": {
    "current_period_end": "2026-03-01T00:00:00+00:00",
    "cancel_at_period_end": false,
    "last4": "4242",
    "brand": "visa",
    "amount_cad": 5.00,
    "interval": "month"
  }
}
```

### Collections at a glance
- **users** — auth, role, profile, gems, subscription, signup IP.
- **user_state** — `{user_id, state, updated_at}` localStorage mirror.
- **lesson_runs** — `{user_id, topics, difficulty, questions_total, correct, hard_correct, seconds_taken, xp_earned, gems_earned, created_at}`.
- **gem_transactions** — `{user_id, delta, reason, created_at}` audit log.
- **payment_transactions** — `{session_id, user_id, email, amount, currency, status, payment_status, created_at, completed_at}`.
- **login_attempts** — `{identifier (ip:email), ts}` for brute-force limiting.
- **follows** — `{follower_id, following_id, created_at}` (compound unique).
- **cms** — single doc at `_id: "site"` with every editable string + Stripe key.

### Indexes (created on backend startup)
- `users.email` (unique), `users.signup_ip`, `users.username` (unique partial).
- `payment_transactions.session_id` (unique).
- `user_state.user_id` (unique).
- `login_attempts.identifier`.
- `follows.{follower_id, following_id}` (unique compound), `follows.following_id`.

---

## Self-hosting

Two recipes:

### A) Docker Compose (recommended)
See **`SELF_HOST.md`** for the short version, or **`OPS_HANDOFF.md`** for the
full operations manual.

The host this app targets reserves the following ports:
```
80, 443, 3000, 3001, 3002, 8001, 8002, 8847, 18789, 27017, 11434, 1000
```
None of our containers expose any of those. Public traffic enters Caddy on
`:8443` (configurable via `EDGE_PORT`); everything else binds to `127.0.0.1`
on alternative ports (`37017` for Mongo, `38001` for backend, `33000` for
frontend).

### B) systemd / no-Docker
1. `apt install python3.11 python3-pip nodejs yarn nginx mongodb`.
2. Create a `timestables` system user.
3. Run backend with `gunicorn -k uvicorn.workers.UvicornWorker server:app -b 127.0.0.1:38001`.
4. `yarn build` the frontend; serve `frontend/build` from nginx.
5. Front the whole stack with Caddy or nginx on `:8443`.

The Docker path is significantly easier to keep secure and reproducible.

---

## Admin

Admin credentials are seeded on backend startup from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`. The admin role:
- Bypasses the trial / paywall (always `has_access: true`).
- Sees `/admin` with three tabs:
  - **Dashboard** — total users, active subs, MRR, total revenue, 30-day signup
    + revenue line charts, recent payments table.
  - **Users** — search by email substring, edit role / email / name, delete
    (with cascades).
  - **CMS** — every visible string editable + the Stripe Secret Key field.
- Hot-rotates Stripe keys without a redeploy: paste the rotated key in
  Admin → CMS → Save. Done. Key is masked on read-back (`sk_live_…WXYZ`) and
  stripped from `/api/cms/public` entirely.

A legacy admin (`isaac@timestables.ca`) is auto-deleted on backend startup so
we never end up with two admins simultaneously.

---

## Testing

### Smoke test (anyone can run this)
```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -fsS "$API/api/" | python3 -m json.tool

# Login as admin
COOKIE=$(mktemp)
curl -fsS -c $COOKIE -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"isaacsarver100@gmail.com","password":"Isabella0412!"}' \
  | python3 -m json.tool

# Hit /me with the cookie
curl -fsS -b $COOKIE "$API/api/auth/me" | python3 -m json.tool
rm -f $COOKIE
```

### Automated suite
Backend + frontend regressions run via the **testing agent** harness
(see `/app/test_reports/` for past iterations). Latest pass: iteration 10
(21/21 backend, 100% frontend). For new features, add pytest cases under
`/app/backend/tests/` and call the testing agent after meaningful changes.

### Conventions
- Every interactive element carries a `data-testid` (kebab-case, function-named).
- New endpoints add a row to the [API reference](#api-reference) and a
  smoke-test snippet in the PR description.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `503 Stripe not configured` on checkout | CMS + `.env` keys both empty | Sign in as admin → Admin → CMS → paste a Stripe Secret Key |
| 401 loop after login | Refresh cookie not being sent (CORS) | Verify `FRONTEND_URL` matches the actual browser URL exactly (incl. port) |
| `429 Too many failed attempts` | Brute-force lock kicked in | Wait 15 min, or trim `db.login_attempts` (see `OPS_HANDOFF.md` §7.5) |
| Backend boot crashes on `KeyError` | Missing required env var | Check `MONGO_URL`, `DB_NAME`, `JWT_SECRET` are all set |
| Frontend builds but API calls fail | `REACT_APP_BACKEND_URL` baked in at build time | Rebuild after changing it |
| Streak resets unexpectedly | Local clock drift across devices | Backend uses UTC; ensure host time is `ntpsync`'d |
| Admin password rotation didn't apply | Seed runs on backend boot | `sudo supervisorctl restart backend` (or `docker compose restart backend`) |
| Lesson popover overlap / flicker (legacy) | Old hover-popover bug | Fixed in latest — uses Radix Popover (portal-based) |

For deeper ops issues (disk full, Stripe webhooks failing, OOM), see
**`OPS_HANDOFF.md`** § 7 "Incident runbooks".

---

## Contributing

This is a personal project; PRs from outside collaborators aren't accepted.
For internal contributors:

1. Branch from `main`. Never commit `.env` or any `sk_…` Stripe key.
2. Read `HANDOFF.md` first — it lists what's in flight.
3. Match existing conventions:
   - Backend: Pydantic models for I/O, `serialize_user()` for any user shape.
   - Mongo: never return `_id` (project it out, use a Pydantic response shape).
   - Frontend: shadcn primitives in `components/ui/` first; named exports for
     components, default exports for pages.
   - Add a `data-testid` to every interactive element.
4. Keep `server.py` from growing — refactor into `routes/` modules when it crosses
   1200 lines.
5. After medium / large changes, run the testing agent. Update
   `memory/PRD.md` with what shipped.

---

## Roadmap

### Top of the queue
1. **Shop XP Boost & Streak Freeze** (50/100 gems, freeze cap 2). Spec in `HANDOFF.md`.
2. **Stripe Gems Purchase** wired through Admin → CMS Stripe key.
3. **Leaderboard + Leagues** (Bronze → Obsidian, weekly Mon 00:00 UTC reset, top 5
   promote / bottom 5 demote, top 3 rewards 30/20/10 gems).

### Soon
- Achievements system (badges for streaks, questions answered, perfect Quick-Fires).
- Practice history per-day heatmap in Settings.
- Refactor `server.py` into `routes/` modules before adding leagues.

### Later
- Daily reminder emails (Resend / SendGrid).
- Expanded Avatar builder with richer SVG asset library.
- High-contrast theme variants, per-effect sound toggles.
- CSV export per-day practice history.
- Spaced-repetition flashcard review.

Full backlog (with locked-in spec details) lives in `memory/PRD.md`.

---

## License

Proprietary. © Isaac Sarver / timestables.ca. All rights reserved.

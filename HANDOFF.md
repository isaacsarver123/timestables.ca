# timestables.ca — Handoff Document

> Snapshot for the next agent / session. Last updated: Feb 2026.

## TL;DR
A full-stack (React + FastAPI + MongoDB) gamified math practice app for teens/adults.
JWT auth, Stripe subscription paywall ($5 CAD/month after a 2-day trial), Duolingo-style
1005-lesson zig-zag path, gems + coins economy, profiles, friends, admin CMS.
**Mobile-responsive. Source-of-truth is MongoDB; localStorage mirrors per-user state.**

## Where we are right now

### ✅ Recently shipped (this round)
- **1005 lessons across 67 levels** (`lib/lessonPath.js`) on a centered zig-zag.
- **Brilliant-style interactive visualizers** (clusters, dot grid, draggable number-line).
- **Universal completion celebration** — animated XP count-up + streak fire-lit reveal +
  gem-milestone badge. Drop-in component (`<CompletionCelebration>`) used by every mode.
- **150+ "Did you know" tip pool** (`lib/lessonTips.js`) on a 4500ms loading splash.
- **Continuous difficulty ramp** — every level index materially harder than the last.
- **Jump-here mechanic** — 20-Q/5-heart calibrated test-out per lesson and per level.
- **Streak indicator** lives on the right side of the hero (single row, no wrap).
- **CMS-driven Stripe key** — admins paste a rotated `sk_live_…` directly in
  Admin → CMS. Backend resolves CMS first, falls back to `.env`. Public CMS strips it.
- **Admin rotated** to `isaacsarver100@gmail.com`. Legacy `isaac@timestables.ca` is
  auto-deleted on backend startup.
- **`addCoinsAndXp` accepts a multiplier** (so XP boost can 2× for 30 min — backend
  hooks pending; see "In progress").

### ✅ Last working item — popover overlap **FIXED**
Replaced the bespoke hover popover with **Radix Popover**
(`@/components/ui/popover`). Now:
- Portals the popover to `<body>` → no possible overlap with neighbouring zig-zag
  nodes (escapes the parent's bounding box).
- Click-to-open (no hover flicker; fixed the "popover dies before you can click
  Jump-here" bug).
- Collision-detected sides (auto-flips top/bottom if no space).
- DONE / NEXT-UP UNLOCKED nodes click straight through to start/practice — no
  popover needed.
- LOCKED nodes show the popover with a "Jump here" CTA.

**Pulsing "next-up" ring fix:** the amber halo was rendered at `inset-0` (same
size as the button) so it was hidden behind the dark zinc circle. Now at
`-inset-2` with a slightly bigger pulse range (1.18×) so the halo is clearly
visible *around* the node.

### 🟠 Top of the queue — Shop XP Boost & Streak Freeze (deferred 4+ times)
User explicitly requested these in messages 215, 373, 406, 507. Not started.

**Pricing (locked in):** XP Boost = **50 gems**, Streak Freeze = **100 gems**, freeze cap = **2**.

#### Spec
**XP Boost (30 min)**
- Backend: add `xp_boost_until` (ISO datetime) to user doc. Surface in
  `serialize_user()`.
- Endpoint: `POST /api/shop/buy-xp-boost` → spend 50 gems, set `xp_boost_until =
  max(now, current) + 30min` (extends if already active). Reject if gems < 50.
- Apply 2× multiplier in `/api/lessons/finish` when active.
- Frontend: store `xp_boost_until` mirror in localStorage (so QuickFire / Streak
  XP can also 2×). `addCoinsAndXp` already accepts a `multiplier` arg — wire it.
- HUD badge in `Layout.jsx` next to gems pill: small purple pill with `Sparkles`
  icon + countdown timer ("2× · 12:30").

**Streak Freeze**
- Backend: add `streak_freezes` (int, 0-2) to user doc.
- Endpoint: `POST /api/shop/buy-streak-freeze` → spend 100 gems, increment freezes
  (max 2). Reject if at cap or gems < 100.
- Endpoint: `POST /api/streak/use-freeze` → decrement freezes by 1.
- Frontend: in `storage.js`, before/inside `markCompletedActivityToday`, check if
  the streak's `lastDate` is exactly **two** days ago AND the user has freezes.
  If so, call `/api/streak/use-freeze` and patch local `dailyStreak.lastDate =
  yesterdayStr()` so the streak survives.
- Auto-run the same check on app boot inside `initRemoteSync` (catches users who
  return after a missed day without doing a lesson).
- Shop tile shows "Owned · N / 2" + Buy button.
- Streak HUD pill should show a tiny snowflake count badge if freezes > 0.

### 🟡 Next-up after Shop
- **Stripe Gems Purchase** — wire existing UI to Stripe Checkout using the CMS
  placeholder key.
- **Leaderboard + Leagues** (Bronze → Obsidian, weekly Mon 00:00 UTC reset, top 5
  promote / bottom 5 demote, top 3 rewards 30/20/10 gems).
- **Achievements** — badges (first 100 questions, 7-day streak, perfect QuickFire,
  etc.). Detect client-side, show on profile.
- **Practice history per-day heatmap** in Settings.
- **Refactor `server.py`** (1093 lines, monolithic). Split into
  `routes/{auth,stripe,admin,profile,lessons,gems,shop}.py` before adding leagues.

### 🟢 Future / backlog
- Daily reminder emails (Resend or SendGrid key needed).
- Expanded avatar builder (richer SVG asset library).
- High-contrast theme variants, per-effect sound toggles.
- CSV export per-day practice history.

## Architecture

```
/app/
├── backend/
│   ├── server.py          # 1093 lines: auth, stripe, admin, cms, profile, lessons, gems
│   ├── .env               # MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_*, STRIPE_*, FRONTEND_URL
│   ├── requirements.txt
│   └── tests/             # (empty — add pytest fixtures here for regressions)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx              # header, HUD pills, footer
│   │   │   ├── LessonQuestion.jsx      # interactive visualizers
│   │   │   ├── LessonLoading.jsx       # 4.5s splash with random tip
│   │   │   ├── CompletionCelebration.jsx
│   │   │   ├── PaywallGuard.jsx
│   │   │   ├── TrialBanner.jsx
│   │   │   └── ui/                     # shadcn primitives (incl. popover.tsx)
│   │   ├── pages/        # Home, Lessons, QuickFire, Streak, Boss, Daily, LongMul,
│   │   │                 #  LongDiv, Learn, Stats, Shop, Settings, Profile, Admin,
│   │   │                 #  Login, Register, Billing*
│   │   └── lib/
│   │       ├── api.js          # axios instance, 401 → /auth/refresh interceptor
│   │       ├── auth.jsx        # AuthProvider + useAuth()
│   │       ├── storage.js      # localStorage state + remote sync (debounced 800ms)
│   │       ├── game.js         # question generation
│   │       ├── lessonPath.js   # 1005-lesson generator
│   │       ├── lessonTips.js   # 163 "did you know" tips
│   │       └── cms.js          # public-CMS cache
│   └── .env                # REACT_APP_BACKEND_URL only
├── memory/
│   ├── PRD.md              # full implementation log + backlog
│   └── test_credentials.md # admin creds + endpoint cheatsheet
├── HANDOFF.md              # ← you are here
├── README.md
└── SELF_HOST.md            # Ubuntu/Caddy/MongoDB/no-Docker recipes
```

## Key conventions
- **All backend routes prefixed `/api`** — KubeIngress routes those to FastAPI on `:8001`.
- **Frontend uses `process.env.REACT_APP_BACKEND_URL`** — never hardcode.
- **Cookies:** `samesite=none; secure=true; httpOnly`. Auth via httpOnly access (60min)
  + refresh (14d) cookies. Auto-refresh on 401 via axios interceptor.
- **Mongo:** never return `_id`. `serialize_user(doc)` is the canonical user shape.
- **Hot reload is on** — supervisor restart only after `.env` or dependency changes.
- **`data-testid` on every interactive element** (kebab-case, function-descriptive).

## Critical environment vars (do not delete)
- `backend/.env` → `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
  `ADMIN_NAME`, `STRIPE_SECRET_KEY` (placeholder, CMS overrides), `STRIPE_WEBHOOK_SECRET`,
  `FRONTEND_URL`, `SUBSCRIPTION_PRICE_CAD`, `TRIAL_DAYS`, `ALLOW_MULTI_SIGNUP_PER_IP`.
- `frontend/.env` → `REACT_APP_BACKEND_URL` (production preview URL).

## Test credentials
See `/app/memory/test_credentials.md`. Admin: `isaacsarver100@gmail.com` / `Isabella0412!`.

## How to run locally
Backend (auto-managed by supervisor):
```bash
sudo supervisorctl restart backend
tail -f /var/log/supervisor/backend.err.log
```

Frontend (also supervisor-managed):
```bash
sudo supervisorctl restart frontend
```

Quick API smoke test:
```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -s "$API/api/" | python3 -m json.tool
```

## Known gotchas
- **Popover overlap bug** — see "Last working item" above.
- **Stripe key is empty by default** — `/api/stripe/checkout` returns 503 with a
  friendly message until an admin pastes a key in Admin → CMS.
- **One trial per IP** — set `ALLOW_MULTI_SIGNUP_PER_IP=1` in `backend/.env` for
  automated testing, otherwise a second registration from the same IP is rejected.
- **`server.py` is monolithic** — refactor before adding leagues/achievements.

## Last 5 user messages (in order)
1. Image: popover from a left-offset lesson bleeding over right-offset lesson below.
2. Streak indicator should look distinct, popover bounding boxes shouldn't jump.
3. "Continue" button flow instead of auto-checking; remove slider for long division.
4. Popover positioning + pull streak indicator halfway left.
5. **(THIS MESSAGE)** Popover still overlaps + button doesn't work + popover
   disappears on hover. Asked for handoff doc + README update first.

## Files to start with on next session
1. `/app/frontend/src/pages/Lessons.jsx` (lines 920-1182) — popover logic.
2. `/app/frontend/src/components/ui/popover.tsx` — drop-in shadcn alternative.
3. `/app/backend/server.py` — for shop endpoints (search "GEMS" section ~ line 875).
4. `/app/frontend/src/lib/storage.js` — XP multiplier + streak-freeze hook.
5. `/app/frontend/src/pages/Shop.jsx` — UI for XP Boost + Streak Freeze tiles.

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

### v5.1 — Lesson Path + CMS-driven Stripe + UX polish (this round)
- **Admin credentials rotated** to `isaacsarver100@gmail.com` / `Isabella0412!`. Backend startup now also auto-deletes the legacy `isaac@timestables.ca` admin so we never end up with two admins.
- **Duolingo-style Lesson Path** on `/lessons`: 4 themed units (Foundations / Division / Long Mult. / Long Div.) totalling 14 nodes laid out in a curved zig-zag. Sequential unlock, animated pulse on the next-up node, completion check-marks, locked padlocks, square boss nodes with a trophy. Progress persists to `localStorage` (`tt_lesson_path_v1`). The previous topic+difficulty selector is now a collapsible **Custom lesson** section below the path.
- **Per-question countdown timer removed** from Lessons — completion (not speed) is the bar.
- **"All" topic button removed** from the custom-lesson selector.
- **CMS-editable wrong-answer flash duration** (`wrong_answer_flash_ms`, default 3000ms). New `lib/cms.js` cache + `getFlashMs()` helper consumed by Quick-Fire / Streak / Boss / Daily so the green "Answer was X" reveal duration is now site-wide tunable from Admin.
- **CMS-driven Stripe key**: admins can paste their rotated `sk_live_…` / `sk_test_…` directly into Admin → CMS. Backend resolves the key dynamically via `_resolve_stripe_key()` (CMS first, `.env` fallback) and assigns `stripe.api_key` per-call via the new `await ensure_stripe()`. The full key is never echoed back to the browser — admin GET returns `stripe_secret_key=""` plus `stripe_secret_key_set: bool` and a masked preview (`sk_live_…WXYZ`). The public `/api/cms/public` strips the field entirely. Empty PUT preserves the existing key.
- **HUD coins + gems pills** are now `<Link to="/shop">` with hover-lift and matching colour treatments — single tap from anywhere into the Shop.
- **Footer auto-stamps to current build**: CMS now stores `app_version` (`v5`) and `footer_text` (`timestables.ca · v5`). Backend startup migrates any old `· v3` / `· v4` value forward so the footer stays accurate every release.
- **Emergent badge removed** from `index.html`. Page title set to `timestables.ca · practice multiplication & division`.
- **Signup pitch fixed**: "We charge $5 — flat" → "We charge **$5 a month** — flat" so the recurring nature is unambiguous.

### v5 — Lessons + Gems + Profile/Friends (prior round)
- **Lessons mode** (`/lessons`):
  - Lobby with topic multi-select (Multiplication / Division / Long Mult. / Long Div.) and "All" toggle (selecting "All" overrides others; tap again to clear).
  - 20 questions full-screen, top progress bar, 3 hard-question dots.
  - Per-question timer ≈ 0.75× Quick-Fire pace (9/6/4 s by difficulty).
  - **Duolingo-style wrong-answer card:** "No, this isn't the answer. Here's why: …" pulled from typed `tableTips()` (trick or formula), Continue button to advance.
  - End screen with correct/total, accuracy %, hard-Q tally, **XP and gems earned**, Perfect bonus banner, "New lesson"/"Home".
  - **Quit-confirm modal** specific to lessons: "Your XP is saved, but you won't get the perfect-lesson bonus."
  - Backend: `POST /api/lessons/finish` computes XP (15 + 3×diff) × accuracy × 1.6 + 25 perfect bonus; +5 gems on perfect. `db.lesson_runs` history collection.
- **Gems** (earn-only this round):
  - `db.users.gems` integer, surfaced in `/api/auth/me` and the new HUD pill (cyan diamond).
  - +5 gems on perfect lesson, +N via `POST /api/gems/grant {delta, reason}` (server-validated, capped at +50 per call).
  - `db.gem_transactions` ledger, `GET /api/gems/history`.
- **Profile system** (`/profile`):
  - Public-facing Duolingo-style page: purple gradient header, big avatar (clickable → editor), name, `@username`, bio, Following/Followers stats, **Add Friends** button.
  - Edit profile modal (name / username / bio / private toggle).
  - Friend Suggestions list under the header (auto-populated with public users you don't already follow).
  - **Avatar editor** (`/profile/avatar`): tabs Body · Background · Hair · Hair Color · Expression · Glasses · Hat. Each tab shows option grid with live-preview avatars. Randomize button. Save → `PUT /api/profile {avatar}`.
  - **Other-user profile** (`/u/:username`): same purple header + Follow/Unfollow button + locked view for private accounts.
  - Backend: `GET /api/profile/me`, `PUT /api/profile`, `GET /api/u/{username}`, `POST/DELETE /api/u/{username}/follow`, `GET /api/profile/suggestions`, `GET /api/profile/search?q=`. `db.follows` collection (compound unique index follower_id+following_id). Username 3–20 chars `[a-z0-9_]`, unique.
- **Wrong-answer flash fix** (carried over from v4.1): smoother enter, fixed exit, sits in a clear emerald card for ~2 seconds typed-mode in QuickFire / Streak / Boss / Daily, no longer feels glitchy.
- **Brand stack tightened** to `leading-[0.95]`.
- **Hero CMS reset** (`TEST Hero …` cleared once more).
- **Level math safe** — verified up to 9999 with display cap on the HUD pill; underlying Number stays exact through 2^53.

### v4.1 — Mobile + UX polish (prior)
- **Mobile responsiveness pass:** Settings, Admin Users + Recent Payments rows wrap cleanly at 390px wide (tested via testing agent — no horizontal scroll).
- **QuickFire end-screen:** "Time" + "UP." inline, same colour, "UP." pops big → shrinks (`time-up-up` testid).
- **Wrong-answer reveal:** Question component now flashes the correct number with a bouncy scale on wrong-typed answers (`wrong-answer-reveal`). Wired in QuickFire / Streak / Boss / Daily.
- **Confirm-on-leave:** new `useNavGuard` hook + `<ConfirmLeaveModal>` ("Oh no — don't leave!"). Wired into all four game-mode Exit buttons + `beforeunload`.
- **CardOnFile:** new component with inline SVG brand logos for Visa, Mastercard, Amex, Discover, JCB, Diners, UnionPay. Replaces the small "Card on file" tile on the active-subscription panel and adds a "$5.00 CAD will be charged to your **brand** ending in 1234 each month" copy line.
- **Settings cleanup:** Import removed; "Need help?" moved to bottom as plain underlined text links (mailto/tel) — no button styling.
- **Admin: delete user** — `DELETE /api/admin/users/{id}` with cascades (user_state, payment_transactions, login_attempts) + last-admin and self-delete guards. UI delete confirm modal with "Are you sure you want to delete?".
- **Learn tips refactor:** typed entries `{kind, text}` rendered with category pills (TRICK/RULE/PATTERN/ANCHOR/FORMULA, colour-coded). Content unchanged but presentation is far cleaner.
- **Streak combo persistence:** verified — combo only resets on a wrong answer or restart, not between questions.
- Tests: **100%** pass, 34/34 backend + all runtime-testable frontend items.

### v3 (prior)
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

### v5 — explicitly queued for the next round (locked-in spec)
**Gameplay**
- **Lessons mode** — 20 questions, full-screen like Quick-Fire, top progress bar, 3 hard-question dots beside it on the right. Topic multi-select (multiplication, division, long-mul, long-div) — picking "All" unselects the others and runs everything. XP reward proportional to economy. Duolingo-style explanation when wrong: "no, this isn't the answer — here's why".
- **Per-question timer × 0.75** of current Quick-Fire pace.
- **Streak freeze** (gem-priced, ice-block icon). Cancels perfect streaks if you miss. Streak section shows `1/2 equipped` + streak calendar.
- **Streak calendar** with **connected bars** for perfect-streak days (4+ in a row, no misses) instead of yellow dots; isolated done-days still get yellow circles.
- **XP boost** in Shop with quantity badge + Use button beside Buy on the same card.
- **Practice history per day** in Settings (replaces JSON export).

**Currency / store**
- **Gems** as a second currency. Earn from perfect rounds, day-streak milestones, leaderboard top 3. Buy-gems UI shipped with graceful 503 until Stripe key is set.
- **Card-on-file display** already shipped — gem-purchase confirmation will reuse the same component + "charged to your **brand** ending in 1234".

**Social**
- **Profiles** — avatar (initials → full builder later), public stats, achievements list. **Privacy toggle** (private profiles can't be added).
- **Friends** — friend-code-based add (TT-XXXXX), list, remove. Friends visible on profile + future leaderboard.
- **Achievements** — badges (first 100 questions, 7-day streak, perfect Quick-Fire, etc.) detected client-side, shown on profile.
- **Leaderboard** + **Leagues** — Bronze → Silver → Gold → Sapphire → Ruby → Diamond → Obsidian, weekly Mon 00:00 UTC reset, top 5 promote / bottom 5 demote, top 3 rewards 30/20/10 gems.

**Content / CMS**
- **Shopify-grade CMS** — every visible string editable + free-form key/value editor. **Stripe key field at the top of the editor** (writes through to backend env).
- **Daily reminder email** ("your streak's at risk!") — needs Resend or SendGrid key.

**Ops**
- Extended SELF_HOST.md: install on Ubuntu **alongside other services**, Caddy config that coexists with whatever's on :80/:443, **systemd no-Docker alternative**, backup script.

### P2
- High-contrast theme variants
- Sound on/off per-effect
- Practice history CSV export per-day

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

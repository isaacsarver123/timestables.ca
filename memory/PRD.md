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

### v5.7 — Lesson flow overhaul + Learn polish + global nav-guard (this round)
- **Two-phase answer flow** (`LessonQuestion.jsx`): tap a tile → SELECT (blue outline, uncommitted), then tap CHECK → commit. Correct answers: emerald flash + ~900ms auto-advance. Wrong answers: red flash + parent's explanation card (`setStatus('reviewing')`). Critically, a correct answer NEVER flashes red first.
- **End-of-lesson fanfare** — new `sfx.fanfare()` (Web-Audio brass triad run C5→E5→G5, then sustained C/E/G + C6 shimmer). Fires on `CompletionCelebration` mount. XP count-up slowed 950ms → **2400ms** with a `sfx.tick()` chime on each of ~7 buckets for rising drama.
- **Red challenge dot on wrong** — `hardResults[]` array now tracks per-challenge outcome. Dot 0/1/2 is emerald on correct, `bg-rose-500` on wrong, `surface-2` before the question is reached.
- **Completed-only shadow** — LessonNode's `brut-shadow-sm` now only renders when `done`. Next-up and locked nodes are flat so the eye is drawn only to completions.
- **Auto-scroll to current lesson** — when `/lessons` lobby mounts, scrolls the current next-up node into view (block:center) so returning users don't start at Level-1 Lesson-1 every time.
- **Radix Popover** for locked lesson nodes — portaled to `<body>`, collision-detected, click-triggered. Eliminates the recurring hover-overlap + Jump-here-unreachable bug.
- **Pulsing next-up ring** moved to `-inset-2` with 1.18× scale so the amber halo is visible OUTSIDE the button instead of hidden behind it.
- **Dot-visualizer polish** — `PUSH_FORCE = 0.6` (was 2.5, ~1/4 of previous motion). Added `pad = dotR + 4` to every SVG viewBox so dots can't clip at the box edges.
- **Global nav-guard during a lesson** — `lib/leaveGuard.js` now uses a module-level subscriber pattern (works with BrowserRouter, doesn't need createBrowserRouter). Every top-nav Link in `Layout.jsx` routes through `requestGuardedNav(path, () => navigate(path))` so Home / Stats / Shop / Profile all prompt the same `ConfirmLeaveModal` while a lesson is running.
- **Learn presets** — `/learn` table picker now has five one-tap chips: `2–5`, `2–10`, `2–12`, `1–20`, `Tough` (6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 19).
- **Learn table view** — `SingleTable` renders its 12 rows in a 2-column grid (6+6) so users don't have to scroll up and down when multiple tables are selected.
- **Flashcards single "Next" button** — removed Missed/Knew pair. One emerald Next button, plus a Shuffle action. Deck is now always shuffled even for a single-table pick.
- **Nicer tips** for ×7, ×8, ×9, ×10, ×11, ×12, ×13, ×16, ×17 — replaced terse one-liners with proper explanations + worked examples. The ×7 card now has four distinct strategies instead of the opaque "six-three is seven-nine" riddle.
- **Backend `wrong_answer_flash_ms` default** lowered **3000 → 1500 ms**, with an auto-migration on boot for any CMS doc still holding the old 3000 value.

### v5.6 — Lesson visual fixes + challenge structure (prior round)
- **Fixed the "10 dots became 1 giant circle" bug** — `motion.circle` with animated `cx`/`cy` was unreliable in SVG. Replaced with `motion.g` + `transform: translate(x, y)` for the cursor-react motion; underlying `<circle>` keeps static `cx`/`cy` attributes so all dots always render at distinct positions.
- **Auto-transposing layouts** — when `rows > cols * 1.6`, GroupedDots and DotGrid swap dimensions so a 10×3 multiplication renders as a wide 3×10 grid that fits the 5/4 canvas (no clipping).
- **Tightened motion** — repulsion force reduced from 7 → 2.5 px and range from 2.5× to 1.6× cell-width, so dots no longer feel hyperactive.
- **Local correctness for instant flash** — `LessonQuestion` now computes `localCorrect = chosen === answer` from its own state, so the slot/tile flash green/rose immediately on click. No more "stays white, doesn't advance" race.
- **Challenge questions structure** — `BASE_QUESTIONS = 17`, `HARD_DOTS = 3`. Progress bar tracks the first 17; on the last 3, an amber "Challenge question N / 3" banner appears above the question. Hard-dots redesigned as tiny `w-3 h-3 brut-border` rectangles (matching the bar style), emerald-500 when filled.
- **Streak indicator pushed to far right** of the hero row with `ml-auto`, no longer crowds the title.
- **Popover overlap fix** — the lesson-node popover keeps its top-spacing as internal padding (`paddingTop: 12`) instead of an external `mt-5`, so the parent's hover hit-area extends seamlessly to the popover. No more "popover disappears when mouse moves toward Jump-here".

### v5.5 — Lesson visual polish + draggable interactives + ... (prior round)
- **Capped visual canvas** at `max-w-sm aspect-[5/4] max-h-[40vh]` so tiny values like 2×1 / 2×2 render proportionally — no more screen-filling single-block bug.
- **Removed the dashed green outline ring** from clusters; replaced with a subtle 8%-opacity rounded backdrop tile. No more visual confusion.
- **Cursor-react dot grid** — dots within ~2.5 cell-widths of the pointer spring away gently (max ~7px push) for a tactile "alive" feel.
- **Draggable number-line** for division: pointer-down/move/up, snaps to integer ticks, releasing at the correct dividend auto-submits the answer.
- **Header collapsed to a single 66px row** at 1280px+ — pills tightened (px-1.5/py-1, smaller icons), level pill dropped (redundant with Stats), user name pushed to xl+, no flex-wrap.
- **Home streak relocated inline** beside the hero ("Practice multiplication and division." + compact STREAK · N pill on the right at desktop, stacked on mobile).
- **Lesson play UI fits the viewport** (`h-[calc(100dvh-180px)] flex flex-col -my-4 sm:-my-6`) — verified at 1280×900: scrollHeight === innerHeight, no scroll.
- **Visual variety wired**: dotGrid / stackedBars / clusters (multiplication) · numberLine (draggable) / divGroups (division) · bigNumber fallback. Variant picked deterministically from `q.key`.

### v5.3 — Real difficulty progression + Jump-here UX + Universal streaks (prior round)
- **Header overflow fix** — HUD pills now wrap to a second row when the screen runs out of width (`flex-wrap justify-end`), and coin/gem counts compact at scale: 0–9999 show with locale commas (`1,029`), 10k–999k as `123k`, ≥1m as `1.2m`. Level pill + user-name span pushed to `lg+` breakpoints so mid-width devices stay clean. The header no longer bleeds past the viewport at any zoom level.
- **150+ tip pool** (`lib/lessonTips.js`) — 163 hand-curated tips covering ×2-×20 tricks, mental-math shortcuts, division rules, number-theory patterns, real-world hooks, and brain-tickling facts. Each tip < 220 chars so it reads cleanly on the splash card.
- **Loading splash bumped to 4500ms** — long enough to actually read the tip.
- **Continuous difficulty scaling** in `lib/lessonPath.js`: every level index materially ramps. Level 1 = ×2/×5/×10 with factor ≤ 5 (Beginner). Level 17 = 18 tables up to factor ≤ 20 (Expert). Level 67 = mixed Grand Master with factors ≤ 25. Within a level, lessons also micro-ramp (`minFactor`/`maxFactor` interpolate over the 15 lessons). The unit boss uses the hardest spec.
- **"Jump here" replaces "Test out"**:
  - Hover or focus any non-completed lesson node → popover slides down with lesson info + a single "Jump here" button.
  - Click an unlocked node directly → lesson starts (no popover needed).
  - Each level header now has a big "Jump here" button (replaces the old "Test out" button).
  - Jump-here test is **20 Q · 5 hearts** calibrated to the *lesson's* difficulty (or the level's hardest lesson when jumping a whole level).
  - Pass marks **every lesson up to and including** the target as complete (`via: "jump_here"`), then auto-marks any covered levels complete. Fail leaves progress untouched.
- **Universal streak credit + celebration**:
  - New `markCompletedActivityToday()` helper in `storage.js` — idempotent for the rest of today, returns `{ wasFirst, streak, gemsAwarded, isStreakStart }`.
  - Wired into Lessons (every finish), QuickFire/Streak (via `recordRunResult`), Boss (win path), LongMul/LongDiv (final-question path), Daily (already existed).
  - Streak gem rewards at thresholds: 1, 3, 7, 14, 25, 50, 100, 200, 365 days.
- **`<CompletionCelebration>`** end-of-run component with:
  - Animated **XP count-up** (ease-out cubic, 950ms).
  - **Streak fire-lit reveal** when `wasFirst === true` — flame icon scales/rotates from grey to filled rose, card flips amber, the streak count pops in.
  - **Gem milestone badge** at threshold days, with rotating gem icon and animated count-in.
  - Used on the Lessons end-screen; ready to drop into any other mode.
- **Home page streak card** — animated flame + day count under the hero. Lit (amber) when streak > 0 with a continuous pulse; dim with "Start one today" copy when 0.
- **Settings gear** restored at the far right of the header (was removed earlier).

### v5.2 — 1000-Lesson Path + Brilliant-style in-lesson UI (prior round)
- **1005 lessons across 67 levels**, generated programmatically in `lib/lessonPath.js`. Streams: Multiplication (17 lvls), Division (17), Long Multiplication (15), Long Division (15), Mastery (3). Difficulty ramps within each stream (Beginner → Easy → Medium → Hard → Expert). Each level has 15 lessons; the last is a unit-boss node.
- **Test-out per level**: 20 questions, **5 hearts**. Each wrong answer drops a heart; 0 hearts = fail. Pass marks all 15 lessons in the level complete and unlocks the next level (+60 XP).
- **Endless mode**: locked tile that unlocks once every lesson is cleared, then auto-generates random hard questions for unlimited play.
- **Two-column lobby layout**: path on the left/main, **sticky Custom Lesson sidebar on the right** (`lg:sticky lg:top-24`); single column on mobile.
- **Centered zig-zag**: lessons curve outward from the middle via `Math.sin((i/3) * π) * 90px` so the path uses the full width.
- **Brilliant-style in-lesson UI** (`components/LessonQuestion.jsx`):
  - Plain-English prompt ("What is **four** times **nine**?")
  - Full-bleed dark canvas with a **dot-grid visualization** (animated `a × b` for multiplication, rows-of-`divisor` for division, big-number fallback past 400 dots)
  - Dashed answer slot + **3 large multiple-choice tiles** (correct flashes green, wrong flashes rose and reveals the right tile)
  - Used in path lessons, custom lessons, and endless mode. Test-out keeps typed input via the original Question component.
- **Pre-lesson "Did you know?" splash** (`components/LessonLoading.jsx`): every lesson / custom run / endless / test start runs through a 1.8s loading screen with a tip from the lesson's primary table + an animated progress bar.
- Path progress meter in the lobby ("X / 1005 · Y%") and inside the sidebar.

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

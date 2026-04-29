# Times Tables — Practice App PRD

## Original problem statement
"make me an app that teaches someone timestables in a gamified way, not childish but just to help learn. make it a website thta i can acess too"

## User choices (locked-in)
- Audience: Teen / Adult — NOT childish
- Game modes: All three picks (Quick-Fire, Streak, Boss) + Daily + Long-form
- Tables range: User-selectable subset of 1×–20× via grid + presets
- Currency: Coins + XP + powerup shop
- Auth/Leaderboard: deferred (local-only)
- Aesthetic: WHITE / light theme primary with neo-brutalist black outlines + 4px hard shadows. Dark mode toggle in header.
- Sound effects: on by default, toggle in header.
- Operation: × / ÷ / Both — picker prominent on homepage.
- Learn methods: Table view + Tips, Flashcards, Multiple Choice, Skip Counting, 10-Q Drill.
- Long-form practice: Long Multiplication (2×1, 2×2, 3×2) and Long Division (whole-number quotients) — 3 difficulty tiers each.

## Architecture
- Frontend-only React app (CRA + craco). State in localStorage `tt_arena_state_v2`.
- Routes: `/`, `/learn`, `/play/quickfire`, `/play/streak`, `/play/boss`, `/play/daily`, `/play/long-mul`, `/play/long-div`, `/stats`, `/shop`.
- No backend usage in v3.

## Implemented (rolling)
### Iteration 1 (MVP)
- Layout shell, Range selector 1–12, Quick-Fire/Streak/Boss, Stats, Shop.

### Iteration 2 (theme + learn + daily + sound + division)
- Light/Dark theme toggle (CSS vars, html.dark class).
- Tables extended to 1–20.
- Operation modes ×/÷/Both.
- Learn page (table view + tips + 10-Q drill).
- Daily Challenge (30 questions, seeded by date, once per day).
- Web Audio sfx (correct/wrong/coin/levelup), header toggle.

### Iteration 3 (this turn)
- Prominent Operation picker (`OpPicker`) on home — Multiplication/Division/Both as 3 tiles.
- Learn methods expanded: tabs for Table, Flashcards, Multiple Choice, Skip Counting, Drill.
- Flashcards: 12-card front/back flip set, "Knew it" / "Missed it" tracking.
- Multiple Choice: 4 options, instant feedback.
- Skip Counting: fill-in-the-blank in a multiples sequence.
- Long Multiplication mode (`/play/long-mul`) with Easy/Medium/Hard.
- Long Division mode (`/play/long-div`) with Easy/Medium/Hard.
- Op chips removed from RangeSelector; live in OpPicker now.

## Personas
- Refresher / Teen / Speed Junkie / Multi-digit returner.

## Backlog
### P0 (next)
- User accounts + login + cross-device sync.
- Global leaderboard.

### P1
- Decimal multiplication mode (e.g. 1.5 × 8).
- Long-division **with remainder** option.
- Spaced-repetition flashcards (review missed cards).
- Daily streak counter (consecutive days completed).

### P2
- Achievements / badges.
- Shareable result cards (PNG export).
- Onboarding tour for first-time visitors.

## Test history
- iteration_1: 100% pass
- iteration_2: 100% pass
- iteration_3: 100% pass (all 14 features verified)

### Iteration 4 (this turn)
- **Step-by-Step Long Division solver** (`/play/long-div` → "Step-by-Step"). Visual long-division layout with quotient input slots; each correct digit reveals the product subtraction and remainder, just like solving on paper. 4 problems per round.
- **Pick-the-answer mode** for Quick-Fire / Streak / Boss. New `Answer Style` toggle: Type answer / Pick answer. In choices mode, 4-button grid replaces typed input; wrong picks reveal the correct answer briefly.
- **Compact OpPicker moved below Modes** — operation + answer-style chips on a single low-prominence card.
- 100% pass on iteration_4 testing (14 scenarios).

### Iteration 5 (this turn)
- **Multi-select tables in Learn**: pick any subset of 1–20; double-click to select only one; counter shows count.
- **Tips per selected table** rendered together when multiple chosen.
- **Deeper, real tips**: rewrote `tableTips` with divisibility rules and shortcuts (e.g. ×3 digit-sum rule with worked example, ×9 digit-sum trick, ×11 alternating-sum rule, ×4 last-two-digits rule, ×8 last-three-digits rule, finger trick for 9, etc.).
- **Flashcards: 3D flip animation** (framer-motion rotateY 0↔180° with backface-visibility), deck draws 12×N from all selected tables and shuffles.
- **Knew it / Missed it buttons** are now solid `bg-emerald-500` / `bg-rose-500` with white bold text — fully opaque in both light and dark modes.
- iteration_5: 100% pass.

### Iteration 6 + 7 (this turn)
- **Stats: 30-day progress chart** (recharts `AreaChart` of correct + total per day; uses new `state.history` daily buckets written by `recordAnswer`).
- **Settings page** (`/settings`, header nav-settings): Preferences (theme + sound), Account placeholder ("Sign-in coming soon"), Data (export/import JSON), Reset (preferences / stats / everything) — each with confirm dialog.
- **Daily-streak counter**: `state.dailyStreak = { count, lastDate }`. Yesterday → +1, same date → no-op, otherwise → 1. Displayed on Daily page (badge) and in header (hud-streak when > 0).
- **Decimal multiplication mode** in Long Multiplication (`diff-decimals`). Question.jsx allows `.` in input; submit uses `parseFloat` with tolerance.
- **Long-division-with-remainder** mode in Long Division (`diff-rem-easy/medium/hard`). Dual-input UI (`rem-q-input`, `rem-r-input`).
- **Step-by-Step Long Multiplication** (`diff-step` in LongMul) — new `StepMultiplication` component with canonical paper layout, partial-product input slots, then a final-sum input.
- **Step-difficulty selector** for Step-by-Step Long Division: brief is now 3 sections × 3 levels (`diff-step-easy/medium/hard`).
- iteration_6 → iteration_7 (after fix): 100% pass on the retest.

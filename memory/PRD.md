# TIMES.ARENA — Gamified Times Tables PRD

## Original problem statement
> "make me an app that teaches someone timestables in a gamified way, not childish but just to help learn. make it a website thta i can acess too"

## User choices (locked-in 2026-02)
- Audience: Teen / Adult — NOT childish
- Game modes: All three, user-selectable (Quick-Fire, Streak, Boss)
- Tables range: User picks any subset of 1×–12× via toggle / presets
- Currency: Coins + XP, with powerup shop
- Auth/Leaderboard: Deferred (user said "not for now"); v1 is local-only
- Aesthetic: Light grey/white palette → designer chose Neo-Brutalism (Outfit + JetBrains Mono, white surfaces, 2px black borders, hard 4px shadows, blue/amber/red accents)

## Architecture
- Frontend-only React app (CRA + craco). State lives in `localStorage` under key `tt_arena_state_v1`.
- Routes: `/`, `/play/quickfire`, `/play/streak`, `/play/boss`, `/stats`, `/shop`.
- No backend/MongoDB usage in v1 (default `/api` route untouched).

## What's been implemented (2026-02)
- Brand shell `Layout` with persistent HUD (coins, level + XP bar, nav).
- `RangeSelector` — toggle each of 12 tables + 4 presets (Easy 2–5, Core 2–10, All 1–12, Tough).
- Quick-Fire: 60-second timer, score, combo with multiplier coin bonus, coin-pop + shake animations, run-end results screen.
- Streak: endless mode that breaks on first wrong; combo pulses while > 0.
- Boss: progressive levels (`bossConfig`), 3 lives, per-question timer, brief → play → VICTORY/DEFEAT screen, level-up reward.
- Powerups (in-game + shop): Extra Time (+15s, 30c), Skip (20c), Freeze (5s pause, 40c), Coin Doubler (75c). Stack across runs.
- Stats page: total correct/wrong/accuracy, per-table progress bars + avg solve time, reset-all button.
- Shop page: buy with coins, owned counter, sonner toasts.
- localStorage persistence verified by testing agent.
- All interactive elements have `data-testid` attrs.

## Personas
- **Refresher** — adult who wants to relearn or get faster on multiplication.
- **Test Prepper** — teen drilling specific tables (toggles only the weak ones).
- **Speed Junkie** — competitive solo player chasing best streak / Quick-Fire high.

## Backlog
### P0 (next)
- User accounts + login (deferred from v1) for cross-device save.
- Global leaderboard for Quick-Fire and Streak.

### P1
- Sound effects (correct ding, wrong buzz, coin clink) with mute toggle.
- Daily challenge with fixed seed for fair leaderboard runs.
- More boss enemies (currently 11 named, then cycles).

### P2
- Division & mixed-mode questions.
- Shareable result cards (PNG export of run summary).
- Achievement/badge system (e.g., "All 7s in <5s avg").
- Onboarding tour for first-time visitors.

## Testing
- iteration_1.json: 100% frontend pass, no issues. App confirmed end-to-end functional.

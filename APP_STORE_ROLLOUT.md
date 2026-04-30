# App Store Rollout

## Goal
Ship TimesTables to:
- Google Play
- Apple App Store

## Current technical direction
Use Capacitor to wrap the existing React frontend and FastAPI backend into native app shells.

## Important blocker before submission
The current web billing flow uses Stripe Checkout for digital access.

For native app-store submission, digital subscriptions sold inside the app will need platform-compliant in-app purchase handling:
- Google Play Billing on Android
- StoreKit / In-App Purchases on iOS

If the app launches with web Stripe purchase prompts for digital subscription access inside the native shell, review rejection risk is high.

## Assumptions started in this rollout
- App name: `TimesTables`
- Family plan display name: `TimesTables, MAX Family`
- Proposed app id / bundle id: `ca.timestables.app`

## Phase 1, started
- [x] Add Capacitor dependencies
- [x] Create Capacitor config
- [x] Sync built web app into native shells
- [x] Add Android project
- [x] Add iOS project scaffold
- [ ] Define app icon / splash assets

## What is already in the repo
- `frontend/capacitor.config.json`
- `frontend/android/`
- `frontend/ios/`
- package scripts for `cap:sync`, `cap:copy`, `cap:android`, and `cap:ios`

## Phase 2
- [ ] Replace web-only in-app subscription purchase flow with native store billing
- [ ] Keep Stripe for web if desired
- [ ] Map app-store entitlements back to backend account state
- [ ] Handle restore purchases

## Phase 3
- [ ] Google Play listing assets
- [ ] Apple App Store listing assets
- [ ] Privacy policy review
- [ ] Age rating / content questionnaire
- [ ] TestFlight / internal testing rollout
- [ ] Play internal testing rollout

## Assets we will need
- App icon, 1024x1024
- Android feature graphic
- iPhone screenshots
- iPad screenshots if supported
- App subtitle / short description
- Long description
- Privacy policy URL
- Support URL

## Notes
This file is the rollout control doc. Update it as work lands.

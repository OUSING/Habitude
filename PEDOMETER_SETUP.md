# Pedometer setup

The app now has a native Android pedometer card on the Today screen.

## What it does
- Reads the Android `TYPE_STEP_COUNTER` sensor.
- Requests `ACTIVITY_RECOGNITION` on Android 10+.
- Shows today's live step count on the dashboard.
- Creates/updates the existing `Steps` measurement habit automatically.
- Keeps counting via a background foreground service, even while the app is backgrounded or fully closed — not just while it's open. A low-priority "Tracking your steps" notification stays up while this is active (required by Android for any background service); turning the in-app toggle off stops it.
- Handles sensor resets after a device reboot without making the count go negative.
- The browser build intentionally hides the pedometer card because a normal browser cannot access the phone's hardware step counter.

## Build Android

From `Habitude/`:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

If an `android/` platform already exists, do not run `cap add android` again; use:

```bash
npm run cap:sync
npx cap open android
```

On the phone, enable the pedometer switch on the Today screen and allow **Physical activity** permission when Android asks.

## Important limitation

Android's basic step-counter sensor does not provide historical per-day data by itself. This implementation maintains a local daily ledger. Days before the app/plugin first starts tracking cannot be reconstructed without integrating Health Connect.


## Verification performed

The pedometer integration was reviewed for the Android `TYPE_STEP_COUNTER` flow, runtime `ACTIVITY_RECOGNITION` permission, sensor-unavailable devices, reboot counter resets, repeated live-listener registration, and web fallback behavior.

A full project build cannot be reproduced from the supplied archive until dependencies are installed (`npm ci`); the archive does not contain a complete `node_modules` tree. On a machine with network access, run `npm ci && npm run build && npx cap sync android`. Then install on a physical Android phone with a step-counter sensor and verify: permission prompt → enable tracking → walk → live count increases → background/swipe-close the app → keep walking → reopen → the count includes steps taken while closed → a "Tracking your steps" notification stays visible while enabled → turning the toggle off dismisses it.

If an `android/` platform folder was already generated before this change (via `npx cap add android`), run `npx cap sync android` again so the new service and manifest permissions in `capacitor-step-counter` get merged in — a bare `npm run build` alone won't touch the native project.

# Home screen widget setup

The app now has a "Today's Habits" home screen widget for Android and iOS,
backed by a new local plugin, `capacitor-habit-widget`. It shows today's
scheduled habits with a checkmark for each one already completed, and a
`done/total` count — read-only (tap the widget to open the app). It's kept
current automatically: every habit/log change in the app pushes a fresh
checklist to the widget within about a second.

## Android — fully automatic, no manual native edits

The widget provider, its layout, and its manifest `<receiver>` all live
inside the `capacitor-habit-widget` Android module and are merged into your
app automatically by Gradle. From `Habitude/`:

```bash
npm install
npm run build
npx cap add android      # skip if android/ already exists
npx cap sync android
npx cap open android
```

Run the app once on the device/emulator (so it writes the first checklist),
then long-press the home screen → Widgets → **Habitude** → drag "Today's
Habits" onto the home screen.

If `android/` already existed before this change, just run
`npm run cap:sync` again — a plain `npm run build` won't pull the new
plugin's manifest/resources into the native project by itself.

## iOS — requires one manual Xcode step

Unlike Android, iOS widgets are a separate **Widget Extension** target, and
no tool can add a new Xcode target to your project file automatically — this
has to be done once, by hand, in Xcode.

1. Build and open the iOS project:
   ```bash
   npm install
   npm run build
   npx cap add ios      # skip if ios/ already exists
   npx cap sync ios
   npx cap open ios
   ```
2. In Xcode: **File → New → Target… → Widget Extension**. Name it
   `HabitudeWidget`. Uncheck "Include Configuration App Intent" (this widget
   has no user-configurable options). When prompted, activate the scheme.
3. Xcode generates a template Swift file for the extension — delete its
   contents and replace them with
   `capacitor-habit-widget/widget-extension/HabitudeWidget.swift` from this
   repo (copy the file into the new `HabitudeWidget` target/group).
4. Add the same **App Group** capability to *both* targets — your main app
   target ("App") and the new `HabitudeWidget` target:
   - Select each target → **Signing & Capabilities** → **+ Capability** →
     **App Groups** → **+** → create/select an id like
     `group.<your-reverse-dns-app-id>.habitude` (must start with `group.`).
   - Update that same id in two places in this repo so the app and widget
     agree on where to read/write:
     - `capacitor.config.ts` → `plugins.HabitWidget.appGroup`
     - `capacitor-habit-widget/widget-extension/HabitudeWidget.swift` →
       the `appGroupId` constant near the top of the file.
   - Re-run `npx cap sync ios` after changing `capacitor.config.ts`.
5. Build and run the app target on a device or simulator once (so it writes
   the first checklist), then add the widget from the iOS home screen /
   widget gallery ("Today's Habits" under Habitude).

### Notes

- The widget extension's own deployment target must be iOS 15+ to match the
  plugin (`WidgetKit`/`SwiftUI` APIs used here are available from iOS 14,
  but the rest of the project targets 15).
- If the widget shows "Open Habitude to load today's habits", the app
  hasn't written any data yet for that App Group — open the app once.
- The widget refreshes itself in the background roughly every 30 minutes as
  a fallback, but in practice you'll see it update within a second or two
  of checking off a habit in the app, since the app explicitly asks iOS to
  reload it (`WidgetCenter.shared.reloadAllTimelines()`) on every change.

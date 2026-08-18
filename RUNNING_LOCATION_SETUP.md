# Running tracker location setup

The running tracker now uses the Capacitor Geolocation plugin instead of relying
only on browser `navigator.geolocation`.

After extracting the project:

```bash
npm install
npm run build
npx cap sync android
```

On Android, tap **Start run** and accept the location permission. The tracker
will then receive high-accuracy GPS updates.

For a physical Android device, make sure **Location** is enabled in Android
settings. A real device/outdoor test is recommended because GPS can be poor
indoors.

The running tracker is separate from habits and does not create habit entries.

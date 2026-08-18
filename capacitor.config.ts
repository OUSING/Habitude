import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Change this to your own reverse-DNS app id before shipping.
  appId: "com.example.habittracker",
  appName: "Habitude",
  webDir: "dist",
  server: {
    androidScheme: "https"
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_habit",
      iconColor: "#eb0c44",
      sound: "default"
    },
    // The animated (Lottie) splash screen lives in the web app itself —
    // see src/components/SplashScreen.tsx. This native launch screen is
    // just a plain brand-colored background that's kept on screen
    // (launchAutoHide: false) until that component mounts and calls
    // SplashScreen.hide() on its own, so there's no gap/flash between the
    // native screen and the animated one taking over.
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#0d0d0d",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    // Required for native (Android/iOS) Google Sign-In — the plugin reads
    // this from here, not from the JS GoogleAuth.initialize() call, which
    // only applies on web. Set VITE_GOOGLE_CLIENT_ID in your .env (see
    // .env.example) before running `npx cap sync`.
    GoogleAuth: {
      // "drive.file" is included here (not just "profile"/"email") so the
      // access token returned by GoogleAuth.signIn()/refresh() on native
      // is also valid for the Drive backup calls in services/driveBackup.ts.
      scopes: ["profile", "email", "https://www.googleapis.com/auth/drive.file"],
      serverClientId: process.env.VITE_GOOGLE_CLIENT_ID ?? "",
      forceCodeForRefreshToken: true
    },
    // iOS only — the app and the HabitudeWidget extension share this App
    // Group to pass today's checklist to the widget. Must match the group
    // id you enable in Xcode on both targets. See WIDGET_SETUP.md.
    HabitWidget: {
      appGroup: "group.com.example.habittracker"
    }
  }
};

export default config;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// The Capacitor GoogleAuth plugin's *web* implementation relies on Google's
// legacy gapi.auth2 library, which no longer accepts any client ID created
// after July 29, 2022 — so initializing it in the browser is pointless and
// will just log warnings. Only set it up on native (Android/iOS), where it
// uses the native Google Sign-In SDK instead and isn't affected. The web
// sign-in flow lives in services/googleAuthWeb.ts.
if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
    scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive'],
    grantOfflineAccess: true,
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

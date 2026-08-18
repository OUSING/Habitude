/**
 * Google sign-in for the browser/web build, using Google Identity Services
 * (GIS) directly.
 *
 * Why this exists: @codetrix-studio/capacitor-google-auth's web
 * implementation is built on the legacy `gapi.auth2` / platform.js
 * library. Google deprecated that library in March 2023, and — more
 * importantly — it has rejected sign-in attempts for any OAuth client ID
 * created after July 29, 2022 ever since. Any freshly-created Google
 * Cloud client ID will fail here (e.g. "idpiframe_initialization_failed"),
 * no matter how it's configured. There's no fixing that path; it has to
 * be bypassed for web.
 *
 * Native builds (Android/iOS) are NOT affected by this deprecation — they
 * use the platform's native Google Sign-In SDK, not platform.js — so they
 * keep going through the @codetrix-studio/capacitor-google-auth plugin.
 * See SignIn.tsx for the platform branch.
 *
 * Code flow, not token flow: this uses initCodeClient (the OAuth
 * "authorization code" model) rather than initTokenClient (the "implicit"
 * token model). The code model is the only one of the two Google will hand
 * a refresh token back for, and a refresh token is what lets the app stay
 * signed in for months instead of the ~1 hour a bare access token lasts.
 * The code itself is exchanged server-side, in /api/google/token.js,
 * because that exchange requires the OAuth client secret, which must never
 * reach the browser. See driveBackup.ts for how the refresh token is then
 * used to renew access tokens silently.
 */

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GIS_SCRIPT_ID = "google-identity-services";

export interface GoogleWebUser {
  email: string;
  name?: string;
  imageUrl?: string;
}

export interface GoogleWebSignInResult extends GoogleWebUser {
  driveAccessToken: string;
  driveTokenExpiresIn: number;
  /** Only present the first time the user grants consent (or after they've
   *  revoked and re-granted it) — see the note in signInWithGoogleWeb. */
  driveRefreshToken: string | null;
}

let gisLoadPromise: Promise<void> | null = null;

/**
 * Loads the Google Identity Services script if it isn't already on the
 * page. Exported so any web code that needs `window.google.accounts.oauth2`
 * can guarantee it's available.
 */
export function ensureGisLoaded(): Promise<void> {
  return loadGis();
}

function loadGis(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    if (document.getElementById(GIS_SCRIPT_ID)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Identity Services."));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

/**
 * Runs the OAuth 2.0 authorization-code flow via GIS, exchanges the code
 * for tokens through our own /api/google/token endpoint, and fetches the
 * signed-in user's basic profile. Requires VITE_GOOGLE_CLIENT_ID to be set
 * to a *web* OAuth client ID from Google Cloud Console (see the .env file).
 *
 * Requests the Drive (drive.file) scope in this same consent screen,
 * alongside identity, so sign-in is the only time the user is ever asked
 * for permission.
 *
 * Note on getting a refresh token: Google only includes refresh_token in
 * the very first token exchange after a user grants this app access. If
 * someone signed in before this code-flow migration (or previously denied
 * the Drive scope), their existing grant may not carry a refresh token. If
 * driveRefreshToken comes back null for an existing user, the fix is a
 * one-time trip to https://myaccount.google.com/permissions to remove
 * Habitude's access, then sign in again — that forces a fresh consent
 * screen and a new refresh token.
 */
export async function signInWithGoogleWeb(clientId: string): Promise<GoogleWebSignInResult> {
  if (!clientId) {
    throw new Error(
      "VITE_GOOGLE_CLIENT_ID is not set — see the .env file to configure Google authentication."
    );
  }

  await loadGis();
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error("Google Identity Services could not be initialized.");
  }

  const redirectUri = window.location.origin;

  const code = await new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: "openid email profile https://www.googleapis.com/auth/drive.file",
      ux_mode: "popup",
      // Without this, GIS silently reuses whichever Google account is
      // currently active in the browser instead of offering a choice —
      // which is exactly what makes "sign in with a different account"
      // impossible after a first sign-in. select_account always shows
      // the chooser.
      select_account: true,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response.code as string);
      },
      error_callback: (err: any) => {
        reject(new Error(err?.message ?? "Google sign-in canceled or denied."));
      }
    });
    client.requestCode();
  });

  const exchangeRes = await fetch("/api/google/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri })
  });
  const tokenData = await exchangeRes.json();
  if (!exchangeRes.ok) {
    throw new Error(tokenData?.error || "Could not complete Google sign-in.");
  }

  const accessToken = tokenData.access_token as string;
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!profileRes.ok) {
    throw new Error("Could not retrieve the Google profile.");
  }
  const profile = await profileRes.json();
  if (!profile.email) {
    throw new Error("The Google account did not return an email address.");
  }

  return {
    email: profile.email,
    name: profile.name,
    imageUrl: profile.picture,
    driveAccessToken: accessToken,
    driveTokenExpiresIn: Number(tokenData.expires_in) || 3600,
    driveRefreshToken: (tokenData.refresh_token as string) ?? null
  };
}

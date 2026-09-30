import { useCallback, useEffect, useState } from "react";
import {
  getSession,
  signInWithProvider,
  signOut as signOutService,
  type Session
} from "../services/auth";
import { signInWithGoogleWeb } from "../services/googleAuthWeb";
import { clearDriveWebSession, seedWebDriveToken } from "../services/driveBackup";

const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Check for an existing session on startup
  useEffect(() => {
    let cancelled = false;
    getSession().then((s) => {
      if (cancelled) return;
      setSession(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Google OAuth sign-in flow
  const signIn = useCallback(async () => {
    const googleUser = await signInWithGoogleWeb(GOOGLE_WEB_CLIENT_ID);
    const email = googleUser?.email;
    // Sign-in already obtained Drive (drive.file) consent in the same step —
    // seed it now so the first sync doesn't need to ask Google again. The
    // refresh token (when Google includes one — see googleAuthWeb.ts) is what
    // keeps this session alive for months instead of the ~1 hour a bare
    // access token lasts.
    seedWebDriveToken(googleUser.driveAccessToken, googleUser.driveTokenExpiresIn, googleUser.driveRefreshToken);

    if (!email) {
      throw new Error("Could not retrieve the Google account's email address.");
    }

    // Calls the local auth service with the real email
    const s = await signInWithProvider("google", email);
    setSession(s);
    return s;
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await signOutService();
    clearDriveWebSession();
    setSession(null);
  }, []);

  return { session, loaded, isSignedIn: !!session, signIn, signOut };
}


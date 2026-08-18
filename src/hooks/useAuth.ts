import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
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
    let email: string | undefined;

    if (Capacitor.isNativePlatform()) {
      const googleUser = await GoogleAuth.signIn();
      email = googleUser?.email;
    } else {
      const googleUser = await signInWithGoogleWeb(GOOGLE_WEB_CLIENT_ID);
      email = googleUser?.email;
      // Sign-in already obtained Drive (drive.file) consent in the same
      // step — seed it now so the first sync doesn't need to ask Google
      // again. The refresh token (when Google includes one — see
      // googleAuthWeb.ts) is what keeps this session alive for months
      // instead of the ~1 hour a bare access token lasts.
      seedWebDriveToken(googleUser.driveAccessToken, googleUser.driveTokenExpiresIn, googleUser.driveRefreshToken);
    }

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
    // Clearing only our local session isn't enough: the native Google
    // Sign-In SDK keeps its own "last signed-in account" cache, so the
    // next signIn() would silently reuse it (showing a "signing back in
    // as [email]" confirmation instead of the full account picker). Tell
    // Google's own SDK to forget it too.
    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleAuth.signOut();
      } catch (error) {
        // Non-fatal — still proceed with clearing the local session below.
        console.error("Native Google sign-out failed:", error);
      }
    }
    await signOutService();
    clearDriveWebSession();
    setSession(null);
  }, []);

  return { session, loaded, isSignedIn: !!session, signIn, signOut };
}


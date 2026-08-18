import { useState } from "react";
import { Chrome } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'; // Native (Android/iOS) sign-in
import { signInWithGoogleWeb } from "../services/googleAuthWeb"; // Browser sign-in (see file for why)
import { decodeGoogleAuthError } from "../utils/googleAuthError";

const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

interface Props {
  onOAuthSuccess: (googleUser: any) => Promise<void>;
}

export function SignIn({ onOAuthSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthErrorRaw, setOauthErrorRaw] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Native (Android/iOS) uses the Capacitor plugin's native Google Sign-In
  // SDK. Web can't use that plugin's browser path (see googleAuthWeb.ts for
  // why), so it goes through Google Identity Services directly instead.
  async function handleOAuth() {
    if (submitting) return;
    setSubmitting(true);
    setOauthError(null);
    setOauthErrorRaw(null);
    setShowDetails(false);
    try {
      const googleUser = Capacitor.isNativePlatform()
        ? await GoogleAuth.signIn()
        : await signInWithGoogleWeb(GOOGLE_WEB_CLIENT_ID);

      await onOAuthSuccess(googleUser);
    } catch (error) {
      console.error("Google authentication error:", error);
      // The native plugin's own message is always the unhelpful generic
      // "Something went wrong" — decode the real status code instead so
      // the actual problem is visible, not hidden behind that string.
      const decoded = decodeGoogleAuthError(error);
      setOauthError(decoded.summary);
      setOauthErrorRaw(decoded.raw);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col justify-center bg-bg px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
          <span className="font-display text-2xl font-semibold">H</span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to pick up your habits</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button variant="outline" fullWidth onClick={handleOAuth} disabled={submitting}>
          <Chrome size={18} />
          {submitting ? "Signing in…" : "Continue with Google"}
        </Button>
        {oauthError && (
          <div className="rounded-xl bg-red-500/10 px-3 py-2.5">
            <p className="text-center text-[13px] text-red-500" role="alert">
              {oauthError}
            </p>
            {oauthErrorRaw && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="mx-auto mt-1.5 block text-[11px] font-semibold text-red-500/80 underline underline-offset-2"
                >
                  {showDetails ? "Hide technical details" : "Show technical details"}
                </button>
                {showDetails && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/80 p-2 text-left text-[10.5px] leading-relaxed text-red-100">
                    {oauthErrorRaw}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
        Your Google account is used securely to sign in. On desktop, Google Identity Services handles the browser login.
      </p>
    </div>
  );
}

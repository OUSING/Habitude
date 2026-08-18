/**
 * The native @codetrix-studio/capacitor-google-auth plugin (and the
 * underlying Android GoogleSignInStatusCodes it wraps) always throws with
 * message "Something went wrong" — the actually useful information is in
 * `error.code`. This maps the known codes to a precise explanation so the
 * UI can show the real problem instead of that generic string.
 *
 * Codes: https://developers.google.com/android/reference/com/google/android/gms/auth/api/signin/GoogleSignInStatusCodes
 */
const GOOGLE_SIGN_IN_STATUS_CODES: Record<string, string> = {
  "7": "Network error: check the device's internet connection.",
  "8": "Internal Google Play Services error. Try again.",
  "10": "Invalid OAuth configuration (DEVELOPER_ERROR): no Android OAuth client is registered for this package name and SHA-1 fingerprint in the Google Cloud / Firebase console. Add the SHA-1 of the keystore used for this build, regenerate google-services.json, then rebuild the app.",
  "12500": "Google sign-in failed (SIGN_IN_FAILED): the Android OAuth client (package + SHA-1) doesn't match the one configured in the Google console.",
  "12501": "Sign-in canceled by the user.",
  "12502": "A Google sign-in attempt is already in progress.",
  "16": "No Google account available, or the action was canceled by the user."
};

interface DecodedGoogleAuthError {
  /** Human-readable explanation, in English, to show directly in the UI. */
  summary: string;
  /** Raw code reported by the plugin/SDK, if any (e.g. "10"). */
  code: string | null;
  /** Raw message reported by the plugin/SDK. */
  rawMessage: string;
  /** Full error serialized for a "technical details" panel. */
  raw: string;
}

export function decodeGoogleAuthError(error: unknown): DecodedGoogleAuthError {
  const raw = error as any;
  const code: string | null =
    raw?.code != null ? String(raw.code) : raw?.error?.code != null ? String(raw.error.code) : null;
  const rawMessage: string =
    raw?.message ?? raw?.error?.message ?? (error instanceof Error ? error.message : String(error));

  const known = code ? GOOGLE_SIGN_IN_STATUS_CODES[code] : undefined;
  const summary = known
    ? `${known} (code ${code})`
    : code
      ? `${rawMessage} (code ${code})`
      : rawMessage || "Unknown Google sign-in error.";

  let raw_serialized: string;
  try {
    raw_serialized = JSON.stringify(raw, Object.getOwnPropertyNames(raw ?? {}), 2);
  } catch {
    raw_serialized = String(raw);
  }

  return { summary, code, rawMessage, raw: raw_serialized };
}

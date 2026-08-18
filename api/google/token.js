/**
 * Exchanges a Google OAuth "authorization code" (obtained in the browser via
 * google.accounts.oauth2.initCodeClient, see src/services/googleAuthWeb.ts)
 * for an access token + refresh token.
 *
 * This has to happen on a server because the exchange requires the OAuth
 * client secret, which must never be shipped to the browser. This is the
 * ONLY thing this endpoint does — it holds no session, no database, no
 * user record. The refresh token it returns is stored client-side (see
 * driveBackup.ts) and handed back to /api/google/refresh whenever a new
 * access token is needed, which is what lets sign-in survive for months
 * instead of the ~1 hour an access token alone is good for.
 *
 * Required environment variables (set in the Vercel project, NOT prefixed
 * with VITE_ so they never get bundled into client code):
 *   GOOGLE_CLIENT_ID     - same client ID as VITE_GOOGLE_CLIENT_ID in .env
 *   GOOGLE_CLIENT_SECRET - from the same OAuth client in Google Cloud Console
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, redirect_uri: redirectUri } = req.body || {};
  if (!code || !redirectUri) {
    res.status(400).json({ error: "Missing 'code' or 'redirect_uri'." });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET." });
    return;
  }

  try {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const googleRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    const data = await googleRes.json();

    if (!googleRes.ok) {
      // Most common cause here: this code was already exchanged once (codes
      // are single-use), or the redirect_uri didn't match what the code was
      // issued for.
      res.status(googleRes.status).json({
        error: data.error_description || data.error || "Google token exchange failed."
      });
      return;
    }

    // data: { access_token, refresh_token?, expires_in, scope, token_type, id_token? }
    // refresh_token is only present the FIRST time a user grants consent to
    // this app (or after they've revoked and re-granted it) — see the note
    // in googleAuthWeb.ts about forcing re-consent when needed.
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: "Could not reach Google's token endpoint." });
  }
}

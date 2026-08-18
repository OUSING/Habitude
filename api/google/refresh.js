/**
 * Exchanges a previously-issued Google refresh token for a fresh access
 * token. Called silently by driveBackup.ts whenever the cached access token
 * has expired (~hourly) — see getDriveAccessToken().
 *
 * Deliberately the mirror of /api/google/token.js: same client secret, same
 * "no session held here" design. The refresh token itself lives only in the
 * browser (Preferences/localStorage) and is sent up on each call.
 *
 * Note this call is a plain HTTPS POST with no Google cookies involved at
 * all, which is exactly why it keeps working in browsers (Brave, Safari,
 * Firefox strict mode) that block third-party cookies/storage — those
 * blocks only affect Google's own silent-reauth flow in the page, not a
 * server-to-server token refresh like this one.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { refresh_token: refreshToken } = req.body || {};
  if (!refreshToken) {
    res.status(400).json({ error: "Missing 'refresh_token'." });
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
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token"
    });

    const googleRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    const data = await googleRes.json();

    if (!googleRes.ok) {
      // "invalid_grant" here means the refresh token itself is dead — the
      // user revoked access at myaccount.google.com, changed their Google
      // password, or the token went unused for 6+ months. The client
      // treats this as "sign in again", not a transient error.
      res.status(googleRes.status).json({
        error: data.error_description || data.error || "Google token refresh failed."
      });
      return;
    }

    // data: { access_token, expires_in, scope, token_type }
    // Google does not send a new refresh_token on refresh calls — the
    // original one keeps working until it's revoked/expired.
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: "Could not reach Google's token endpoint." });
  }
}

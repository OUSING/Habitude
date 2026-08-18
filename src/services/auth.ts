import { Preferences } from "@capacitor/preferences";

const SESSION_KEY = "habit-tracker:session";

export interface Session {
  email: string;
  provider: "google";
}

export async function getSession(): Promise<Session | null> {
  const { value } = await Preferences.get({ key: SESSION_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    return null;
  }
}

async function setSession(session: Session): Promise<void> {
  await Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) });
}

export async function signOut(): Promise<void> {
  await Preferences.remove({ key: SESSION_KEY });
}

/**
 * Google sign-in. The real OAuth handshake happens in SignIn.tsx (native
 * plugin or Google Identity Services depending on platform); by the time
 * this is called we already have a verified email from Google, so this
 * just starts a local session tagged with the provider.
 */
export async function signInWithProvider(provider: "google", email: string): Promise<Session> {
  const session: Session = { email: email, provider };
  await setSession(session);
  return session;
}

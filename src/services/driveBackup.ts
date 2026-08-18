import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { db } from "./db";
import { getSession } from "./auth";
import type { Habit, HabitLog } from "../types/habit";
import type { Todo } from "../types/todo";
import type { DailyNote, ActivityLog } from "./db";
import { syncStepHistory } from "./stepTracker";
import { ensureGisLoaded } from "./googleAuthWeb";
import {
  getAutoSyncEnabled,
  getDriveFileId,
  getDriveModifiedAt,
  getLastBackupAt,
  getThemePreference,
  getViewMode,
  setDriveFileId,
  setDriveModifiedAt,
  setLastBackupAt,
  setThemePreference,
  setViewMode,
  type ThemePreference,
  type ViewMode
} from "./settings";

/**
 * Backs the whole app up to (and restores it from) a single JSON file
 * named `habitude-backup.json` in the signed-in user's own Google Drive
 * (created via the "drive.file" scope, so the app can only see files it
 * created — never the rest of the user's Drive).
 *
 * Native (Android/iOS): the access token comes from the same
 * @codetrix-studio/capacitor-google-auth sign-in used for login (see
 * capacitor.config.ts, which now includes the drive.file scope).
 *
 * Web: sign-in (googleAuthWeb.ts) uses the OAuth authorization-code flow
 * and hands back a refresh token alongside the first access token. That
 * refresh token is what this file leans on: it's persisted client-side
 * and, whenever the cached access token has expired, exchanged for a new
 * one through our own /api/google/refresh serverless endpoint. That
 * exchange is a plain HTTPS call carrying no Google cookies at all, so —
 * unlike Google Identity Services' own silent-reauth attempts — it isn't
 * affected by browsers (Brave, Safari, Firefox strict mode) that block
 * third-party cookies/storage. It's also what lets the signed-in state
 * last for months instead of the ~1 hour a bare access token is good for:
 * Google refresh tokens keep working indefinitely as long as they're used
 * occasionally and the user hasn't revoked access.
 */

const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const BACKUP_FILENAME = "habitude-backup.json";
const BACKUP_VERSION = 3;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  habits: Habit[];
  logs: HabitLog[];
  todos: Todo[];
  dailyNotes: DailyNote[];
  activityLogs: ActivityLog[];
  settings: {
    theme: ThemePreference;
    /** No longer used — kept optional so old backup files still restore fine. */
    accentColor?: string | null;
    viewMode: ViewMode;
  };
}

/* ------------------------------ Data I/O ------------------------------ */

async function collectBackupPayload(): Promise<BackupPayload> {
  // On the phone, snapshot recent pedometer totals before uploading so the
  // same activity history is available to the desktop after synchronization.
  try { await syncStepHistory(30); } catch (err) { console.warn("Step history sync failed:", err); }
  const [habits, logs, todos, dailyNotes, activityLogs, theme, viewMode] = await Promise.all([
    db.habits.toArray(),
    db.logs.toArray(),
    db.todos.toArray(),
    db.dailyNotes.toArray(),
    db.activityLogs.toArray(),
    getThemePreference(),
    getViewMode()
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    logs,
    todos,
    dailyNotes,
    activityLogs,
    settings: { theme, viewMode }
  };
}

/** Set while a restore/pull is writing Drive's data into Dexie, so the
 *  auto-sync hooks (below) know these writes are "data arriving from
 *  Drive" rather than a local edit, and don't turn right around and
 *  push the same data straight back up. */
let isApplyingRemoteData = false;

async function applyBackupPayload(data: BackupPayload): Promise<void> {
  if (!data || typeof data !== "object" || !Array.isArray(data.habits)) {
    throw new Error("Invalid or corrupted backup file.");
  }

  isApplyingRemoteData = true;
  try {
    // Replace local data wholesale — this is a restore, not a merge.
    // Ids are kept as-is (bulkAdd accepts explicit primary keys) so that
    // logs keep pointing at the right habitId.
    await db.transaction("rw", db.habits, db.logs, db.todos, db.dailyNotes, db.activityLogs, async () => {
      await db.habits.clear();
      await db.logs.clear();
      await db.todos.clear();
      await db.dailyNotes.clear();
      // Activity history is append/merge data, not configuration. Keep local
      // records and upsert synchronized records so a restore never erases
      // activity collected on this device.
      if (data.activityLogs?.length) await db.activityLogs.bulkPut(data.activityLogs);
      if (data.habits.length) await db.habits.bulkAdd(data.habits);
      if (data.logs?.length) await db.logs.bulkAdd(data.logs);
      if (data.todos?.length) await db.todos.bulkAdd(data.todos);
      if (data.dailyNotes?.length) await db.dailyNotes.bulkAdd(data.dailyNotes);
    });

    if (data.settings) {
      await setThemePreference(data.settings.theme ?? "system");
      await setViewMode(data.settings.viewMode ?? "list");
    }
  } finally {
    isApplyingRemoteData = false;
  }
}

/* --------------------------- Drive access token --------------------------- */

let webDriveTokenClient: any = null;

// Google access tokens are valid ~1 hour. Caching one (instead of asking
// Google for a fresh one on every push/pull) is what keeps sync from
// showing a login/consent popup on every sync — with third-party cookies
// blocked (the default in most browsers now), a "silent" token request
// often can't stay silent and falls back to visible UI, so the fix is to
// stop asking so often.
//
// This has to survive a page refresh, not just live in a JS variable —
// otherwise every reload wipes the in-memory cache and immediately asks
// Google again on the next sync, which is exactly the popup-on-refresh
// this was meant to prevent. So it's persisted to localStorage (web only;
// native goes through GoogleAuth.refresh() instead, which already reuses
// the OS-level Google session silently and isn't affected by this).
const WEB_TOKEN_STORAGE_KEY = "habit-tracker:driveWebToken";
// The refresh token has no expiry of its own (see the file header note), so
// it's stored separately from the short-lived access token cache below and
// is never cleared just because an access token expired — only on sign-out
// or when Google itself rejects it (see invalidateCachedWebDriveToken).
const WEB_REFRESH_TOKEN_STORAGE_KEY = "habit-tracker:driveWebRefreshToken";

interface CachedWebToken {
  token: string;
  expiresAt: number;
}

let cachedWebDriveToken: CachedWebToken | null = loadPersistedWebToken();
let cachedWebDriveRefreshToken: string | null = loadPersistedRefreshToken();
// Collapses concurrent callers (e.g. a push and a pull firing close
// together) onto a single in-flight request instead of opening two.
let pendingWebDriveTokenRequest: Promise<string> | null = null;
// Refresh a bit before actual expiry so a request never starts mid-flight
// with a token that's about to die.
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

function loadPersistedWebToken(): CachedWebToken | null {
  try {
    const raw = window.localStorage?.getItem(WEB_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWebToken;
    if (!parsed?.token || !parsed?.expiresAt || parsed.expiresAt - TOKEN_EXPIRY_BUFFER_MS <= Date.now()) {
      window.localStorage?.removeItem(WEB_TOKEN_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistWebToken(cached: CachedWebToken): void {
  try {
    window.localStorage?.setItem(WEB_TOKEN_STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — the in-memory
    // cache still works for the rest of this page load, it just won't
    // survive a refresh. Not worth surfacing to the user.
  }
}

function loadPersistedRefreshToken(): string | null {
  try {
    return window.localStorage?.getItem(WEB_REFRESH_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function persistRefreshToken(token: string): void {
  try {
    window.localStorage?.setItem(WEB_REFRESH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Same as persistWebToken — not fatal, just won't survive a refresh.
  }
}

/** Calls our own /api/google/refresh endpoint to trade the stored refresh
 *  token for a fresh access token. No Google cookies involved, so this
 *  works the same whether or not the browser blocks third-party storage —
 *  see the file header note. Returns null if there's no refresh token to
 *  use, or if Google rejects it (revoked, expired from 6+ months of
 *  disuse, password changed) — callers fall back to an interactive sign-in
 *  in that case. */
async function refreshWebDriveToken(): Promise<string | null> {
  if (!cachedWebDriveRefreshToken) return null;

  try {
    const res = await fetch("/api/google/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: cachedWebDriveRefreshToken })
    });
    const data = await res.json();
    if (!res.ok) {
      // invalid_grant etc. — the refresh token is dead. Drop it so we
      // don't keep retrying a token Google has already rejected.
      invalidateCachedWebDriveToken();
      return null;
    }
    const token = data.access_token as string;
    const expiresInSec = Number(data.expires_in) || 3600;
    const cached: CachedWebToken = { token, expiresAt: Date.now() + expiresInSec * 1000 };
    cachedWebDriveToken = cached;
    persistWebToken(cached);
    return token;
  } catch {
    // Network error reaching our own server — treat like "couldn't refresh
    // right now", not "token is dead". Caller decides what to do next.
    return null;
  }
}

/** Thrown (web only) when a Drive access token is needed but none is
 *  cached, and the caller is running in a non-interactive context (page
 *  load/refresh, tab focus, a debounced background sync after a local
 *  edit). Callers of getDriveAccessToken(false) never fall through to
 *  Google Identity Services in that case — this is thrown instead of a
 *  popup ever being opened. Only an explicit, user-initiated action (the
 *  "Sync now" button, toggling auto sync on, "Restore from Drive") is
 *  allowed to prompt Google. */
export class DriveAuthRequiredError extends Error {
  constructor() {
    super("Google Drive needs you to reconnect. Open Settings and tap Sync to continue.");
    this.name = "DriveAuthRequiredError";
  }
}

/** Web only: requests (or silently reuses) a Drive-scoped access token via
 *  Google Identity Services. Separate from the login token client in
 *  googleAuthWeb.ts, since login only asks for profile/email.
 *
 *  Only ever called with an already-decided need to go interactive (see
 *  getDriveAccessToken) — never from a background/automatic code path. */
function requestWebDriveToken(): Promise<string> {
  if (pendingWebDriveTokenRequest) return pendingWebDriveTokenRequest;

  pendingWebDriveTokenRequest = new Promise<string>((resolve, reject) => {
    ensureGisLoaded()
      .catch(() => {
        reject(new Error("Could not load Google Identity Services. Check your connection and try again."));
      })
      .then(() => {
        const google = (window as any).google;
        if (!google?.accounts?.oauth2) {
          reject(new Error("Google Identity Services is not loaded. Sign out and back in, then try again."));
          return;
        }
        if (!webDriveTokenClient) {
          webDriveTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_WEB_CLIENT_ID,
            scope: DRIVE_SCOPE,
            callback: () => {}
          });
        }
        webDriveTokenClient.callback = (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          const token = response.access_token as string;
          const expiresInSec = Number(response.expires_in) || 3600;
          const cached: CachedWebToken = { token, expiresAt: Date.now() + expiresInSec * 1000 };
          cachedWebDriveToken = cached;
          persistWebToken(cached);
          resolve(token);
        };
        webDriveTokenClient.error_callback = (err: any) => {
          reject(new Error(err?.message ?? "Google Drive access denied."));
        };
        // Empty prompt: reuse an existing grant silently when possible;
        // Google still shows its own UI the first time consent is needed.
        webDriveTokenClient.requestAccessToken({ prompt: "" });
      });
  }).finally(() => {
    pendingWebDriveTokenRequest = null;
  });

  return pendingWebDriveTokenRequest;
}

/**
 * @param interactive Whether it's OK, as a last resort, to fall through to
 *   Google Identity Services' `requestAccessToken` — which can open its own
 *   popup/UI when a token can't be silently reused (e.g. third-party
 *   cookies blocked). Pass `true` only from code that runs directly off a
 *   user's click (Settings' "Sync now"/"Restore" buttons, turning auto sync
 *   on). Every automatic/background caller (page load, tab focus, the
 *   debounced sync after a local edit) must pass `false`, so a refresh can
 *   never trigger that popup — it just throws DriveAuthRequiredError
 *   instead, which callers treat as "skip silently, try again later."
 */
async function getDriveAccessToken(interactive: boolean): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    // GoogleAuth.refresh() reuses the OS-level Google session silently and
    // never shows UI, so it's unaffected by the interactive/background
    // distinction above — safe to call from any context.
    const result: any = await GoogleAuth.refresh();
    const token = result?.accessToken;
    if (!token) {
      throw new Error("Google session expired — sign out and back in, then try again.");
    }
    return token;
  }

  if (cachedWebDriveToken && cachedWebDriveToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return cachedWebDriveToken.token;
  }

  // Access token missing/expired — try the refresh token first. This is
  // silent (no popup, no Google cookies) and is what keeps the user signed
  // in for months, in the background, on every automatic sync.
  const refreshed = await refreshWebDriveToken();
  if (refreshed) return refreshed;

  if (!interactive) {
    throw new DriveAuthRequiredError();
  }
  return requestWebDriveToken();
}

/** Drops the cached web token (memory + persisted copy) so the next sync
 *  asks Google for a fresh one. Call this if a Drive request comes back
 *  401'd — the cached token is no longer valid despite not looking
 *  "expired" yet — and on sign-out, so a new account's first sync doesn't
 *  reuse the previous account's leftover token. */
function invalidateCachedWebDriveToken(): void {
  cachedWebDriveToken = null;
  cachedWebDriveRefreshToken = null;
  try {
    window.localStorage?.removeItem(WEB_TOKEN_STORAGE_KEY);
    window.localStorage?.removeItem(WEB_REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore — nothing to clean up if storage isn't available.
  }
}

export function clearDriveWebSession(): void {
  if (!Capacitor.isNativePlatform()) invalidateCachedWebDriveToken();
}

/** Called right after a successful web sign-in, which now requests
 *  DRIVE_SCOPE up front (see googleAuthWeb.ts) — feeds that already-granted
 *  access token straight into the cache so the very first sync doesn't
 *  need to ask Google again, and persists it so it survives a refresh.
 *  @param refreshToken When present (see the note in googleAuthWeb.ts
 *  about when Google omits it), persisted so future access-token renewals
 *  can happen silently via /api/google/refresh instead of ever prompting
 *  the user again. Existing sessions that already have a stored refresh
 *  token are left alone if this sign-in didn't get a new one. */
export function seedWebDriveToken(token: string, expiresInSec: number, refreshToken?: string | null): void {
  if (Capacitor.isNativePlatform()) return;
  const cached: CachedWebToken = { token, expiresAt: Date.now() + expiresInSec * 1000 };
  cachedWebDriveToken = cached;
  persistWebToken(cached);
  if (refreshToken) {
    cachedWebDriveRefreshToken = refreshToken;
    persistRefreshToken(refreshToken);
  }
}

/* -------------------------------- Drive API -------------------------------- */

/** Turns a failed Drive API response into a precise, actionable message
 *  instead of a bare status code — Google's JSON error body almost always
 *  says exactly what's wrong (disabled API, missing scope, expired token…). */
async function describeDriveApiError(res: Response): Promise<string> {
  let detail = "";
  let reason = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? "";
    reason = body?.error?.errors?.[0]?.reason ?? "";
  } catch {
    detail = await res.text().catch(() => "");
  }

  if (res.status === 401) {
    // The cached token (if any) is bad despite not looking "expired" yet —
    // drop it so the next attempt asks Google for a fresh one instead of
    // reusing the same rejected token forever.
    clearDriveWebSession();
    return `Google session expired or invalid (401). Sign out, sign back in, then try again. ${detail}`.trim();
  }
  if (res.status === 403 && /insufficient|scope/i.test(detail + reason)) {
    return (
      "This account hasn't granted Google Drive access yet (drive.file scope missing from the current token). " +
      "Sign out and back in to grant that permission again, then retry the backup. " +
      `Google detail: ${detail || reason}`
    );
  }
  if (res.status === 403 && /disabled|has not been used|API_NOT_ACTIVATED/i.test(detail + reason)) {
    return (
      "The Google Drive API isn't enabled on the Google Cloud project used by the app. " +
      "Enable it at console.cloud.google.com → APIs & Services → Library → Google Drive API, " +
      "wait a minute, then try again. " +
      `Google detail: ${detail || reason}`
    );
  }
  return `Google Drive error (${res.status}${reason ? ` — ${reason}` : ""}). ${detail}`.trim();
}

async function findBackupFileId(accessToken: string): Promise<string | null> {
  const cached = await getDriveFileId();
  if (cached) return cached;

  const q = encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Could not search for the backup on Google Drive. ${await describeDriveApiError(res)}`);
  }
  const json = await res.json();
  const fileId: string | null = json.files?.[0]?.id ?? null;
  if (fileId) await setDriveFileId(fileId);
  return fileId;
}

/** Uploads (creating or overwriting) the single backup JSON file on Drive.
 *  @param interactive See getDriveAccessToken — defaults to true for
 *  Settings' explicit "Sync now" button. Any caller that isn't a direct
 *  response to that kind of deliberate click (the debounced background
 *  auto-push in runAutoSync, the daily-note auto-save) must pass false. */
export async function backupToDrive(interactive: boolean = true): Promise<Date> {
  const accessToken = await getDriveAccessToken(interactive);
  const payload = await collectBackupPayload();
  const fileContents = JSON.stringify(payload, null, 2);

  const existingId = await findBackupFileId(accessToken);
  const metadata = existingId ? {} : { name: BACKUP_FILENAME, mimeType: "application/json" };

  const boundary = "habitude-backup-boundary";
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${fileContents}\r\n` +
    `--${boundary}--`;

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;

  const res = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!res.ok) {
    throw new Error(`Google Drive backup failed. ${await describeDriveApiError(res)}`);
  }

  const json = await res.json();
  if (json.id) await setDriveFileId(json.id);
  // Remember the version we just pushed so a subsequent auto-pull (e.g. on
  // this same device resuming) recognizes it's already caught up, instead
  // of re-downloading the file it just uploaded.
  if (json.modifiedTime) await setDriveModifiedAt(json.modifiedTime);

  const now = new Date();
  await setLastBackupAt(now);
  return now;
}

/** Downloads the backup file from Drive and replaces local app data with it.
 *  Always called directly from Settings' "Restore" button, so it's fine to
 *  fall through to an interactive Google prompt if needed. */
export async function restoreFromDrive(): Promise<void> {
  const accessToken = await getDriveAccessToken(true);
  const fileId = await findBackupFileId(accessToken);
  if (!fileId) {
    throw new Error("No Habitude backup found on this Google Drive account.");
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to retrieve the backup. ${await describeDriveApiError(res)}`);
  }

  const data = (await res.json()) as BackupPayload;
  await applyBackupPayload(data);

  // A manual restore always fetches the current file, so whatever its
  // modifiedTime is right now is "caught up" from this device's perspective.
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).catch(() => null);
  const meta = metaRes && metaRes.ok ? await metaRes.json().catch(() => null) : null;
  if (meta?.modifiedTime) await setDriveModifiedAt(meta.modifiedTime);
}

/**
 * Checks whether the Drive backup has changed since this device last saw it
 * (pushed or pulled) and, if so, downloads and applies it. This is what
 * makes sync two-way: `backupToDrive`/auto-push handles local → Drive,
 * this handles Drive → local, so a change made on one device shows up on
 * the other without anyone tapping "Restore" by hand.
 *
 * Safe to call opportunistically (app open, app resume, tab refocus) — it's
 * a no-op, aside from one cheap metadata request, whenever nothing changed.
 * Returns true if it pulled and applied new data.
 *
 * Always runs non-interactively: this fires automatically on every app
 * open/refresh/focus, so it must never be able to pop up a Google sign-in
 * window. If there's no already-cached Drive token, it throws
 * DriveAuthRequiredError instead of asking Google for one — see
 * getDriveAccessToken.
 */
export async function pullFromDriveIfNewer(): Promise<boolean> {
  const accessToken = await getDriveAccessToken(false);
  const fileId = await findBackupFileId(accessToken);
  if (!fileId) return false;

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) {
    throw new Error(`Could not check the backup's last-modified time. ${await describeDriveApiError(metaRes)}`);
  }
  const meta = await metaRes.json();
  const remoteModifiedAt: string | undefined = meta.modifiedTime;
  if (!remoteModifiedAt) return false;

  const knownModifiedAt = await getDriveModifiedAt();
  if (knownModifiedAt && remoteModifiedAt <= knownModifiedAt) {
    // Nothing new since we last pushed or pulled — most calls end here.
    return false;
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to retrieve the backup. ${await describeDriveApiError(res)}`);
  }

  const data = (await res.json()) as BackupPayload;
  await applyBackupPayload(data);
  await setDriveModifiedAt(remoteModifiedAt);
  return true;
}

export { getLastBackupAt };

/* ------------------------------- Auto sync ------------------------------- */

/**
 * Watches the habits/logs/todos tables and, whenever auto sync is turned
 * on and a Drive session exists, pushes a fresh backup a few seconds after
 * the last change — so the Drive copy stays current without the user ever
 * tapping the manual "back up" button.
 *
 * Debounced (not per-write) on purpose: a run of quick edits (checking off
 * several habits in a row, editing a habit's fields) collapses into a
 * single upload instead of one per keystroke/tap.
 */

export type AutoSyncStatus = "idle" | "pending" | "syncing" | "synced" | "error";

export interface AutoSyncState {
  status: AutoSyncStatus;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

const AUTO_SYNC_DEBOUNCE_MS = 2500;

let autoSyncState: AutoSyncState = { status: "idle", lastSyncedAt: null, lastError: null };
const autoSyncListeners = new Set<(state: AutoSyncState) => void>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let hooksInstalled = false;

function setAutoSyncState(patch: Partial<AutoSyncState>): void {
  autoSyncState = { ...autoSyncState, ...patch };
  for (const listener of autoSyncListeners) listener(autoSyncState);
}

/** Subscribe to auto-sync status changes; returns an unsubscribe function.
 *  Immediately calls back with the current state so callers don't have to
 *  wait for the next change to render something. */
export function onAutoSyncStateChange(listener: (state: AutoSyncState) => void): () => void {
  autoSyncListeners.add(listener);
  listener(autoSyncState);
  return () => {
    autoSyncListeners.delete(listener);
  };
}

export function getAutoSyncState(): AutoSyncState {
  return autoSyncState;
}

/** @param interactive Only true when called from runAutoSyncNow() in direct
 *  response to the user flipping auto sync on — see getDriveAccessToken.
 *  The debounced background path (scheduleAutoSync) always leaves this
 *  false, so a run of local edits can never pop up a Google sign-in
 *  window; it just quietly skips the push if there's no cached token. */
async function runAutoSync(interactive: boolean = false): Promise<void> {
  const [enabled, session] = await Promise.all([getAutoSyncEnabled(), getSession()]);
  if (!enabled || !session) {
    setAutoSyncState({ status: "idle" });
    return;
  }

  setAutoSyncState({ status: "syncing", lastError: null });
  try {
    const now = await backupToDrive(interactive);
    setAutoSyncState({ status: "synced", lastSyncedAt: now, lastError: null });
  } catch (error) {
    if (error instanceof DriveAuthRequiredError) {
      // Expected in the background whenever there's no live cached token
      // (fresh page load, token expired) — not a real failure, and never
      // worth surfacing as a scary "sync error" on every refresh. The next
      // interactive sync (or the user reconnecting) resolves it.
      setAutoSyncState({ status: "idle", lastError: null });
      return;
    }
    setAutoSyncState({
      status: "error",
      lastError: error instanceof Error ? error.message : "Auto sync failed."
    });
  }
}

/** Called from every tracked table's create/update/delete hook. Cheap and
 *  synchronous — the actual network call happens after the debounce, well
 *  outside of Dexie's write transaction. */
function scheduleAutoSync(): void {
  // Data just arrived FROM Drive (a restore/pull) — don't treat it as a
  // local edit and push it straight back up.
  if (isApplyingRemoteData) return;
  setAutoSyncState({ status: "pending" });
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runAutoSync();
  }, AUTO_SYNC_DEBOUNCE_MS);
}

/** Immediately (no debounce) runs a sync attempt — used when the user first
 *  flips auto sync on, so they get instant feedback instead of waiting for
 *  the next edit. */
export function runAutoSyncNow(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  // interactive: true — this only ever runs off the user's own click
  // (turning auto sync on in Settings), so it's fine for it to prompt
  // Google if there's no cached token yet.
  return runAutoSync(true);
}

/**
 * Runs `pullFromDriveIfNewer` if auto sync is on and a Drive session
 * exists — called on app start and whenever the app/tab comes back to the
 * foreground (see `initAutoPull`). Skipped while a local push is pending or
 * in flight, so a pull can't race a push and clobber the edit that's about
 * to go out.
 */
export async function runAutoPull(): Promise<void> {
  if (debounceTimer || autoSyncState.status === "syncing") return;
  const [enabled, session] = await Promise.all([getAutoSyncEnabled(), getSession()]);
  if (!enabled || !session) return;

  try {
    const pulled = await pullFromDriveIfNewer();
    if (pulled) setAutoSyncState({ status: "synced", lastSyncedAt: new Date(), lastError: null });
  } catch (error) {
    if (error instanceof DriveAuthRequiredError) {
      // Same reasoning as in runAutoSync: this runs automatically on every
      // load/focus, so a missing/expired token is expected, not an error —
      // and must never trigger Google's sign-in popup on its own.
      setAutoSyncState({ status: "idle", lastError: null });
      return;
    }
    setAutoSyncState({
      status: "error",
      lastError: error instanceof Error ? error.message : "Auto pull failed."
    });
  }
}

let autoPullHooksInstalled = false;

/** Wires up the "pull the latest Drive backup" checks: once on startup,
 *  then again every time the app is foregrounded (native `App.resume`,
 *  or the web tab/window regaining focus/visibility). Safe to call more
 *  than once — only installs the listeners the first time. */
export function initAutoPull(): void {
  if (autoPullHooksInstalled) return;
  autoPullHooksInstalled = true;

  void runAutoPull();

  if (Capacitor.isNativePlatform()) {
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void runAutoPull();
    });
  } else {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void runAutoPull();
    });
    window.addEventListener("focus", () => void runAutoPull());
  }
}

/** Installs the Dexie hooks that trigger auto sync. Safe to call more than
 *  once (e.g. React StrictMode double-invoking an effect) — only wires up
 *  the listeners the first time. Whether a change actually results in a
 *  Drive upload is decided per-change inside runAutoSync(), so this can be
 *  installed unconditionally at app startup regardless of the current
 *  enabled/signed-in state. */
export function initAutoSync(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  for (const table of [db.habits, db.logs, db.todos, db.dailyNotes, db.activityLogs]) {
    table.hook("creating", () => {
      scheduleAutoSync();
    });
    table.hook("updating", () => {
      scheduleAutoSync();
    });
    table.hook("deleting", () => {
      scheduleAutoSync();
    });
  }
}

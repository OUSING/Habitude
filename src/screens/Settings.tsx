import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Chrome, Cloud, CloudDownload, Download, FileDown, FileUp, Footprints, LogOut, UserCircle2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { exportHabitsCsv, exportTodosCsv, importCsv } from "../services/csvBackup";
import { backupToDrive, restoreFromDrive, runAutoSyncNow } from "../services/driveBackup";
import { getAutoSyncEnabled, getLastBackupAt, setAutoSyncEnabled, getAutoStepsEnabled, type FontPreference } from "../services/settings";
import { enableAutoSteps, disableAutoSteps, getStepsToday, isStepsAvailableOnDevice } from "../services/stepTracker";
import { useAutoSyncState } from "../hooks/useAutoSync";
import { useConfirm } from "../components/ui/ConfirmDialog";

interface Props {
  session: { email: string; provider: "google" } | null;
  onSignIn: () => Promise<any>;
  onSignOut: () => Promise<void>;
  font: FontPreference;
  onFontChange: (font: FontPreference) => void;
}

export function Settings({ session, onSignIn, onSignOut, font, onFontChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"habits" | "tasks" | "import" | "signin" | "signout" | "drive" | "restore" | "autoSyncToggle" | "autoStepsToggle" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAtState] = useState<Date | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(false);
  const [autoStepsEnabled, setAutoStepsEnabledState] = useState(false);
  const [autoStepsAvailable, setAutoStepsAvailableState] = useState(true);
  const autoSync = useAutoSyncState();
  const confirm = useConfirm();
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    getLastBackupAt().then(setLastBackupAtState);
    getAutoSyncEnabled().then(setAutoSyncEnabledState);
    getAutoStepsEnabled().then(setAutoStepsEnabledState);
    if (isNative) {
      isStepsAvailableOnDevice().then(setAutoStepsAvailableState);
    } else {
      setAutoStepsAvailableState(false);
    }
  }, []);

  // Auto sync updates lastBackupAt on its own, in the background — keep the
  // displayed timestamp in sync with it without waiting for a re-fetch.
  useEffect(() => {
    if (autoSync.status === "synced" && autoSync.lastSyncedAt) {
      setLastBackupAtState(autoSync.lastSyncedAt);
    }
  }, [autoSync.status, autoSync.lastSyncedAt]);

  async function download(kind: "habits" | "tasks") {
    if (busy) return;
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === "habits") await exportHabitsCsv();
      else await exportTodosCsv();
      setMessage(kind === "habits" ? "Habits CSV downloaded." : "Tasks CSV downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    setBusy("import");
    setMessage(null);
    try {
      const result = await importCsv(await file.text());
      setMessage(result.summary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV import failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSignIn() {
    if (busy) return;
    setBusy("signin");
    setMessage(null);
    try { await onSignIn(); setMessage("Google account connected."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in failed."); }
    finally { setBusy(null); }
  }

  async function handleDriveSync() {
    if (busy) return;
    if (!session) {
      setMessage("Connect your Google account first to synchronize with Google Drive.");
      return;
    }
    setBusy("drive");
    setMessage(null);
    try {
      const syncedAt = await backupToDrive();
      setLastBackupAtState(syncedAt);
      setMessage(`Synchronized with Google Drive at ${syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Drive synchronization failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDriveRestore() {
    if (busy) return;
    if (!session) {
      setMessage("Connect your Google account first to synchronize with Google Drive.");
      return;
    }
    const ok = await confirm({
      title: "Restore Backup?",
      message: "This will overwrite all of your current habits, logs, and tasks with the Google Drive backup. This cannot be undone.",
      confirmText: "Restore Data",
      cancelText: "Keep Current Data",
      type: "warning"
    });
    if (!ok) return;

    setBusy("restore");
    setMessage(null);
    try {
      await restoreFromDrive();
      setMessage("Restored. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to restore from Google Drive.");
      setBusy(null);
    }
  }

  async function handleToggleAutoSync() {
    if (busy) return;
    const next = !autoSyncEnabled;
    setBusy("autoSyncToggle");
    setMessage(null);
    try {
      await setAutoSyncEnabled(next);
      setAutoSyncEnabledState(next);
      if (next) {
        // Confirm right away, rather than making the user wait for their
        // next edit to find out whether Drive access actually works.
        await runAutoSyncNow();
      }
    } catch (error) {
      setAutoSyncEnabledState(!next);
      await setAutoSyncEnabled(!next);
      setMessage(error instanceof Error ? error.message : "Couldn't turn on auto sync.");
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleAutoSteps() {
    if (busy) return;
    setBusy("autoStepsToggle");
    setMessage(null);
    try {
      if (autoStepsEnabled) {
        await disableAutoSteps();
        setAutoStepsEnabledState(false);
      } else {
        const permission = await enableAutoSteps();
        if (permission !== "granted") {
          setMessage(
            permission === "denied"
              ? "Allow physical activity access in your device settings to enable step tracking."
              : "Step tracking is unavailable on this device."
          );
          setAutoStepsEnabledState(false);
        } else {
          setAutoStepsEnabledState(true);
          void getStepsToday();
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't toggle step tracking.");
    } finally {
      setBusy(null);
    }
  }

  const autoSyncStatusText =
    autoSync.status === "syncing"
      ? "Syncing…"
      : autoSync.status === "pending"
      ? "Sync pending…"
      : autoSync.status === "error"
      ? `Auto sync failed${autoSync.lastError ? ` — ${autoSync.lastError}` : ""}`
      : null;

  async function handleSignOut() {
    if (busy) return;
    setBusy("signout");
    setMessage(null);
    try { await onSignOut(); setMessage("Signed out."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sign out failed."); }
    finally { setBusy(null); }
  }

  return (
    <div className="settings-screen scroll-area">
      <div className="settings-content">
        <section className="settings-card">
          <div className="settings-section-title">Account</div>
          <div className="settings-row settings-account-row">
            <div className="settings-row-icon"><UserCircle2 size={18} /></div>
            <div className="settings-row-copy">
              <strong>{session ? "Google account" : "Sign in with Google"}</strong>
              <span>{session ? session.email : "Sign in to keep your account connected."}</span>
            </div>
            {session ? (
              <button className="settings-action settings-danger" onClick={() => void handleSignOut()} disabled={busy !== null}>
                <LogOut size={14} /> {busy === "signout" ? "Signing out…" : "Sign out"}
              </button>
            ) : (
              <button className="settings-action" onClick={() => void handleSignIn()} disabled={busy !== null}>
                <Chrome size={14} /> {busy === "signin" ? "Connecting…" : "Connect"}
              </button>
            )}
          </div>
          <p className="settings-hint">Connect your Google account to synchronize your Habitude data with Google Drive.</p>
        </section>

        <section className="settings-card settings-font-card">
          <div className="settings-section-title">Font</div>
          <div className="settings-font-options" role="radiogroup" aria-label="App font">
            {([
              ["jojoba", "Jojoba", "Friendly handwritten"],
              ["pretty-neat", "Pretty Neat", "Clean handwritten"],
            ] as const).map(([value, label, description]) => {
              const active = font === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`settings-font-option ${active ? "is-active" : ""}`}
                  data-font-preview={value}
                  onClick={() => onFontChange(value)}
                >
                  <span className="settings-font-preview">Aa</span>
                  <span className="settings-font-copy">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="settings-font-check">{active ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-title">Data</div>
          <div className="settings-row">
            <div className="settings-row-icon"><Cloud size={17} /></div>
            <div className="settings-row-copy">
              <strong>Google Drive</strong>
              <span>{autoSyncStatusText ?? (lastBackupAt ? `Backed up ${lastBackupAt.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Synchronize habits, logs, tasks, notes, steps and runs")}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="settings-row-action" onClick={() => void handleDriveSync()} disabled={busy !== null}>
                {busy === "drive" ? "Backing up…" : <><Cloud size={14} /> Back up</>}
              </button>
              <button className="settings-row-action" onClick={() => void handleDriveRestore()} disabled={busy !== null}>
                {busy === "restore" ? "Restoring…" : <><CloudDownload size={14} /> Restore</>}
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-icon"><Cloud size={17} /></div>
            <div className="settings-row-copy">
              <strong>Auto sync</strong>
              <span>{autoSyncEnabled ? "Backs up to Drive automatically after changes." : "Turn on to back up automatically after changes."}</span>
            </div>
            <button
              onClick={() => void handleToggleAutoSync()}
              disabled={busy !== null && busy !== "autoSyncToggle"}
              aria-pressed={autoSyncEnabled}
              className={[
                "tap-target relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
                autoSyncEnabled ? "bg-brand" : "bg-surface-2"
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  autoSyncEnabled ? "translate-x-5" : "translate-x-0.5"
                ].join(" ")}
              />
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-icon"><Footprints size={17} /></div>
            <div className="settings-row-copy">
              <strong>Automate step tracking</strong>
              <span>
                {!isNative
                  ? "Available on the mobile app."
                  : !autoStepsAvailable
                  ? "Step sensor isn't available on this device."
                  : autoStepsEnabled
                  ? "Steps are tracked automatically in the background."
                  : "Turn on to track your steps automatically."}
              </span>
            </div>
            <button
              onClick={() => void handleToggleAutoSteps()}
              disabled={(busy !== null && busy !== "autoStepsToggle") || !isNative || !autoStepsAvailable}
              aria-pressed={autoStepsEnabled}
              className={[
                "tap-target relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
                autoStepsEnabled ? "bg-brand" : "bg-surface-2"
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  autoStepsEnabled ? "translate-x-5" : "translate-x-0.5"
                ].join(" ")}
              />
            </button>
          </div>
          <button className="settings-row settings-button-row" onClick={() => void download("habits")} disabled={busy !== null}>
            <div className="settings-row-icon"><FileDown size={17} /></div>
            <div className="settings-row-copy"><strong>Habits</strong><span>habitude-habits.csv</span></div>
            <span className="settings-row-action">{busy === "habits" ? "Exporting…" : <><Download size={14} /> Export</>}</span>
          </button>
          <button className="settings-row settings-button-row" onClick={() => void download("tasks")} disabled={busy !== null}>
            <div className="settings-row-icon"><FileDown size={17} /></div>
            <div className="settings-row-copy"><strong>Tasks</strong><span>habitude-todos.csv</span></div>
            <span className="settings-row-action">{busy === "tasks" ? "Exporting…" : <><Download size={14} /> Export</>}</span>
          </button>
          <button className="settings-row settings-button-row" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
            <div className="settings-row-icon"><FileUp size={17} /></div>
            <div className="settings-row-copy"><strong>Import CSV</strong><span>Restore habits or tasks from a CSV file</span></div>
            <span className="settings-row-action">{busy === "import" ? "Importing…" : "Choose file"}</span>
          </button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleImport} hidden />
        </section>

        {message && <div className="settings-message" role="status">{message}</div>}
      </div>
    </div>
  );
}

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { db } from "./db";
import { StepCounter, type StepsPermissionState } from "../platform/stepCounter";
import { deleteHabitPermanently } from "./habitService";
import { getAutoStepsEnabled, getStepsHabitId, setAutoStepsEnabled, setStepsHabitId } from "./settings";

function isNative(): boolean { return Capacitor.isNativePlatform(); }

export function stepsPluginSupported(): boolean { return isNative(); }

export async function checkStepsPermission(): Promise<StepsPermissionState> {
  if (!isNative()) return "unavailable";
  try { return (await StepCounter.checkPermissions()).steps; }
  catch (err) { console.warn("Step permission check failed", err); return "unavailable"; }
}

export async function requestStepsPermission(): Promise<StepsPermissionState> {
  if (!isNative()) return "unavailable";
  try { return (await StepCounter.requestPermissions()).steps; }
  catch (err) { console.warn("Step permission request failed", err); return "denied"; }
}

export async function isStepsAvailableOnDevice(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await StepCounter.isAvailable()).available; }
  catch (err) { console.warn("Step sensor availability check failed", err); return false; }
}

/** Read-only current count. This never writes to habits or changes the count. */
export async function getStepsToday(): Promise<number | null> {
  if (!isNative() || !(await getAutoStepsEnabled())) return null;
  try {
    if ((await checkStepsPermission()) !== "granted") return null;
    if (!(await isStepsAvailableOnDevice())) return null;
    return (await StepCounter.sync()).today;
  } catch (err) {
    console.warn("Reading today's steps failed", err);
    return null;
  }
}

/** Read-only historical step count used by the Steps charts. */
export async function getStepsForDate(date: string): Promise<number> {
  if (!isNative()) return 0;
  try {
    if ((await checkStepsPermission()) !== "granted") return 0;
    const { steps } = await StepCounter.getSteps({ date });
    return Math.max(0, Math.round(steps));
  } catch (err) {
    console.warn(`Reading steps for ${date} failed`, err);
    return 0;
  }
}

let liveListenerHandle: PluginListenerHandle | undefined;
let liveListenerStart: Promise<void> | undefined;

/** Removes the old automatically-created Steps habit, if this app version made one. */
export async function removeLegacyStepsHabit(): Promise<void> {
  const id = await getStepsHabitId();
  if (id == null) return;
  try { await deleteHabitPermanently(id); } catch (err) { console.warn("Could not remove legacy Steps habit", err); }
  await setStepsHabitId(-1);
}

/** Starts the native listener. It only updates the step-counter UI through the
 * plugin event; it never creates or logs a habit. */
export async function startLiveStepUpdates(): Promise<void> {
  if (!isNative() || liveListenerHandle || liveListenerStart) return;
  liveListenerStart = (async () => {
    if (!(await getAutoStepsEnabled())) return;
    if ((await checkStepsPermission()) !== "granted") return;
    await removeLegacyStepsHabit();
    liveListenerHandle = await StepCounter.addListener("stepsChanged", () => {
      // The UI subscribes directly to the same native event. Nothing is written to habits here.
    });
  })();
  try { await liveListenerStart; } finally { liveListenerStart = undefined; }
}

export function stopLiveStepUpdates(): void {
  void liveListenerHandle?.remove();
  liveListenerHandle = undefined;
  liveListenerStart = undefined;
}

export async function enableAutoSteps(): Promise<StepsPermissionState> {
  const permission = await requestStepsPermission();
  if (permission === "granted") {
    await setAutoStepsEnabled(true);
    await removeLegacyStepsHabit();
    await startLiveStepUpdates();
  }
  return permission;
}

export async function disableAutoSteps(): Promise<void> {
  await setAutoStepsEnabled(false);
  stopLiveStepUpdates();
  // Tears down the Android foreground service that would otherwise keep
  // counting in the background — without this, turning the in-app toggle
  // off wouldn't actually stop tracking. No-op on iOS/web.
  if (isNative()) {
    try { await StepCounter.stopTracking(); }
    catch (err) { console.warn("Failed to stop background step tracking", err); }
  }
}


/** Captures the phone's daily pedometer totals into the synchronized
 * activity log. Existing dates are overwritten, making repeated syncs
 * idempotent rather than creating duplicate entries. */
export async function syncStepHistory(days = 90): Promise<void> {
  if (!isNative() || !(await getAutoStepsEnabled())) return;
  if ((await checkStepsPermission()) !== "granted") return;
  if (!(await isStepsAvailableOnDevice())) return;

  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try {
      const { steps } = await StepCounter.getSteps({ date });
      const value = Math.max(0, Math.round(steps));
      const id = `steps-${date}`;
      const existing = await db.activityLogs.get(id);
      if (existing?.type === "steps" && existing.value === value) continue;
      await db.activityLogs.put({
        id,
        date,
        type: "steps",
        value,
        source: "phone",
        createdAt: Date.now()
      });
    } catch (err) {
      console.warn(`Could not sync steps for ${date}`, err);
    }
  }
}

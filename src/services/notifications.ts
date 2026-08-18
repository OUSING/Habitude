import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Habit } from "../types/habit";

/**
 * All functions here are safe to call unconditionally from anywhere in
 * the app (web dev server included). On a real device, once this is
 * wrapped with `npx cap sync`, they schedule genuine OS-level local
 * notifications — no server or push service required.
 */

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Call once on app start (see hooks/useNotificationSetup.ts). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  } catch (err) {
    console.warn("Notification permission request failed", err);
    return false;
  }
}

/** Deterministic 32-bit notification id derived from the habit's row id. */
function notificationIdFor(habitId: number): number {
  return habitId;
}

export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  if (!isNative() || !habit.reminderTime || !habit.id) return;
  const [hour, minute] = habit.reminderTime.split(":").map(Number);

  try {
    // Clear any previous reminder for this habit before rescheduling —
    // avoids duplicate notifications if the time was edited.
    await LocalNotifications.cancel({ notifications: [{ id: notificationIdFor(habit.id) }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationIdFor(habit.id),
          title: "Habit reminder",
          body: `Time for: ${habit.name}`,
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
          smallIcon: "ic_stat_habit"
        }
      ]
    });
  } catch (err) {
    console.warn("Failed to schedule reminder", err);
  }
}

export async function cancelHabitReminder(habitId: number): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationIdFor(habitId) }] });
  } catch (err) {
    console.warn("Failed to cancel reminder", err);
  }
}

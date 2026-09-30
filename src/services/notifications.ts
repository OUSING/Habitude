import type { Habit } from "../types/habit";

/**
 * Habit reminders using the browser Notification API.
 *
 * A web page can only show these while it is open (a tab, or the installed
 * app window) — there is no OS-level scheduling without a push server — so
 * reminders are timers that live as long as the page does. Everything here
 * is safe to call unconditionally: on browsers without Notification support
 * it quietly does nothing.
 */

const timers = new Map<number, number>();

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

/** Asks the browser for permission (must be called from a click/tap). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch (err) {
    console.warn("Notification permission request failed", err);
    return false;
  }
}

/** Milliseconds until the next occurrence of hh:mm (always in the future). */
function msUntilNext(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function show(habit: Habit): void {
  try {
    new Notification("Habit reminder", {
      body: `Time for: ${habit.name}`,
      icon: "./icon-192.png",
      tag: `habit-${habit.id}`
    });
  } catch (err) {
    // Some mobile browsers only allow notifications from a service worker.
    console.warn("Could not show reminder", err);
  }
}

export async function cancelHabitReminder(habitId: number): Promise<void> {
  const t = timers.get(habitId);
  if (t != null) window.clearTimeout(t);
  timers.delete(habitId);
}

export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  if (habit.id == null) return;
  const id = habit.id;
  await cancelHabitReminder(id);
  if (!habit.reminderTime || habit.archived || notificationPermission() !== "granted") return;

  const [hour, minute] = habit.reminderTime.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return;

  const arm = () => {
    timers.set(
      id,
      window.setTimeout(() => {
        show(habit);
        arm(); // and again tomorrow
      }, msUntilNext(hour, minute))
    );
  };
  arm();
}

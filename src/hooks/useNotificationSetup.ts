import { useEffect } from "react";
import { db } from "../services/db";
import { notificationPermission, scheduleHabitReminder } from "../services/notifications";

/** On startup, re-arm every habit reminder (timers don't survive a reload). */
export function useNotificationSetup() {
  useEffect(() => {
    if (notificationPermission() !== "granted") return;
    void db.habits.toArray().then((habits) => {
      for (const habit of habits) void scheduleHabitReminder(habit);
    });
  }, []);
}

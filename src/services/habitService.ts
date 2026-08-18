import { db } from "./db";
import type { Habit, HabitLog, NewHabit } from "../types/habit";
import { cancelHabitReminder, scheduleHabitReminder } from "./notifications";
import { completionRateSync, computeStreakSync } from "../utils/streak";

/* ------------------------------ Habits ------------------------------ */

/** Top-level habits only (no parentId) — sub-habits are fetched separately
 *  via listSubHabits/useSubHabits and rendered nested under their parent. */
export async function listHabits(): Promise<Habit[]> {
  const all = await db.habits.toArray();
  return all.filter((h) => !h.archived && h.parentId == null).sort((a, b) => a.createdAt - b.createdAt);
}

/** Non-archived sub-habits nested under a given main habit. */
export async function listSubHabits(parentId: number): Promise<Habit[]> {
  const subs = await db.habits.where("parentId").equals(parentId).toArray();
  return subs.filter((h) => !h.archived).sort((a, b) => a.createdAt - b.createdAt);
}

export async function getHabit(id: number): Promise<Habit | undefined> {
  return db.habits.get(id);
}

export async function createHabit(input: NewHabit): Promise<Habit> {
  const habit: Habit = {
    ...input,
    createdAt: Date.now(),
    archived: false
  };
  const id = await db.habits.add(habit);
  const saved = { ...habit, id };
  await scheduleHabitReminder(saved); // no-op outside a native shell, see services/notifications.ts
  return saved;
}

/** Convenience wrapper for adding a sub-habit under a main habit — reuses
 *  the parent's color and a daily/simple check-off schedule by default. */
export async function createSubHabit(parentId: number, name: string): Promise<Habit> {
  const parent = await getHabit(parentId);
  return createHabit({
    name,
    color: parent?.color ?? "#2F6F5E",
    icon: "check",
    frequency: { type: "daily" },
    parentId
  });
}

export async function updateHabit(id: number, patch: Partial<Habit>): Promise<void> {
  await db.habits.update(id, patch);
  const updated = await db.habits.get(id);
  if (updated) await scheduleHabitReminder(updated);
}

/** Soft delete: keeps historical logs/stats intact, just hides the habit.
 *  Archiving a main habit also archives its sub-habits, so they don't
 *  linger orphaned on the dashboard. */
export async function archiveHabit(id: number): Promise<void> {
  await db.habits.update(id, { archived: true });
  await cancelHabitReminder(id);
  const subs = await db.habits.where("parentId").equals(id).toArray();
  for (const sub of subs) {
    if (!sub.archived) await archiveHabit(sub.id!);
  }
}

export async function deleteHabitPermanently(id: number): Promise<void> {
  await db.transaction("rw", db.habits, db.logs, async () => {
    await db.logs.where("habitId").equals(id).delete();
    await db.habits.delete(id);
  });
  await cancelHabitReminder(id);
}

/* -------------------------------- Logs ------------------------------- */

export async function getLog(habitId: number, date: string): Promise<HabitLog | undefined> {
  return db.logs.where("[habitId+date]").equals([habitId, date]).first();
}

export async function isCompletedOn(habitId: number, date: string): Promise<boolean> {
  const log = await getLog(habitId, date);
  return !!log?.completed;
}

export async function isRestedOn(habitId: number, date: string): Promise<boolean> {
  const log = await getLog(habitId, date);
  return !!log?.rested;
}

/** Flips completion for a given day and returns the new state. Clears any
 *  rest flag on that day — a day can't be both completed and rested. */
export async function toggleLog(habitId: number, date: string): Promise<boolean> {
  const existing = await getLog(habitId, date);
  if (existing) {
    const next = !existing.completed;
    await db.logs.update(existing.id!, { completed: next, rested: false });
    return next;
  }
  await db.logs.add({ habitId, date, completed: true });
  return true;
}

/** Flips the "rest day" flag for a given day and returns the new state.
 *  A rest day is excused: it's skipped by streak/completion-rate math the
 *  same way an unscheduled day is, instead of counting as done or missed.
 *  Marking a day as rested clears any completion logged for it; if the day
 *  had no other data, un-resting it just removes the (now-empty) log. */
export async function toggleRest(habitId: number, date: string): Promise<boolean> {
  const existing = await getLog(habitId, date);
  if (existing?.rested) {
    if (existing.completed || (existing.value ?? 0) > 0) {
      await db.logs.update(existing.id!, { rested: false });
    } else {
      await db.logs.delete(existing.id!);
    }
    return false;
  }
  if (existing) {
    await db.logs.update(existing.id!, { rested: true, completed: false });
  } else {
    await db.logs.add({ habitId, date, completed: false, rested: true });
  }
  return true;
}

/** Sets today's logged amount for a measurable habit. The day is only
 *  marked `completed` once `value` reaches the habit's target — a
 *  partial amount is still saved (and still shows up in charts/history)
 *  but doesn't flip the habit into the "done" state until the goal is
 *  actually hit. Returns the new completed state. */
export async function logMeasurement(habitId: number, date: string, value: number): Promise<boolean> {
  const clamped = Math.max(0, value);
  const habit = await getHabit(habitId);
  const target = habit?.measurement?.target ?? 0;
  const completed = target > 0 ? clamped >= target : clamped > 0;
  const existing = await getLog(habitId, date);
  if (existing) {
    await db.logs.update(existing.id!, { value: clamped, completed });
  } else {
    await db.logs.add({ habitId, date, value: clamped, completed });
  }
  return completed;
}

export async function logsForHabit(habitId: number): Promise<HabitLog[]> {
  return db.logs.where("habitId").equals(habitId).toArray();
}

export async function logsForRange(startDate: string, endDate: string): Promise<HabitLog[]> {
  return db.logs.where("date").between(startDate, endDate, true, true).toArray();
}

/* ------------------------------- Stats -------------------------------- */

/** Consecutive scheduled days completed, walking backward from today. */
export async function computeStreak(habit: Habit): Promise<number> {
  const logs = await logsForHabit(habit.id!);
  const doneSet = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  const restSet = new Set(logs.filter((l) => l.rested).map((l) => l.date));
  return computeStreakSync(habit.frequency, doneSet, undefined, restSet);
}

/** % of scheduled days completed in the trailing `days` window. */
export async function completionRate(habit: Habit, days: number): Promise<number> {
  const logs = await logsForHabit(habit.id!);
  const doneSet = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  const restSet = new Set(logs.filter((l) => l.rested).map((l) => l.date));
  return completionRateSync(habit.frequency, doneSet, days, undefined, restSet);
}

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../services/db";
import type { Habit, HabitLog } from "../types/habit";

/** All non-archived top-level habits, reactive — updates automatically on
 *  any write. Sub-habits are excluded here; use useSubHabits for those. */
export function useHabits(): Habit[] {
  const habits = useLiveQuery(async () => {
    const all = await db.habits.toArray();
    return all.filter((h) => !h.archived && h.parentId == null).sort((a, b) => a.createdAt - b.createdAt);
  }, []);
  return habits ?? [];
}

export function useHabit(id: number | undefined): Habit | undefined {
  return useLiveQuery(async () => (id == null ? undefined : db.habits.get(id)), [id]);
}

/** Non-archived sub-habits nested under a given main habit, reactive. */
export function useSubHabits(parentId: number | undefined): Habit[] {
  const subs = useLiveQuery(async () => {
    if (parentId == null) return [];
    const all = await db.habits.where("parentId").equals(parentId).toArray();
    return all.filter((h) => !h.archived).sort((a, b) => a.createdAt - b.createdAt);
  }, [parentId]);
  return subs ?? [];
}

/** Logs for a date range, e.g. for the week strip or the stats heatmap. */
export function useLogsInRange(startDate: string, endDate: string): HabitLog[] {
  const logs = useLiveQuery(
    () => db.logs.where("date").between(startDate, endDate, true, true).toArray(),
    [startDate, endDate]
  );
  return logs ?? [];
}

export function useLogsForHabit(habitId: number | undefined): HabitLog[] {
  const logs = useLiveQuery(
    () => (habitId == null ? [] : db.logs.where("habitId").equals(habitId).toArray()),
    [habitId]
  );
  return logs ?? [];
}

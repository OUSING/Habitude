import type { Frequency } from "../types/habit";
import { addDays, isHabitScheduledOn, todayStr } from "./date";

const NO_REST = new Set<string>();

/** Returns the consecutive completed scheduled days inside one calendar month.
 * A streak never crosses a month boundary. If the month is current, it counts
 * backwards from today; for a previous month it counts backwards from the last
 * day of that month. Unscheduled days are skipped. Rest days (`restDates`) are
 * skipped too — they're treated exactly like unscheduled days, so they never
 * break the streak and are never counted against it.
 */
export function computeMonthlyStreak(
  frequency: Frequency,
  doneDates: Set<string>,
  year: number,
  month: number,
  restDates: Set<string> = NO_REST
): number {
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const today = todayStr();
  const currentMonth = monthStart.slice(0, 7) === today.slice(0, 7);
  const latestAllowed = currentMonth ? today : monthEnd;

  // Return the longest consecutive scheduled run completed in the selected
  // month. This intentionally considers historical completed days, so adding
  // a check to a previous day immediately updates the streak shown in the
  // habit grid, even when today is not completed. Streaks never cross months.
  let best = 0;
  let current = 0;
  let cursor = monthStart;

  while (cursor <= latestAllowed) {
    if (!isHabitScheduledOn(frequency, cursor) || restDates.has(cursor)) {
      // Non-scheduled days (and rest days) do not break a streak.
      cursor = addDays(cursor, 1);
      continue;
    }

    if (doneDates.has(cursor)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }

    cursor = addDays(cursor, 1);
  }

  return best;
}

export function completionRateSync(
  frequency: Frequency,
  doneDates: Set<string>,
  days: number,
  today: string = todayStr(),
  restDates: Set<string> = NO_REST
): number {
  let total = 0;
  let done = 0;
  let cursor = today;
  for (let i = 0; i < days; i++) {
    if (isHabitScheduledOn(frequency, cursor) && !restDates.has(cursor)) {
      total++;
      if (doneDates.has(cursor)) done++;
    }
    cursor = addDays(cursor, -1);
  }
  return total ? Math.round((done / total) * 100) : 0;
}

/** Completion rate for exactly one calendar month. */
export function monthlyCompletionRate(
  frequency: Frequency,
  doneDates: Set<string>,
  year: number,
  month: number,
  restDates: Set<string> = NO_REST
): number {
  const days = new Date(year, month + 1, 0).getDate();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  let total = 0;
  let done = 0;
  let cursor = monthStart;
  const today = todayStr();
  for (let i = 0; i < days; i++) {
    if (cursor > today && cursor.slice(0, 7) === today.slice(0, 7)) break;
    if (isHabitScheduledOn(frequency, cursor) && !restDates.has(cursor)) {
      total++;
      if (doneDates.has(cursor)) done++;
    }
    cursor = addDays(cursor, 1);
  }
  return total ? Math.round((done / total) * 100) : 0;
}

/** The actual "current streak" shown on a habit's badge: consecutive
 * scheduled days completed, walking backward from `today` (or whatever
 * reference date is passed in) with no artificial month-boundary cutoff.
 *
 * Rules:
 *  - Unscheduled days are skipped and never break the streak.
 *  - Rest days (`restDates`) are skipped the same way — a day the user
 *    deliberately excused isn't a miss.
 *  - The reference day itself doesn't break the streak if it isn't done
 *    yet — the day isn't over, so an unchecked "today" just isn't counted
 *    (not treated as a miss).
 *  - Any earlier scheduled day that's missing from `doneDates` ends the
 *    streak right there.
 *  - Because this always re-scans `doneDates`, retroactively checking a
 *    previously-skipped day (marking it done after the fact) immediately
 *    reconnects the streak across that day the next time this is called —
 *    no separate "repair" step needed.
 */
export function computeCurrentStreak(
  frequency: Frequency,
  doneDates: Set<string>,
  today: string = todayStr(),
  restDates: Set<string> = NO_REST
): number {
  let streak = 0;
  let cursor = today;

  // Safety cap (~10 years) so a misconfigured frequency can't spin forever.
  for (let i = 0; i < 3650; i++) {
    if (!isHabitScheduledOn(frequency, cursor) || restDates.has(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }

    if (doneDates.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }

    if (cursor === today) {
      // Today not checked off yet — the day isn't over, so this alone
      // doesn't break the streak. Keep looking further back.
      cursor = addDays(cursor, -1);
      continue;
    }

    // A genuinely missed scheduled day ends the streak.
    break;
  }

  return streak;
}

// Kept as the name used throughout the app (HabitCard, LoopHabitRow,
// habitService) for the live streak badge. Now backed by the real
// continuous streak calculation above instead of a per-month "best run".
export function computeStreakSync(
  frequency: Frequency,
  doneDates: Set<string>,
  today: string = todayStr(),
  restDates: Set<string> = NO_REST
): number {
  return computeCurrentStreak(frequency, doneDates, today, restDates);
}

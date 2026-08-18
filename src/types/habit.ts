/**
 * 0 = Sunday ... 6 = Saturday, matching JS Date#getDay().
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type FrequencyUnit = "day" | "week" | "month" | "year";

/** A repeat rule like the Todo list's "Custom…" repeat: every N
 *  day(s)/week(s)/month(s)/year(s), counted from `anchor`. For `unit ===
 *  "week"`, `weekdays` picks which day(s) of the on-weeks it's due (falls
 *  back to anchor's own weekday if omitted). For "month"/"year", it recurs
 *  on the same day-of-month as `anchor` (clamped down for short months —
 *  e.g. an anchor of the 31st falls on the last day of a 30-day month). */
export interface CustomFrequency {
  type: "custom";
  interval: number;
  unit: FrequencyUnit;
  weekdays?: Weekday[];
  /** "YYYY-MM-DD" — the reference date the interval counts from (the habit
   *  never applies before this date). */
  anchor: string;
}

export type Frequency =
  | { type: "daily" }
  // Kept for backward compatibility with habits saved before the "Custom"
  // repeat editor — new/edited "specific days" habits are saved as
  // `CustomFrequency` (unit: "week", interval: 1) instead.
  | { type: "weekly"; days: Weekday[] }
  | CustomFrequency;

/** A quantity-based target, e.g. "20 pages" or "2 L" — makes a habit
 *  track an amount per day instead of a plain done/not-done check. */
export interface Measurement {
  /** Free-text unit label, e.g. "pages", "min", "verres". */
  unit: string;
  /** Daily amount that counts the habit as completed for the day. */
  target: number;
}

export interface Habit {
  /** Auto-incremented by Dexie — absent until the record is first saved. */
  id?: number;
  name: string;
  /** One of PALETTE's hex values, see utils/palette.ts */
  color: string;
  /** Icon key, see utils/icons.ts */
  icon: string;
  frequency: Frequency;
  /** "HH:MM" 24h, optional — no reminder if unset. */
  reminderTime?: string;
  /** Present only for quantity-based habits; absent for simple check-off ones. */
  measurement?: Measurement;
  /** Set only for sub-habits — the id of the main habit they're nested under.
   *  Absent for top-level habits. Sub-habits have their own logs/streaks
   *  just like any other habit, they're simply grouped under a parent. */
  parentId?: number;
  createdAt: number;
  archived: boolean;
}

export type NewHabit = Omit<Habit, "id" | "createdAt" | "archived">;

export interface HabitLog {
  id?: number;
  habitId: number;
  /** Local calendar date, "YYYY-MM-DD". Never store Date objects/UTC here —
   *  habits are tracked by the user's local day, not an instant in time. */
  date: string;
  completed: boolean;
  /** Logged amount for measurable habits — unused for simple habits. */
  value?: number;
  /** Marks this day as an excused "rest day" for the habit — the day is
   *  treated like it was never scheduled: it doesn't break the streak and
   *  isn't counted in the completion rate, but it also isn't logged as
   *  completed. Mutually exclusive with `completed` (setting one clears
   *  the other). */
  rested?: boolean;
}

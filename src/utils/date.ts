import type { Weekday } from "../types/habit";

/** "YYYY-MM-DD" in the device's local timezone (never UTC-shift via toISOString). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}


export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** All dates in the calendar month containing `dateStr`, oldest first. */
export function monthDates(dateStr: string = todayStr()): string[] {
  const d = new Date(`${dateStr}T00:00:00`);
  const year = d.getFullYear();
  const month = d.getMonth();
  const count = daysInMonth(year, month);
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`);
}

export function weekdayOf(dateStr: string): Weekday {
  return new Date(`${dateStr}T00:00:00`).getDay() as Weekday;
}

/** Last `n` dates ending at `endDateStr` (inclusive), oldest first. */
export function lastNDates(n: number, endDateStr: string = todayStr()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endDateStr, -i));
  return out;
}

const WEEKDAY_SHORT_EN = ["S", "M", "T", "W", "T", "F", "S"];
export function weekdayLetter(dateStr: string): string {
  return WEEKDAY_SHORT_EN[weekdayOf(dateStr)];
}

export function formatDayMonth(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short"
  });
}

export function formatFullDate(dateStr: string): string {
  const s = new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isHabitScheduledOn(
  frequency: { type: "daily" } | { type: "weekly"; days: Weekday[] },
  dateStr: string
): boolean {
  if (frequency.type === "daily") return true;
  return frequency.days.includes(weekdayOf(dateStr));
}

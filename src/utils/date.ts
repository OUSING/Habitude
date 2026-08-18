import type { CustomFrequency, Frequency, Weekday } from "../types/habit";

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

export function isHabitScheduledOn(frequency: Frequency, dateStr: string): boolean {
  if (frequency.type === "daily") return true;
  if (frequency.type === "weekly") return frequency.days.includes(weekdayOf(dateStr));
  return isCustomScheduledOn(frequency, dateStr);
}

/** Whole calendar days between two "YYYY-MM-DD" strings (b - a), DST-safe. */
function daysBetween(aStr: string, bStr: string): number {
  const a = new Date(`${aStr}T00:00:00`);
  const b = new Date(`${bStr}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function partsOf(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month: month - 1, day };
}

function isCustomScheduledOn(frequency: CustomFrequency, dateStr: string): boolean {
  const { interval, unit, weekdays, anchor } = frequency;
  if (!(interval > 0) || dateStr < anchor) return false;

  switch (unit) {
    case "day": {
      return daysBetween(anchor, dateStr) % interval === 0;
    }
    case "week": {
      // Align to each date's own week-start (Sunday) so the interval counts
      // whole weeks rather than raw days — otherwise a Sat->Sun rollover
      // could land in a different "week bucket" than intended.
      const weekStart = (d: string) => addDays(d, -weekdayOf(d));
      const weeksSinceAnchor = daysBetween(weekStart(anchor), weekStart(dateStr)) / 7;
      if (weeksSinceAnchor % interval !== 0) return false;
      const days = weekdays && weekdays.length > 0 ? weekdays : [weekdayOf(anchor)];
      return days.includes(weekdayOf(dateStr));
    }
    case "month": {
      const a = partsOf(anchor);
      const d = partsOf(dateStr);
      const diffMonths = (d.year - a.year) * 12 + (d.month - a.month);
      if (diffMonths < 0 || diffMonths % interval !== 0) return false;
      const targetDay = Math.min(a.day, daysInMonth(d.year, d.month));
      return d.day === targetDay;
    }
    case "year": {
      const a = partsOf(anchor);
      const d = partsOf(dateStr);
      const diffYears = d.year - a.year;
      if (diffYears < 0 || diffYears % interval !== 0) return false;
      if (d.month !== a.month) return false;
      const targetDay = Math.min(a.day, daysInMonth(d.year, d.month));
      return d.day === targetDay;
    }
  }
}

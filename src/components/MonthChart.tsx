import { useMemo } from "react";
import { isHabitScheduledOn } from "../utils/date";
import { useHabits, useLogsInRange } from "../hooks/useHabits";
import type { Habit, HabitLog } from "../types/habit";

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekBucketsForMonth(year: number, month: number): { label: string; dates: string[] }[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(year, month, i + 1)));

  const buckets: { label: string; dates: string[] }[] = [];
  for (let i = 0; i < allDates.length; i += 7) {
    buckets.push({ label: `W${buckets.length + 1}`, dates: allDates.slice(i, i + 7) });
  }
  return buckets;
}

function pctFor(dates: string[], habits: Habit[], logs: HabitLog[]): { pct: number; done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const date of dates) {
    const scheduled = habits.filter((h) => isHabitScheduledOn(h.frequency, date));
    const doneIds = new Set(logs.filter((l) => l.completed && l.date === date).map((l) => l.habitId));
    total += scheduled.length;
    done += scheduled.filter((h) => doneIds.has(h.id!)).length;
  }
  return { pct: total ? Math.round((done / total) * 100) : 0, done, total };
}

export function MonthChart({ year, month }: { year: number; month: number }) {
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const buckets = useMemo(() => weekBucketsForMonth(year, month), [year, month]);
  const habits = useHabits();
  const monthStart = buckets[0].dates[0];
  const monthEnd = buckets[buckets.length - 1].dates[buckets[buckets.length - 1].dates.length - 1];
  const logs = useLogsInRange(monthStart, monthEnd);

  const bars = buckets.map((b) => ({ label: b.label, ...pctFor(b.dates, habits, logs) }));
  const overall = pctFor(
    buckets.flatMap((b) => b.dates),
    habits,
    logs
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium capitalize text-muted">{monthLabel}</span>
        <span className="font-mono text-xs font-bold text-brand">{overall.pct}%</span>
      </div>
      <div className="flex h-36 items-end gap-2.5">
        {bars.map(({ label, pct, done, total }) => (
          <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="font-mono text-[10px] text-muted">{total ? `${done}/${total}` : "—"}</span>
            <div className="relative w-full flex-1 overflow-hidden rounded-md bg-surface-2">
              <div
                className="absolute inset-x-0 bottom-0 rounded-md bg-brand transition-all duration-300"
                style={{ height: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold uppercase text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { lastNDates, weekdayLetter } from "../utils/date";
import { useLogsForHabit } from "../hooks/useHabits";
import type { Habit } from "../types/habit";

interface Props {
  habit: Habit;
  days?: number;
}

/**
 * Bar chart dedicated to quantity-based habits (habit.measurement) — shows
 * the actual logged amount per day rather than a plain done/not-done bar,
 * with a dashed line marking the daily target so over/under-shoots read
 * at a glance.
 */
export function QuantityChart({ habit, days = 7 }: Props) {
  const measurement = habit.measurement;
  const dates = lastNDates(days);
  const logs = useLogsForHabit(habit.id);

  if (!measurement) return null;

  const valuesByDate = new Map(logs.filter((l) => l.date && l.value != null).map((l) => [l.date, l.value ?? 0]));
  const values = dates.map((date) => valuesByDate.get(date) ?? 0);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(measurement.target, ...values, 1);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
          <span className="truncate text-[13px] font-semibold text-ink">{habit.name}</span>
        </div>
        <span className="font-mono text-xs font-bold text-muted">
          avg. {average.toFixed(1)} {measurement.unit}
        </span>
      </div>
      <div className="relative flex h-36 items-end gap-2">
        {values.map((value, i) => {
          const pct = (value / max) * 100;
          const reached = value >= measurement.target;
          return (
            <div key={dates[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="font-mono text-[10px] text-muted">{value || "—"}</span>
              <div className="relative w-full flex-1 overflow-hidden rounded-md bg-surface-2">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-md transition-all duration-300"
                  style={{
                    height: `${Math.max(pct, pct > 0 ? 6 : 0)}%`,
                    backgroundColor: reached ? habit.color : `${habit.color}80`
                  }}
                />
              </div>
              <span className="text-[10px] font-semibold uppercase text-muted">{weekdayLetter(dates[i])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

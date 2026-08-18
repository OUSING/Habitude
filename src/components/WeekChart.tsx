import { isHabitScheduledOn, lastNDates, weekdayLetter } from "../utils/date";
import { useHabits, useLogsInRange } from "../hooks/useHabits";

export function WeekChart() {
  const dates = lastNDates(7);
  const habits = useHabits();
  const logs = useLogsInRange(dates[0], dates[dates.length - 1]);

  const bars = dates.map((date) => {
    const scheduled = habits.filter((h) => isHabitScheduledOn(h.frequency, date));
    const doneIds = new Set(logs.filter((l) => l.completed && l.date === date).map((l) => l.habitId));
    const done = scheduled.filter((h) => doneIds.has(h.id!)).length;
    const pct = scheduled.length ? Math.round((done / scheduled.length) * 100) : 0;
    return { date, pct, done, total: scheduled.length };
  });

  return (
    <div className="flex h-36 items-end gap-2.5">
      {bars.map(({ date, pct, done, total }) => (
        <div key={date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="font-mono text-[10px] text-muted">{total ? `${done}/${total}` : "—"}</span>
          <div className="relative w-full flex-1 overflow-hidden rounded-md bg-surface-2">
            <div
              className="absolute inset-x-0 bottom-0 rounded-md bg-brand transition-all duration-300"
              style={{ height: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold uppercase text-muted">{weekdayLetter(date)}</span>
        </div>
      ))}
    </div>
  );
}

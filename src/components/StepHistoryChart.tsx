import { useEffect, useState } from "react";
import { lastNDates, weekdayLetter } from "../utils/date";
import { getStepsForDate } from "../services/stepTracker";
import { getStepGoal } from "../services/settings";
import { StepCounter } from "../platform/stepCounter";

export function StepHistoryChart({ days = 7 }: { days?: number }) {
  const dates = lastNDates(days);
  const [values, setValues] = useState<number[]>(Array(days).fill(0));
  const [goal, setGoal] = useState(8000);

  useEffect(() => {
    getStepGoal().then(setGoal);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(dates.map((date) => getStepsForDate(date))).then((next) => {
      if (!cancelled) setValues(next);
    });
    let handle: { remove: () => Promise<void> | void } | undefined;
    StepCounter.addListener("stepsChanged", ({ today }) => {
      if (!cancelled) setValues((current) => current.map((value, index) => index === current.length - 1 ? today : value));
    }).then((listener) => { handle = listener; }).catch(() => {});
    return () => { cancelled = true; void handle?.remove(); };
  }, [dates.join(",")]);

  const max = Math.max(goal, ...values, 1);
  const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <section className="mb-4 rounded-2xl bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-muted">Steps — last 7 days</h2>
          <p className="mt-0.5 text-[11px] text-muted">Daily pedometer history</p>
        </div>
        <span className="font-mono text-xs font-bold text-brand">avg. {average.toLocaleString()}</span>
      </div>
      <div className="flex h-32 items-end gap-2">
        {values.map((value, i) => {
          const pct = (value / max) * 100;
          return (
            <div key={dates[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="font-mono text-[10px] text-muted">{value ? value.toLocaleString() : "—"}</span>
              <div className="relative w-full flex-1 overflow-hidden rounded-md bg-surface-2">
                <div className="absolute inset-x-0 bottom-0 rounded-md bg-brand transition-all duration-500" style={{ height: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }} />
              </div>
              <span className="text-[10px] font-semibold uppercase text-muted">{weekdayLetter(dates[i])}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

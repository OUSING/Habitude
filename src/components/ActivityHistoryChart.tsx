import { useEffect, useState } from "react";
import { db, type ActivityLog } from "../services/db";
import { lastNDates, weekdayLetter } from "../utils/date";

export function ActivityHistoryChart({ days = 7 }: { days?: number }) {
  const dates = lastNDates(days);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    db.activityLogs.toArray().then((items) => {
      if (!cancelled) setLogs(items.filter((item) => dates.includes(item.date)));
    });
    return () => { cancelled = true; };
  }, [dates.join(",")]);

  const stepsByDate = new Map<string, number>();
  const runsByDate = new Map<string, number>();
  logs.forEach((log) => {
    if (log.type === "steps") stepsByDate.set(log.date, Math.max(stepsByDate.get(log.date) ?? 0, log.value));
    if (log.type === "run") runsByDate.set(log.date, (runsByDate.get(log.date) ?? 0) + log.value);
  });

  const steps = dates.map((date) => stepsByDate.get(date) ?? 0);
  const runs = dates.map((date) => runsByDate.get(date) ?? 0);
  const maxSteps = Math.max(...steps, 1);
  const maxRuns = Math.max(...runs, 0.1);
  const totalDistance = runs.reduce((a, b) => a + b, 0);

  return (
    <section className="mb-4 rounded-2xl bg-surface p-4 shadow-sm border border-border">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-muted">Synced activity</h2>
          <p className="mt-0.5 text-[11px] text-muted">Phone steps and runs included after sync</p>
        </div>
        <span className="font-mono text-xs font-bold text-brand">{totalDistance.toFixed(1)} km</span>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink">Steps</span>
          <span className="text-[10px] text-muted">last {days} days</span>
        </div>
        <div className="flex h-36 items-end gap-2">
          {dates.map((date, i) => {
            const value = steps[i];
            return (
              <div key={`steps-${date}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="font-mono text-[10px] text-muted">{value ? value.toLocaleString() : "—"}</span>
                <div className="relative w-full flex-1 overflow-hidden rounded-md bg-surface-2">
                  <div className="absolute inset-x-0 bottom-0 rounded-md bg-brand transition-all duration-500" style={{ height: `${Math.max((value / maxSteps) * 100, value ? 6 : 0)}%` }} />
                </div>
                <span className="text-[10px] font-semibold uppercase text-muted">{weekdayLetter(date)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink">Runs</span>
          <span className="text-[10px] text-muted">{totalDistance.toFixed(2)} km total</span>
        </div>
        <div className="flex h-32 items-end gap-2">
          {dates.map((date, i) => {
            const value = runs[i];
            return (
              <div key={`runs-${date}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="font-mono text-[10px] text-muted">{value ? `${value.toFixed(1)} km` : "—"}</span>
                <div className="relative w-full flex-1 overflow-hidden rounded-md bg-surface-2">
                  <div className="absolute inset-x-0 bottom-0 rounded-md bg-accent transition-all duration-500" style={{ height: `${Math.max((value / maxRuns) * 100, value ? 6 : 0)}%` }} />
                </div>
                <span className="text-[10px] font-semibold uppercase text-muted">{weekdayLetter(date)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {logs.length === 0 && (
        <p className="mt-3 text-center text-[10px] text-muted">
          Sync the app from your phone to bring its activity history here.
        </p>
      )}
    </section>
  );
}

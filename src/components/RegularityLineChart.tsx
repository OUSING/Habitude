import { useMemo } from "react";
import { isHabitScheduledOn, lastNDates } from "../utils/date";
import { useHabits, useLogsInRange } from "../hooks/useHabits";

const WIDTH = 300;
const HEIGHT = 120;
const PAD_X = 6;
const PAD_Y = 10;

export function RegularityLineChart({ days = 30, year, month }: { days?: number; year?: number; month?: number }) {
  const dates = useMemo(() => {
    if (year != null && month != null) {
      const count = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: count }, (_, i) => {
        const d = new Date(year, month, i + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      });
    }
    return lastNDates(days);
  }, [days, year, month]);
  const habits = useHabits();
  const logs = useLogsInRange(dates[0], dates[dates.length - 1]);

  const points = dates.map((date) => {
    const scheduled = habits.filter((h) => isHabitScheduledOn(h.frequency, date));
    const doneIds = new Set(logs.filter((l) => l.completed && l.date === date).map((l) => l.habitId));
    const done = scheduled.filter((h) => doneIds.has(h.id!)).length;
    const pct = scheduled.length ? Math.round((done / scheduled.length) * 100) : 0;
    return { date, pct };
  });

  if (habits.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Add a habit to see your regularity here.</p>;
  }

  const usableW = WIDTH - PAD_X * 2;
  const usableH = HEIGHT - PAD_Y * 2;
  const stepX = points.length > 1 ? usableW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_Y + usableH - (p.pct / 100) * usableH,
    pct: p.pct,
    date: p.date
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${HEIGHT - PAD_Y} L ${coords[0].x.toFixed(1)} ${HEIGHT - PAD_Y} Z`;

  const average = Math.round(points.reduce((sum, p) => sum + p.pct, 0) / Math.max(points.length, 1));
  const first = points[0].date;
  const last = points[points.length - 1].date;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted">{year != null && month != null ? "Average for selected month" : `Average over ${days} days`}</span>
        <span className="font-mono text-xs font-bold text-brand">{average}%</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-32 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="regularity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-brand))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(var(--color-brand))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines at 0/50/100% */}
        {[0, 50, 100].map((v) => {
          const y = PAD_Y + usableH - (v / 100) * usableH;
          return (
            <line
              key={v}
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={y}
              y2={y}
              stroke="rgb(var(--color-border))"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        <path d={areaPath} fill="url(#regularity-fill)" stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="rgb(var(--color-brand))"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Endpoint dot draws the eye to the most recent day. */}
        <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={3.5} fill="rgb(var(--color-brand))" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
        <span>{formatShort(first)}</span>
        <span>{formatShort(last)}</span>
      </div>
    </div>
  );
}

function formatShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Flame,
  Footprints,
  CheckCircle2
} from "lucide-react";
import {
  checkStepsPermission,
  disableAutoSteps,
  enableAutoSteps,
  isStepsAvailableOnDevice,
} from "../services/stepTracker";
import { getAutoStepsEnabled } from "../services/settings";
import type { StepsPermissionState } from "../platform/stepCounter";
import { WeekChart } from "../components/WeekChart";
import { MonthChart } from "../components/MonthChart";
import { RegularityLineChart } from "../components/RegularityLineChart";
import { QuantityChart } from "../components/QuantityChart";
import { ActivityHistoryChart } from "../components/ActivityHistoryChart";
import { useHabits, useLogsForHabit } from "../hooks/useHabits";
import { monthlyCompletionRate, computeMonthlyStreak } from "../utils/streak";
import type { Habit } from "../types/habit";

function StepTrackingSection() {
  const isNative = Capacitor.isNativePlatform();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<StepsPermissionState>("prompt");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isNative) return;
    isStepsAvailableOnDevice().then(setAvailable);
    getAutoStepsEnabled().then(setEnabled);
    checkStepsPermission().then(setPermission);
  }, [isNative]);

  // Not on native (dev server) or the device has no step sensor at all —
  // nothing useful to show here.
  if (!isNative || !available) return null;

  async function handleToggle() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (enabled) {
        await disableAutoSteps();
        setEnabled(false);
      } else {
        const result = await enableAutoSteps();
        setPermission(result);
        if (result === "granted") {
          setEnabled(true);
          setMessage({ kind: "success", text: "Step tracking is on — today's count will sync automatically." });
        } else {
          setMessage({
            kind: "error",
            text: "Permission was not granted, so step tracking couldn't be turned on. Check your device's app permissions."
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }


  return (
    <section className="mb-4 rounded-2xl bg-surface p-3 shadow-sm border border-border">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Footprints size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">Automatic step tracking</p>
          <p className="text-[11.5px] text-muted">
            {enabled
              ? "Tracking your phone's pedometer separately from habits."
              : "Track steps automatically from your phone's pedometer."}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={busy}
          aria-pressed={enabled}
          className={[
            "tap-target relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
            enabled ? "bg-brand" : "bg-surface-2"
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5"
            ].join(" ")}
          />
        </button>
      </div>

      {permission === "denied" && !enabled && (
        <p className="mt-2 text-[11px] text-muted">
          Motion/activity permission was previously denied — you may need to grant it from your device's system settings.
        </p>
      )}

      {message && (
        <p
          role="alert"
          className={["mt-2 text-[11.5px]", message.kind === "error" ? "text-red-500" : "text-emerald-600"].join(" ")}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}

function HabitRateRow({ habit, year, month }: { habit: Habit; year: number; month: number }) {
  const logs = useLogsForHabit(habit.id);
  const doneDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  const restDates = new Set(logs.filter((l) => l.rested).map((l) => l.date));
  const rate = monthlyCompletionRate(habit.frequency, doneDates, year, month, restDates);
  const streak = computeMonthlyStreak(habit.frequency, doneDates, year, month, restDates);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const checkedDays = [...doneDates].filter((d) => d.startsWith(monthPrefix)).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 sm:flex sm:gap-3">
      <div className="flex min-w-0 items-center gap-2 sm:w-28 sm:shrink-0">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: habit.color }}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate text-[13px] font-medium text-ink">{habit.name}</span>
      </div>

      <div className="col-span-2 order-last h-2.5 min-w-0 overflow-hidden rounded-full bg-surface-2 sm:order-none sm:flex-1">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${rate}%` }}
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <span className="font-mono text-xs font-semibold tabular-nums text-muted">
          {rate}%
        </span>
        {checkedDays > 0 && (
          <span
            className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums text-muted"
            title={`${checkedDays} day${checkedDays === 1 ? "" : "s"} checked this month`}
            aria-label={`${checkedDays} day${checkedDays === 1 ? "" : "s"} checked this month`}
          >
            <CheckCircle2 size={11} strokeWidth={2.5} className="shrink-0" />
            <span>{checkedDays}</span>
          </span>
        )}
        {streak > 0 && (
          <span
            className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums text-accent"
            title={`${streak} day streak`}
            aria-label={`${streak} day streak`}
          >
            <Flame size={11} strokeWidth={2.5} className="shrink-0 fill-accent text-accent" />
            <span>{streak}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function Stats() {
  const habits = useHabits();
  const measurableHabits = habits.filter((h) => h.measurement);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  function shiftMonth(delta: number) {
    setSelectedMonth((current) => {
      const d = new Date(current.year, current.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const selectedMonthDate = new Date(selectedMonth.year, selectedMonth.month, 1);
  const isCurrentMonth = (() => {
    const now = new Date();
    return now.getFullYear() === selectedMonth.year && now.getMonth() === selectedMonth.month;
  })();

  return (
    <div className="flex h-full flex-col">
      {/* Appearance (theme/dark mode) and Settings now live on the Dashboard
          header and in the Settings screen — this header is just the title. */}
      <header className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-safe-top">
        <div className="flex items-center pt-4">
          <h1 className="font-display text-2xl font-semibold text-ink">Stats</h1>
        </div>
      </header>

      <main className="scroll-area flex-1 px-4 py-4">
        {/* Progress charts sit at the top, above backup/export, since
            they're what most people open this screen to check.
            On desktop this is laid out as a two-column grid: Progress
            (+ Regularity, By habit, Step tracking) on the left, paired
            with Synced activity + Quantity charts on the right, instead
            of everything piling up in one long column. Mobile keeps the
            original single-column stacked order.

            Each column is a single flex-column grid item (not a shared
            set of row-tracks). Sharing explicit row-start indices across
            columns of very different content height used to stretch the
            grid row to the taller item, leaving blank space under the
            shorter one — this way each column's height is driven only by
            its own content, on any viewport, phone or desktop. */}
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
          <div className="flex flex-col lg:col-start-1">
            {/* Progress, Regularity and By habit are one continuous card —
                no gap or divider line between them, just an internal
                divide between the three blocks. */}
            <section className="mb-4 divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-sm">
              <div className="p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-semibold text-muted">Progress</h2>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <div className="flex min-w-0 items-center gap-1 rounded-lg bg-surface-2 p-0.5">
                      <button aria-label="Previous month" onClick={() => shiftMonth(-1)} className="tap-target !min-h-8 !min-w-8 shrink-0 px-2 py-1 text-xs font-bold text-muted">‹</button>
                      <span className="min-w-16 px-1 text-center text-[11px] font-semibold text-ink sm:min-w-24">{selectedMonthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                      <button aria-label="Next month" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} className="tap-target !min-h-8 !min-w-8 shrink-0 px-2 py-1 text-xs font-bold text-muted disabled:opacity-30">›</button>
                    </div>
                    <div className="flex shrink-0 gap-1 rounded-lg bg-surface-2 p-0.5">
                      {(["week", "month"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={[
                            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                            period === p ? "bg-ink text-bg" : "text-muted"
                          ].join(" ")}
                        >
                          {p === "week" ? "Week" : "Month"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {period === "week" ? <WeekChart /> : <MonthChart year={selectedMonth.year} month={selectedMonth.month} />}
              </div>

              <div className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-muted">Regularity — {selectedMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
                <RegularityLineChart year={selectedMonth.year} month={selectedMonth.month} />
              </div>

              <div className="p-4">
                <h2 className="mb-1 text-sm font-semibold text-muted">By habit</h2>
                {habits.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">No habits yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {habits.map((h) => (
                      <HabitRateRow key={h.id} habit={h} year={selectedMonth.year} month={selectedMonth.month} />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <StepTrackingSection />
          </div>

          <div className="flex flex-col lg:col-start-2">
            <ActivityHistoryChart days={7} />

            {measurableHabits.length > 0 && (
              <section className="mb-4 rounded-2xl bg-surface p-4 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-muted">Quantity habits — last 7 days</h2>
                <div className="flex flex-col gap-6">
                  {measurableHabits.map((h) => (
                    <QuantityChart key={h.id} habit={h} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

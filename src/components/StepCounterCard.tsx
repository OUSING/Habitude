import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Eye, EyeOff, Footprints, Loader2, Pencil } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { StepCounter, type StepsPermissionState } from "../platform/stepCounter";
import {
  checkStepsPermission,
  enableAutoSteps,
  disableAutoSteps,
  getStepsToday,
  isStepsAvailableOnDevice
} from "../services/stepTracker";
import {
  getAutoStepsEnabled,
  getStepGoal,
  setStepGoal,
  getShowStepTracker,
  setShowStepTracker
} from "../services/settings";
import { Modal } from "./ui/Modal";

const DEFAULT_DAILY_GOAL = 8000;

function formatSteps(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.round(value)));
}

/** Small bottom-sheet number field for setting the daily step goal —
 *  mirrors the QuantityInput's numeric-field styling without dragging in
 *  its presets/steppers, since a goal is a one-off number, not a running tally. */
function StepGoalEditor({ initialGoal, onSave, onCancel }: { initialGoal: number; onSave: (goal: number) => void; onCancel: () => void }) {
  const [value, setValue] = useState(String(initialGoal));

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
  }

  function commit() {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      onSave(Math.round(parsed));
    } else {
      onCancel();
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 p-1 animate-pop">
      <div className="flex flex-col items-center min-w-[120px]">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step="1"
          value={value}
          onChange={handleChange}
          className="w-full text-center text-4xl font-bold bg-transparent text-ink outline-none"
          autoFocus
        />
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">steps / day</div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 w-full">
        {[5000, 8000, 10000, 12000].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setValue(String(preset))}
            className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand active:scale-95"
          >
            {formatSteps(preset)}
          </button>
        ))}
      </div>

      <div className="flex gap-2 w-full mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="tap-target flex-1 rounded-xl bg-surface-2 py-3 text-[13px] font-semibold text-ink active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          className="tap-target flex-1 rounded-xl bg-brand py-3 text-[13px] font-semibold text-white shadow-sm active:scale-[0.98]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function StepCounterCard() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<StepsPermissionState>("prompt");
  const [steps, setSteps] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_DAILY_GOAL);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  // Starts as `null` (unknown) rather than defaulting to `true` — if it
  // defaulted to shown, a hidden tracker would flash back into view for a
  // moment while the stored preference is still loading.
  const [showTracker, setShowTrackerState] = useState<boolean | null>(null);

  useEffect(() => {
    getStepGoal().then(setDailyGoal);
    getShowStepTracker().then(setShowTrackerState);
  }, []);

  function toggleShowTracker() {
    setShowTrackerState((prev) => {
      const next = !(prev ?? true);
      setShowStepTracker(next);
      return next;
    });
  }

  async function handleSaveGoal(goal: number) {
    setDailyGoal(goal);
    setGoalEditorOpen(false);
    await setStepGoal(goal);
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setBusy(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const [deviceAvailable, autoEnabled, currentPermission] = await Promise.all([
          isStepsAvailableOnDevice(),
          getAutoStepsEnabled(),
          checkStepsPermission()
        ]);

        if (!mounted) return;
        setAvailable(deviceAvailable);
        setEnabled(autoEnabled);
        setPermission(currentPermission);

        if (deviceAvailable && autoEnabled && currentPermission === "granted") {
          const current = await getStepsToday();
          if (mounted && current != null) setSteps(current);
        }
      } catch (err) {
        console.warn("Step counter initialization failed", err);
        if (mounted) setError("Couldn't read the pedometer.");
      } finally {
        if (mounted) setBusy(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!available || !enabled || permission !== "granted") return;

    let mounted = true;
    let handle: { remove: () => Promise<void> | void } | undefined;

    StepCounter.addListener("stepsChanged", ({ today }) => {
      if (mounted) setSteps(today);
    })
      .then((listener) => {
        handle = listener;
      })
      .catch((err) => {
        console.warn("Step counter listener failed", err);
      });

    return () => {
      mounted = false;
      handle?.remove();
    };
  }, [available, enabled, permission]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      if (enabled) {
        await disableAutoSteps();
        setEnabled(false);
        return;
      }

      const result = await enableAutoSteps();
      setPermission(result);

      if (result !== "granted") {
        setError(
          result === "denied"
            ? "Allow physical activity access in Android settings."
            : "Step tracking is unavailable on this device."
        );
        return;
      }

      setEnabled(true);
      const current = await getStepsToday();
      if (current != null) setSteps(current);
    } catch (err) {
      console.error("Unable to toggle step tracking", err);
      setError("Couldn't start step tracking.");
    } finally {
      setBusy(false);
    }
  }

  const progress = Math.min(1, steps / dailyGoal);
  const circumference = 2 * Math.PI * 82;
  const dashOffset = circumference * (1 - progress);
  const goalReached = steps >= dailyGoal;

  const distanceKm = useMemo(() => (steps * 0.00075).toFixed(1), [steps]);
  const calories = useMemo(() => Math.round(steps * 0.04), [steps]);

  if (!Capacitor.isNativePlatform() || !available) return null;
  if (showTracker === null) return null;

  if (showTracker === false) {
    return (
      <button
        onClick={toggleShowTracker}
        aria-label="Show step tracker"
        className="tap-target mb-4 flex w-full items-center justify-between rounded-full border border-border bg-surface px-4 py-2.5 active:bg-surface-2"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
          <Footprints size={13} />
          Step Counter hidden
        </span>
        <Eye size={14} className="text-muted" />
      </button>
    );
  }

  return (
    <section className="mb-4 overflow-hidden rounded-[28px] border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Daily activity</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">Step Counter</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleShowTracker}
            aria-label="Hide step tracker"
            className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted active:bg-border"
          >
            <EyeOff size={13} />
          </button>
          <button
            onClick={toggle}
            disabled={busy}
            aria-label={enabled ? "Turn off automatic step tracking" : "Turn on automatic step tracking"}
            aria-pressed={enabled}
            className="tap-target flex items-center gap-2 rounded-full bg-surface-2 px-3 text-[11px] font-semibold text-muted disabled:opacity-60"
          >
            <span className={["h-2 w-2 rounded-full", enabled ? "bg-brand" : "bg-muted/40"].join(" ")} />
            {busy ? <Loader2 size={13} className="animate-spin" /> : enabled ? "Auto" : "Off"}
          </button>
        </div>
      </div>

      <div className="relative mx-auto mt-3 flex h-[218px] w-[218px] items-center justify-center">
        <div className="absolute inset-[14px] rounded-full bg-brand-light/45" />
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="10" className="text-surface-2" />
          <circle
            cx="100"
            cy="100"
            r="82"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-brand transition-[stroke-dashoffset] duration-700 ease-out"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>

        <div className="relative flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-bg shadow-sm">
            <Footprints size={19} strokeWidth={2.2} />
          </div>
          <p className="mt-2 font-display text-[42px] font-semibold leading-none tracking-tight text-ink">
            {formatSteps(steps)}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">steps</p>
          <p className="mt-2 text-[11px] text-muted">
            {goalReached ? "Daily goal reached" : `${formatSteps(Math.max(0, dailyGoal - steps))} to go`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border rounded-2xl bg-surface-2/65 py-3">
        <button
          type="button"
          onClick={() => setGoalEditorOpen(true)}
          aria-label="Edit daily step goal"
          className="tap-target flex flex-col items-center text-center active:opacity-70"
        >
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
            Goal
            <Pencil size={8} strokeWidth={2.5} />
          </span>
          <p className="mt-0.5 text-sm font-semibold text-ink">{formatSteps(dailyGoal)}</p>
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted">Distance</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{distanceKm} km</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted">Calories</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{calories} kcal</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-center text-[11px] text-red-500">
          {error}
        </p>
      )}

      {permission === "denied" && !enabled && !error && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Allow physical activity access in Android permissions.
        </p>
      )}

      <Modal open={goalEditorOpen} onClose={() => setGoalEditorOpen(false)} title="Daily Step Goal">
        <StepGoalEditor
          initialGoal={dailyGoal}
          onSave={handleSaveGoal}
          onCancel={() => setGoalEditorOpen(false)}
        />
      </Modal>
    </section>
  );
}

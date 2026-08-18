import { useEffect, useMemo, useState } from "react";
import { Activity, Eye, EyeOff, MapPin, Pause, Play, Route, Square, Timer } from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { getShowRunningTracker, setShowRunningTracker } from "../services/settings";
import { db } from "../services/db";

type RunStatus = "idle" | "running" | "paused";

interface RunRecord {
  id: string;
  date: string;
  distanceKm: number;
  durationSec: number;
  paceSecPerKm: number | null;
}

interface PersistedRun {
  status: RunStatus;
  startedAt: number | null;
  elapsedBeforePause: number;
  distanceKm: number;
  lastPosition: { lat: number; lon: number; timestamp: number } | null;
  history: RunRecord[];
}

const STORAGE_KEY = "habitude-running-tracker-v1";
const MAX_HISTORY = 30;
const MAX_ACCEPTED_ACCURACY_M = 50;
const MAX_REASONABLE_JUMP_M = 100;

function loadState(): PersistedRun {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedRun;
      return {
        status: parsed.status === "running" || parsed.status === "paused" ? parsed.status : "idle",
        startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
        elapsedBeforePause: Math.max(0, Number(parsed.elapsedBeforePause) || 0),
        distanceKm: Math.max(0, Number(parsed.distanceKm) || 0),
        lastPosition: parsed.lastPosition ?? null,
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, MAX_HISTORY) : []
      };
    }
  } catch {
    // Ignore malformed local state and start cleanly.
  }

  return {
    status: "idle",
    startedAt: null,
    elapsedBeforePause: 0,
    distanceKm: 0,
    lastPosition: null,
    history: []
  };
}

function saveState(state: PersistedRun) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in private/browser-restricted contexts.
  }
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatDuration(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(secondsPerKm: number | null) {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "--";
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RunningTrackerCard({ variant = "default" }: { variant?: "default" | "grid" }) {
  const [state, setState] = useState<PersistedRun>(() => loadState());
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  // Starts as `null` (unknown) rather than defaulting to `true` — avoids a
  // flash back into view while the stored preference is still loading.
  const [showTracker, setShowTrackerState] = useState<boolean | null>(null);

  useEffect(() => {
    getShowRunningTracker().then(setShowTrackerState);
  }, []);

  function toggleShowTracker() {
    setShowTrackerState((prev) => {
      const next = !(prev ?? true);
      setShowRunningTracker(next);
      return next;
    });
  }

  const elapsedSec = useMemo(() => {
    if (state.status !== "running" || state.startedAt == null) return state.elapsedBeforePause;
    return state.elapsedBeforePause + Math.max(0, (now - state.startedAt) / 1000);
  }, [state.status, state.startedAt, state.elapsedBeforePause, now]);

  const pace = state.distanceKm > 0.05 ? elapsedSec / state.distanceKm : null;

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "running") return;

    let active = true;
    let nativeWatchId: string | null = null;

    const startLocationTracking = async () => {
      try {
        // Capacitor requests Android/iOS location permission at runtime.
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== "granted") {
          const requested = await Geolocation.requestPermissions();
          if (requested.location !== "granted") {
            if (active) setError("Location permission is required to track your run.");
            return;
          }
        }

        nativeWatchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 2000
          },
          (position, watchError) => {
            if (!active) return;

            if (watchError || !position) {
              setError("GPS signal is temporarily unavailable.");
              return;
            }

            const accuracy = position.coords.accuracy ?? Infinity;
            if (!Number.isFinite(accuracy) || accuracy > MAX_ACCEPTED_ACCURACY_M) return;

            const next = {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              timestamp: position.timestamp || Date.now()
            };

            setState((current) => {
              if (current.status !== "running") return current;
              if (!current.lastPosition) return { ...current, lastPosition: next };

              const meters = haversineMeters(current.lastPosition, next);
              const seconds = Math.max(
                0.1,
                (next.timestamp - current.lastPosition.timestamp) / 1000
              );

              // Reject obvious GPS jumps to prevent the distance from
              // suddenly increasing by hundreds of metres.
              if (meters > MAX_REASONABLE_JUMP_M && seconds < 30) return current;

              return {
                ...current,
                distanceKm: current.distanceKm + meters / 1000,
                lastPosition: next
              };
            });
            setError("");
          }
        );
      } catch {
        if (active) setError("Unable to access location. Check your device location settings.");
      }
    };

    void startLocationTracking();

    return () => {
      active = false;
      if (nativeWatchId) {
        void Geolocation.clearWatch({ id: nativeWatchId });
      }
    };
  }, [state.status]);

  async function startRun() {
    setError("");

    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== "granted") {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== "granted") {
          setError("Allow location access to start tracking your run.");
          return;
        }
      }

      const startedAt = Date.now();
      setState((current) => ({
        ...current,
        status: "running",
        startedAt,
        elapsedBeforePause: current.status === "paused" ? current.elapsedBeforePause : 0,
        lastPosition: null
      }));
      setNow(startedAt);
    } catch {
      setError("Location permission could not be requested. Check device location settings.");
    }
  }

  function pauseRun() {
    setState((current) => {
      if (current.status !== "running") return current;
      const elapsed = current.startedAt == null
        ? current.elapsedBeforePause
        : current.elapsedBeforePause + Math.max(0, (Date.now() - current.startedAt) / 1000);
      return {
        ...current,
        status: "paused",
        startedAt: null,
        elapsedBeforePause: elapsed,
        lastPosition: null
      };
    });
  }

  function finishRun() {
    setState((current) => {
      const duration = current.status === "running" && current.startedAt != null
        ? current.elapsedBeforePause + Math.max(0, (Date.now() - current.startedAt) / 1000)
        : current.elapsedBeforePause;

      const record: RunRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: todayLabel(),
        distanceKm: current.distanceKm,
        durationSec: duration,
        paceSecPerKm: current.distanceKm > 0.05 ? duration / current.distanceKm : null
      };

      // Keep the run in the synchronized activity history as well as the
      // local tracker UI. Fire-and-forget so saving a run never blocks on DB I/O.
      void db.activityLogs.put({
        id: `run-${record.id}`,
        date: new Date().toISOString().slice(0, 10),
        type: "run",
        value: record.distanceKm,
        durationSec: record.durationSec,
        paceSecPerKm: record.paceSecPerKm,
        source: "phone",
        createdAt: Date.now()
      });

      return {
        status: "idle",
        startedAt: null,
        elapsedBeforePause: 0,
        distanceKm: 0,
        lastPosition: null,
        history: [record, ...current.history].slice(0, MAX_HISTORY)
      };
    });
    setError("");
  }

  const hasRun = state.status !== "idle";
  const displayDistance = state.distanceKm.toFixed(2);

  if (showTracker === null) return null;

  if (showTracker === false) {
    return (
      <button
        onClick={toggleShowTracker}
        aria-label="Show running tracker"
        className="tap-target mb-4 flex w-full items-center justify-between rounded-full border border-border bg-surface px-4 py-2.5 active:bg-surface-2"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
          <Route size={13} />
          Running hidden
        </span>
        <Eye size={14} className="text-muted" />
      </button>
    );
  }

  const isGrid = variant === "grid";

  return (
    <section className={isGrid
      ? "grid-mode-running overflow-hidden rounded-[24px] border border-border bg-surface shadow-sm"
      : "mb-4 overflow-hidden rounded-[24px] border border-border bg-surface shadow-sm"}>
      <div className="flex items-center justify-between px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-light text-accent">
            <Activity size={16} strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Activity</p>
            <h2 className="font-display text-[16px] font-semibold leading-tight text-ink">Running</h2>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {hasRun && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-muted">
              {state.status === "running" ? "Running" : "Paused"}
            </span>
          )}
          <button
            onClick={toggleShowTracker}
            aria-label="Hide running tracker"
            className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted active:bg-border"
          >
            <EyeOff size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-y border-border bg-surface-2/55">
        <div className="px-2 py-3 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted">Distance</p>
          <p className="mt-0.5 text-base font-semibold text-ink">{displayDistance}<span className="ml-0.5 text-[10px] text-muted">km</span></p>
        </div>
        <div className="px-2 py-3 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted">Time</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-ink">{formatDuration(elapsedSec)}</p>
        </div>
        <div className="px-2 py-3 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted">Pace</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-ink">{formatPace(pace)}<span className="ml-0.5 text-[10px] text-muted">/km</span></p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3">
        {!hasRun ? (
          <button
            onClick={startRun}
            className="tap-target flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-xs font-semibold text-bg active:scale-[0.98]"
          >
            <Play size={14} fill="currentColor" /> Start run
          </button>
        ) : (
          <>
            <button
              onClick={state.status === "running" ? pauseRun : startRun}
              className="tap-target flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-xs font-semibold text-bg active:scale-[0.98]"
            >
              {state.status === "running" ? <><Pause size={14} fill="currentColor" /> Pause</> : <><Play size={14} fill="currentColor" /> Resume</>}
            </button>
            <button
              onClick={finishRun}
              className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-[0.98]"
              aria-label="Finish run"
            >
              <Square size={14} fill="currentColor" />
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-4 pb-3 text-[10px] text-red-500">
          <MapPin size={12} /> {error}
        </div>
      )}

      {!isGrid && state.history.length > 0 && (
        <div className="border-t border-border px-4 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted">
            <Timer size={11} /> Recent runs
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {state.history.slice(0, 4).map((run) => (
              <div key={run.id} className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[10px] text-muted">
                <span className="font-semibold text-ink">{run.distanceKm.toFixed(2)} km</span>
                <span className="mx-1">·</span>
                {formatDuration(run.durationSec)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

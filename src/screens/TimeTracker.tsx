import { useEffect, useMemo, useState } from "react";
import { Clock3, Pause, Play, Square, Plus, TimerReset } from "lucide-react";

type Session = {
  id: string;
  label: string;
  startedAt: number;
  durationSec: number;
  date: string;
};

const STORAGE_KEY = "habitude-time-tracker-v1";

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 100))); } catch {}
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TimeTracker() {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedTotal, setPausedTotal] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [label, setLabel] = useState("Focus");
  const [sessions, setSessions] = useState<Session[]>(loadSessions);

  const elapsed = useMemo(() => {
    if (!running || startedAt == null) return pausedTotal;
    return pausedTotal + Math.max(0, (now - startedAt) / 1000);
  }, [running, startedAt, pausedTotal, now]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => saveSessions(sessions), [sessions]);

  const today = dayKey();
  const todaySessions = sessions.filter((s) => s.date === today);
  const todayTotal = todaySessions.reduce((sum, s) => sum + s.durationSec, 0) + elapsed;
  const weekTotal = sessions
    .filter((s) => Date.now() - new Date(s.date).getTime() < 7 * 86400000)
    .reduce((sum, s) => sum + s.durationSec, 0) + (running ? elapsed : 0);

  function start() {
    setStartedAt(Date.now());
    setRunning(true);
    setNow(Date.now());
  }

  function pause() {
    if (startedAt != null) {
      setPausedTotal((v) => v + Math.max(0, (Date.now() - startedAt) / 1000));
    }
    setStartedAt(null);
    setRunning(false);
  }

  function stop() {
    const duration = elapsed;
    if (duration >= 1) {
      setSessions((prev) => [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label: label.trim() || "Focus",
        startedAt: startedAt ?? Date.now(),
        durationSec: Math.round(duration),
        date: today
      }, ...prev].slice(0, 100));
    }
    setStartedAt(null);
    setPausedTotal(0);
    setRunning(false);
  }

  return (
    <div className="time-tracker-theme flex h-full flex-col bg-bg">
      <header className="shrink-0 border-b border-border bg-surface px-4 pb-4 pt-safe-top">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Productivity</p>
            <h1 className="font-display text-xl font-semibold text-ink">Time tracker</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-light text-accent">
            <Clock3 size={18} />
          </div>
        </div>
      </header>

      <main className="scroll-area flex-1 px-4 py-4">
        <section className="overflow-hidden rounded-[28px] bg-surface shadow-sm border border-border">
          <div className="px-5 pt-5">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-surface-2 px-3 py-1 text-[10px] font-semibold text-muted">
                {running ? "Tracking now" : "Ready to focus"}
              </span>
              <span className="text-[10px] text-muted">{label}</span>
            </div>

            <div className="flex flex-col items-center py-8">
              <div className="flex h-52 w-52 flex-col items-center justify-center rounded-full border-[12px] border-accent-light">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">elapsed</span>
                <span className="mt-1 font-display text-4xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatTime(elapsed)}
                </span>
                <span className="mt-1 text-[10px] text-muted">{running ? "keep going" : "start a session"}</span>
              </div>
            </div>

            <div className="mb-4 flex gap-2">
              {!running ? (
                <button onClick={start} className="tap-target flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-xs font-semibold text-bg active:scale-[0.98]">
                  <Play size={14} fill="currentColor" /> {pausedTotal > 0 ? "Resume" : "Start"}
                </button>
              ) : (
                <button onClick={pause} className="tap-target flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-xs font-semibold text-bg active:scale-[0.98]">
                  <Pause size={14} fill="currentColor" /> Pause
                </button>
              )}
              <button onClick={stop} disabled={elapsed < 1} className="tap-target flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-30" aria-label="Save session">
                <Square size={14} fill="currentColor" />
              </button>
            </div>

            <div className="pb-5">
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Session name</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={30}
                className="h-10 w-full rounded-full bg-surface-2 px-4 text-xs text-ink outline-none"
                placeholder="Focus"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border bg-surface-2/60">
            <div className="px-4 py-4 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted">Today</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatTime(todayTotal)}</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted">7 days</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatTime(weekTotal)}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-sm font-semibold text-ink">Recent sessions</p>
              <p className="text-[10px] text-muted">Saved separately from habits</p>
            </div>
            <TimerReset size={16} className="text-muted" />
          </div>

          {todaySessions.length === 0 ? (
            <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3 text-[11px] text-muted">
              <Plus size={14} /> Finish a session and it will appear here.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {todaySessions.slice(0, 6).map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{session.label}</p>
                    <p className="text-[9px] text-muted">Today</p>
                  </div>
                  <span className="ml-3 shrink-0 text-xs font-semibold tabular-nums text-ink">{formatTime(session.durationSec)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="pb-20" />
      </main>
    </div>
  );
}

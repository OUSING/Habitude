import { CalendarDays, CheckSquare, List, LayoutGrid, Settings, BarChart3, Sun, Moon } from "lucide-react";
import type { ThemeMode } from "../services/settings";
import type { ReactNode } from "react";
import type { Screen } from "../App";
import type { ViewMode } from "../services/settings";
import { useHabits, useLogsForHabit, useLogsInRange } from "../hooks/useHabits";
import { isHabitScheduledOn, todayStr } from "../utils/date";
import { WeekChart } from "./WeekChart";
import { ThemeToggle } from "./ThemeToggle";

/** Today's completion ring — how many of today's scheduled habits are done.
 *  Compact horizontal layout for the bottom bar. */
function BottombarProgress() {
  const habits = useHabits();
  const today = todayStr();
  const logs = useLogsInRange(today, today);
  const scheduled = habits.filter((h) => isHabitScheduledOn(h.frequency, today));
  const doneIds = new Set(logs.filter((l) => l.completed && l.date === today).map((l) => l.habitId));
  const done = scheduled.filter((h) => doneIds.has(h.id!)).length;
  const pct = scheduled.length ? Math.round((done / scheduled.length) * 100) : 0;
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="bottombar-progress">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgb(var(--color-surface-2))" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
          style={{ transition: "stroke-dashoffset .3s ease" }}
        />
      </svg>
      <div className="bottombar-progress-text">
        <strong>{pct}%</strong>
        <span>{scheduled.length ? `${done}/${scheduled.length} today` : "No habits today"}</span>
      </div>
    </div>
  );
}

/** Today's logged amount for one measurable (quantity-tracked) habit,
 *  rendered as a small horizontal chip for the bottom bar. */
function BottombarQuantityChip({ habit }: { habit: import("../types/habit").Habit }) {
  const today = todayStr();
  const logs = useLogsForHabit(habit.id);
  const measurement = habit.measurement;
  if (!measurement) return null;
  const value = logs.find((l) => l.date === today)?.value ?? 0;
  const pct = Math.min(100, Math.round((value / measurement.target) * 100));

  return (
    <div className="bottombar-quantity-chip">
      <div className="bottombar-quantity-chip-head">
        <span className="bottombar-quantity-dot" style={{ backgroundColor: habit.color }} />
        <span className="bottombar-quantity-name">{habit.name}</span>
        <span className="bottombar-quantity-value">{value}/{measurement.target} {measurement.unit}</span>
      </div>
      <div className="bottombar-quantity-bar">
        <div className="bottombar-quantity-bar-fill" style={{ width: `${pct}%`, backgroundColor: habit.color }} />
      </div>
    </div>
  );
}

/** Horizontal at-a-glance strip anchored to the bottom of the desktop
 *  window: today's progress ring, a 7-day habits chart, and quantity
 *  habits — each in its own card, centered and wrapping responsively.
 *  Only shown in List view on the dashboard screen — the Grid view has
 *  its own built-in stats card, so this would be redundant there. */
function BottomSummaryBar() {
  const habits = useHabits();
  const measurableHabits = habits.filter((h) => h.measurement);

  return (
    <footer className="desktop-bottombar" aria-label="Progress summary">
      <div className="desktop-bottombar-inner">
        <div className="bottombar-section bottombar-section-progress">
          <p className="bottombar-label">Progress</p>
          <BottombarProgress />
        </div>

        <div className="bottombar-section bottombar-section-chart">
          <p className="bottombar-label">This week</p>
          {habits.length === 0 ? (
            <p className="bottombar-empty">Add a habit to see your chart.</p>
          ) : (
            <div className="bottombar-chart">
              <WeekChart />
            </div>
          )}
        </div>

        {measurableHabits.length > 0 && (
          <div className="bottombar-section bottombar-section-quantity">
            <p className="bottombar-label">Quantity</p>
            <div className="bottombar-quantity-list scroll-area">
              {measurableHabits.map((h) => (
                <BottombarQuantityChip key={h.id} habit={h} />
              ))}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}

/** Color theme + light/dark controls, grouped together in the topbar so
 *  both appearance settings live in one place rather than being split
 *  between the header and the Settings screen. Matches the mobile header:
 *  a single icon button that cycles to the next theme on every click, plus
 *  a separate light/dark toggle right beside it — no popover, no picker. */
function ThemeControl({
  theme,
  onToggleTheme,
  isDark,
  onToggleDark
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}) {
  return (
    <div className="desktop-theme-control">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <button
        onClick={onToggleDark}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="desktop-theme-btn"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}

interface Props {
  screen: Screen;
  onChangeScreen: (screen: Screen) => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onAddHabit: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  children: ReactNode;
}

export function DesktopShell({
  screen,
  onChangeScreen,
  viewMode,
  onChangeViewMode,
  onAddHabit,
  theme,
  onToggleTheme,
  isDark,
  onToggleDark,
  children
}: Props) {
  const title = screen === "dashboard" ? "Today" : screen === "todos" ? "To-Do" : screen === "stats" ? "Statistics" : "Settings";

  return (
    <div className="desktop-shell">
      <section className="desktop-main">
        <header className="desktop-topbar">
          <div className="desktop-topbar-leading">
            <div className="desktop-brand">
              <div className="desktop-brand-mark">H</div>
              <div>
                <strong>Habitude</strong>
                <span>Build your rhythm</span>
              </div>
            </div>
            <div>
              <span className="desktop-eyebrow">Habitude</span>
              <h1>{title}</h1>
            </div>
          </div>

          <div className="desktop-topbar-actions">
            <div className="desktop-quick-nav" aria-label="Quick navigation">
              <button
                className={screen === "dashboard" ? "active" : ""}
                onClick={() => onChangeScreen("dashboard")}
                title="Habit tracker"
                aria-label="Habit tracker"
              >
                <CalendarDays size={16} /> <span>Habit tracker</span>
              </button>
              <button
                className={screen === "todos" ? "active" : ""}
                onClick={() => onChangeScreen("todos")}
                title="To-Do list"
                aria-label="To-Do list"
              >
                <CheckSquare size={16} /> <span>To-Do</span>
              </button>
              <button
                className={screen === "stats" ? "active" : ""}
                onClick={() => onChangeScreen("stats")}
                title="Statistics"
                aria-label="Statistics"
              >
                <BarChart3 size={16} /> <span>Stats</span>
              </button>
              <button
                className={screen === "settings" ? "active" : ""}
                onClick={() => onChangeScreen("settings")}
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={16} /> <span>Settings</span>
              </button>
            </div>
            <ThemeControl theme={theme} onToggleTheme={onToggleTheme} isDark={isDark} onToggleDark={onToggleDark} />
            {screen === "dashboard" && (
              <div className="desktop-view-toggle" aria-label="Dashboard view">
                <button className={viewMode === "loop" ? "active" : ""} onClick={() => onChangeViewMode("loop")}>
                  <LayoutGrid size={16} /> Grid
                </button>
                <button className={viewMode === "list" ? "active" : ""} onClick={() => onChangeViewMode("list")}>
                  <List size={16} /> List
                </button>
              </div>
            )}
            {screen !== "settings" && (
              <button className="desktop-primary-btn" onClick={onAddHabit}>
                <span>＋</span> New habit
              </button>
            )}
          </div>
        </header>

        <main className="desktop-content">{children}</main>

        {screen === "dashboard" && viewMode === "list" && (
          <BottomSummaryBar />
        )}
      </section>
    </div>
  );
}

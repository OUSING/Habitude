import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  BarChart3,
  Heart,
  Moon,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useHabits, useLogsForHabit, useLogsInRange } from "../hooks/useHabits";
import { archiveHabit, logMeasurement, toggleLog, toggleRest } from "../services/habitService";
import { isHabitScheduledOn, addDays, todayStr, weekdayOf, monthDates } from "../utils/date";
import { getIcon } from "../utils/icons";
import { computeMonthlyStreak } from "../utils/streak";
import { playCheckSound, playUncheckSound } from "../utils/sound";
import type { Habit } from "../types/habit";
import { StepCounterCard } from "./StepCounterCard";
import { useConfirm } from "./ui/ConfirmDialog";

interface Props {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenHabit: (habitId: number) => void;
  onAddHabit: () => void;
}

/** Same day, `n` calendar months earlier/later — clamped into the target
 *  month if it's shorter (e.g. Jan 31 - 1 month -> Feb 28/29, not Mar 3). */
function shiftMonth(dateStr: string, n: number) {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7)) - 1; // 0-indexed
  const day = Number(dateStr.slice(8, 10));
  const targetMonthLength = new Date(year, month + n + 1, 0).getDate();
  const clampedDay = Math.min(day, targetMonthLength);
  const d = new Date(year, month + n, clampedDay);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date: string) {
  return addDays(date, -weekdayOf(date));
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

const GRID_LONG_PRESS_MS = 500;

function GridHabitRow({ habit, dates, selectedDate, onEdit }: { habit: Habit; dates: string[]; selectedDate: string; onEdit: () => void }) {
  const logs = useLogsForHabit(habit.id);
  const doneDates = useMemo(() => new Set(logs.filter((l) => l.completed).map((l) => l.date)), [logs]);
  const restDates = useMemo(() => new Set(logs.filter((l) => l.rested).map((l) => l.date)), [logs]);
  const values = useMemo(
    () => new Map(logs.filter((l) => l.value != null).map((l) => [l.date, l.value ?? 0])),
    [logs]
  );

  // Streaks and completion counts are scoped to the calendar month currently
  // in view — paging to a different month shows that month's own numbers
  // instead of an all-time total, so nothing carries over across months.
  const monthKey = selectedDate.slice(0, 7);
  const year = Number(selectedDate.slice(0, 4));
  const month = Number(selectedDate.slice(5, 7)) - 1;
  const monthCompletions = useMemo(
    () => Array.from(doneDates).filter((d) => d.startsWith(monthKey)).length,
    [doneDates, monthKey]
  );
  const streak = computeMonthlyStreak(habit.frequency, doneDates, year, month, restDates);
  const Icon = getIcon(habit.icon);
  const confirm = useConfirm();
  const cellLongPressTimer = useRef<number | null>(null);
  const cellLongPressTriggered = useRef(false);

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (!habit.id) return;
    const ok = await confirm({
      title: "Delete Habit",
      message: `Delete "${habit.name}"?\n\nThis can't be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });
    if (ok) await archiveHabit(habit.id);
  }

  async function toggleDate(date: string) {
    if (!habit.id) return;
    if (habit.measurement) {
      const current = values.get(date) ?? 0;
      const next = current + 1;
      const completed = await logMeasurement(habit.id, date, next);
      if (completed && !doneDates.has(date)) playCheckSound();
      else if (!completed && doneDates.has(date)) playUncheckSound();
      return;
    }
    if (restDates.has(date)) {
      // Tapping a resting day just clears the rest — a deliberate second
      // tap is needed to actually check it off.
      await toggleRest(habit.id, date);
      return;
    }
    const completed = await toggleLog(habit.id, date);
    if (completed) playCheckSound();
    else playUncheckSound();
  }

  // Long-press an unmeasured cell to mark/unmark it as a rest day —
  // excused from streaks and completion stats instead of a miss.
  function handleCellPointerDown(date: string) {
    if (!habit.id || habit.measurement) return;
    cellLongPressTriggered.current = false;
    cellLongPressTimer.current = window.setTimeout(() => {
      cellLongPressTriggered.current = true;
      void toggleRest(habit.id!, date);
    }, GRID_LONG_PRESS_MS);
  }

  function clearCellLongPressTimer() {
    if (cellLongPressTimer.current != null) {
      window.clearTimeout(cellLongPressTimer.current);
      cellLongPressTimer.current = null;
    }
  }

  return (
    <div className="grid-mode-habit-row" style={{ "--day-count": dates.length } as CSSProperties}>
      <div className="grid-mode-habit-info-wrap">
        <button type="button" onClick={onEdit} className="grid-mode-habit-info" aria-label={`Edit ${habit.name}`}>
          <span className="grid-mode-habit-icon" style={{ backgroundColor: `${habit.color}14`, color: habit.color }}>
            <Icon size={17} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="grid-mode-habit-name">{habit.name}</span>
            <span className="grid-mode-habit-meta">
              <span className="grid-mode-meta-chip">
                <Check size={10} strokeWidth={2.6} />
                {monthCompletions}
              </span>
              {streak > 0 && (
                <span className="grid-mode-meta-chip is-streak">
                  <Flame size={10} strokeWidth={2.6} />
                  {streak}
                </span>
              )}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="grid-mode-habit-delete"
          aria-label={`Delete ${habit.name}`}
          title={`Delete ${habit.name}`}
        >
          <Trash2 size={14} strokeWidth={2.2} />
        </button>
      </div>

      <div className="grid-mode-cells">
        {dates.map((date) => {
          const scheduled = isHabitScheduledOn(habit.frequency, date);
          const done = doneDates.has(date);
          const rested = restDates.has(date);
          const value = values.get(date) ?? 0;
          return (
            <button
              key={date}
              type="button"
              disabled={!scheduled}
              onClick={() => {
                if (cellLongPressTriggered.current) {
                  cellLongPressTriggered.current = false;
                  return;
                }
                void toggleDate(date);
              }}
              onPointerDown={() => handleCellPointerDown(date)}
              onPointerUp={clearCellLongPressTimer}
              onPointerCancel={clearCellLongPressTimer}
              aria-label={`${habit.name} ${date}${rested ? " resting" : done ? " completed" : ""}`}
              title={rested ? "Resting — tap to undo" : !habit.measurement ? "Hold to mark as a rest day" : undefined}
              className={[
                "grid-mode-day-cell",
                done ? "is-done" : "",
                rested ? "is-rested" : "",
                !scheduled ? "is-disabled" : ""
              ].join(" ")}
              style={{
                borderColor: rested ? "rgb(var(--color-muted) / 0.6)" : scheduled ? `${habit.color}66` : undefined,
                borderStyle: rested ? "dashed" : undefined,
                backgroundColor: done ? habit.color : undefined
              }}
            >
              {rested ? (
                <Moon size={11} strokeWidth={2.4} className="opacity-80" />
              ) : done ? (
                <Check size={13} strokeWidth={2.4} />
              ) : habit.measurement && value > 0 ? (
                value
              ) : (
                ""
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GridHabitDashboard({ selectedDate, onSelectDate, onOpenHabit, onAddHabit }: Props) {
  const habits = useHabits();
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 700px)").matches);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const selectedDayRef = useRef<HTMLButtonElement>(null);

  // Where the strip should end up once the current smooth-scroll settles.
  // Clicking the nav arrows repeatedly and quickly used to read the
  // element's live scrollLeft, which is still mid-animation from the
  // previous click — the browser would then scroll relative to that
  // in-flight position, so fast clicks got dropped or overshot. Tracking
  // the intended target ourselves (and clamping it to the scrollable
  // range) makes every click advance by exactly one step, in order, no
  // matter how quickly they land.
  const scrollTargetRef = useRef<number | null>(null);

  // Lets people page through the days in view (a whole month on desktop,
  // a week on mobile) without needing to swipe the grid horizontally —
  // useful since the grid can be wider than the screen. This scrolls
  // within the currently selected period; the chevrons above jump to the
  // previous/next period entirely.
  function scrollDays(direction: -1 | 1) {
    const el = calendarScrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(el.scrollWidth - el.clientWidth, 0);
    const step = Math.max(el.clientWidth * 0.7, 160);
    const base = scrollTargetRef.current ?? el.scrollLeft;
    const next = Math.min(Math.max(base + direction * step, 0), maxScroll);
    scrollTargetRef.current = next;
    el.scrollTo({ left: next, behavior: "smooth" });
  }

  // Once a smooth-scroll (from the nav arrows, a swipe, or scrollIntoView)
  // actually settles, drop the tracked target so the next arrow click
  // resyncs from wherever the strip really ended up.
  useEffect(() => {
    const el = calendarScrollRef.current;
    if (!el) return;
    function clearTarget() {
      scrollTargetRef.current = null;
    }
    el.addEventListener("scrollend", clearTarget);
    return () => el.removeEventListener("scrollend", clearTarget);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 700px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const weekDates = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const calendarDates = useMemo(
    () => (isDesktop ? monthDates(selectedDate) : weekDates),
    [isDesktop, selectedDate, weekDates]
  );

  // Jump straight to the selected day's column on open and whenever the
  // visible period changes, so today (or whatever's selected) is in view
  // without anyone needing to scroll to find it.
  useEffect(() => {
    scrollTargetRef.current = null;
    selectedDayRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [calendarDates]);

  const calendarStart = calendarDates[0];
  const calendarEnd = calendarDates[calendarDates.length - 1];
  const weekLogs = useLogsInRange(calendarStart, calendarEnd);
  const todayLogs = useLogsInRange(selectedDate, selectedDate);
  const streakLogs = useLogsInRange(addDays(selectedDate, -365), selectedDate);

  const scheduledHabits = habits;
  const scheduledToday = habits.filter((h) => isHabitScheduledOn(h.frequency, selectedDate));
  const completedToday = todayLogs.filter((l) => l.completed && scheduledToday.some((h) => h.id === l.habitId)).length;
  const totalWeeklyTargets = habits.reduce((sum, habit) => {
    return sum + calendarDates.filter((date) => isHabitScheduledOn(habit.frequency, date)).length;
  }, 0);
  const weeklyCompleted = weekLogs.filter((l) => l.completed && habits.some((h) => h.id === l.habitId)).length;
  const weeklyProgress = totalWeeklyTargets ? Math.round((weeklyCompleted / totalWeeklyTargets) * 100) : 0;

  // Longest streak across habits, scoped to the month currently in view —
  // matches the per-habit chips, which also never merge across months.
  const monthYear = Number(selectedDate.slice(0, 4));
  const monthIndex = Number(selectedDate.slice(5, 7)) - 1;
  const longestCurrentStreak = useMemo(() => {
    return habits.reduce((max, habit) => {
      const habitLogs = streakLogs.filter((l) => l.habitId === habit.id);
      const dates = new Set(habitLogs.filter((l) => l.completed).map((l) => l.date));
      const restDates = new Set(habitLogs.filter((l) => l.rested).map((l) => l.date));
      return Math.max(max, computeMonthlyStreak(habit.frequency, dates, monthYear, monthIndex, restDates));
    }, 0);
  }, [habits, streakLogs, monthYear, monthIndex]);

  return (
    <div className="grid-mode-screen">
      <main className="grid-mode-content scroll-area">
        <section className="grid-mode-stats-card" aria-label="Habit summary">
          <div className="grid-mode-ring" style={{ "--progress": `${scheduledToday.length ? (completedToday / scheduledToday.length) * 100 : 0}%` } as CSSProperties}>
            <div>
              <strong>{completedToday} / {scheduledToday.length}</strong>
              <span>Completed</span>
            </div>
          </div>
          <div className="grid-mode-stat-divider" />
          <div className="grid-mode-stat">
            <strong><Flame size={20} strokeWidth={1.8} /> {longestCurrentStreak}</strong>
            <span>Day streak</span>
            <small>Keep it going</small>
          </div>
          <div className="grid-mode-stat-divider" />
          <div className="grid-mode-stat">
            <strong><span className="grid-mode-check-badge">✓</span> {weeklyProgress}%</strong>
            <span>Weekly progress</span>
            <small>{weeklyProgress >= 70 ? "Doing great" : "Keep building"}</small>
          </div>
        </section>

        <div className="grid-mode-trackers">
          <StepCounterCard />
        </div>

        <section className="grid-mode-calendar-card">
          <div className="grid-mode-calendar-top">
            <div className="grid-mode-date-title"><CalendarDays size={19} strokeWidth={1.8} /> <strong>{shortDate(selectedDate)}</strong></div>
            <div className="grid-mode-date-actions">
              <button type="button" onClick={() => onSelectDate(todayStr())}>Today</button>
              <button type="button" onClick={() => onSelectDate(isDesktop ? shiftMonth(selectedDate, -1) : addDays(selectedDate, -7))} aria-label={isDesktop ? "Previous month" : "Previous week"}><ChevronLeft size={17} strokeWidth={1.8} /></button>
              <button type="button" onClick={() => onSelectDate(isDesktop ? shiftMonth(selectedDate, 1) : addDays(selectedDate, 7))} aria-label={isDesktop ? "Next month" : "Next week"}><ChevronRight size={17} strokeWidth={1.8} /></button>
              {onAddHabit && <button type="button" onClick={onAddHabit} aria-label="Add a habit"><Plus size={17} strokeWidth={2} /></button>}
            </div>
          </div>

          <div className="grid-mode-calendar-scroll-wrap">
            {isDesktop && (
              <button
                type="button"
                className="grid-mode-scroll-nav grid-mode-scroll-nav-left"
                onClick={() => scrollDays(-1)}
                aria-label="Scroll days left"
              >
                <ChevronLeft size={16} strokeWidth={2.2} />
              </button>
            )}

            <div className="grid-mode-calendar-scroll" ref={calendarScrollRef}>
              <div
                className="grid-mode-week-header"
                style={{ "--day-count": calendarDates.length } as CSSProperties}
              >
                <div className="grid-mode-week-spacer">
                  <span>{isDesktop ? "Habit" : "Days"}</span>
                </div>
                {calendarDates.map((date) => {
                  const selected = date === selectedDate;
                  const isToday = date === todayStr();
                  const day = new Date(`${date}T00:00:00`);
                  return (
                    <button
                      key={date}
                      ref={selected ? selectedDayRef : undefined}
                      type="button"
                      onClick={() => onSelectDate(date)}
                      className={[selected ? "selected" : "", isToday && !selected ? "is-today" : ""].filter(Boolean).join(" ")}
                    >
                      <span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
                      <strong>{day.getDate()}</strong>
                      {selected && <i />}
                    </button>
                  );
                })}
              </div>

              <div className="grid-mode-habit-list">
                {scheduledHabits.map((habit) => (
                  <GridHabitRow key={habit.id} habit={habit} dates={calendarDates} selectedDate={selectedDate} onEdit={() => onOpenHabit(habit.id!)} />
                ))}
              </div>
            </div>

            {isDesktop && (
              <button
                type="button"
                className="grid-mode-scroll-nav grid-mode-scroll-nav-right"
                onClick={() => scrollDays(1)}
                aria-label="Scroll days right"
              >
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>

          <div className="grid-mode-footer">
            <div className="grid-mode-footer-bar">
              <div className="grid-mode-footer-bar-fill" style={{ width: `${weeklyProgress}%` }} />
            </div>
            <div className="grid-mode-footer-row">
              <span className="grid-mode-footer-summary">
                <BarChart3 size={13} strokeWidth={2} /> {scheduledHabits.length} habit{scheduledHabits.length === 1 ? "" : "s"} • Keep going! <Heart size={12} className="grid-mode-footer-heart" />
              </span>
              <span className="grid-mode-footer-quote">
                <Sparkles size={12} /> Consistency creates freedom.
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

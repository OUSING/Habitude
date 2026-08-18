import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { HabitCard } from "../components/HabitCard";
import { LoopHabitRow } from "../components/LoopHabitRow";
import { LoopDaysHeader } from "../components/LoopDaysHeader";
import { WeekStrip } from "../components/WeekStrip";
import { useHabits, useLogsInRange } from "../hooks/useHabits";
import { createHabit } from "../services/habitService";
import { isHabitScheduledOn } from "../utils/date";
import { paletteDefault } from "../utils/palette";
import { defaultIcon } from "../utils/icons";
import { getShowCompletedHabits, setShowCompletedHabits } from "../services/settings";
import type { ViewMode } from "../services/settings";
import { StepCounterCard } from "../components/StepCounterCard";
import { GridHabitDashboard } from "../components/GridHabitDashboard";

interface Props {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenHabit: (habitId: number) => void;
  onAddHabit: () => void;
  viewMode: ViewMode;
}

export function Dashboard({ selectedDate, onSelectDate, onOpenHabit, onAddHabit, viewMode }: Props) {
  // All hooks are called unconditionally, before branching on viewMode —
  // conditionally calling hooks (e.g. an early return above these calls)
  // breaks React's rules of hooks and causes internal "static flag" warnings.
  const habits = useHabits();
  const scheduled = habits.filter((h) => isHabitScheduledOn(h.frequency, selectedDate));

  // Logs for the selected day only, used to split the list view into
  // pending vs. done — mirrors how the to-do list sinks finished items.
  const dayLogs = useLogsInRange(selectedDate, selectedDate);
  const doneIds = new Set(dayLogs.filter((l) => l.completed).map((l) => l.habitId));
  const pending = scheduled.filter((h) => !doneIds.has(h.id!));
  const done = scheduled.filter((h) => doneIds.has(h.id!));

  const [showCompleted, setShowCompleted] = useState(true);
  useEffect(() => {
    getShowCompletedHabits().then(setShowCompleted);
  }, []);

  function toggleShowCompleted() {
    setShowCompleted((prev) => {
      const next = !prev;
      setShowCompletedHabits(next);
      return next;
    });
  }

  const [quickAddName, setQuickAddName] = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  async function handleQuickAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    await createHabit({
      name: trimmed,
      color: paletteDefault(),
      icon: defaultIcon(),
      frequency: { type: "daily" }
    });
    setQuickAddName("");
    quickAddRef.current?.focus();
  }

  if (viewMode === "loop") {
    return (
      <GridHabitDashboard
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        onOpenHabit={onOpenHabit}
        onAddHabit={onAddHabit}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* The week strip and quick-add field live in their own quiet card,
          set apart from the page background above and the habit list
          below — matching the phone app's dashboard toolbar. A single
          hairline (not a filled block) separates the week strip from the
          quick-add row within the card. The quick-add field creates a
          habit with default color/icon right away; the full editor
          (color, icon, schedule) is still reachable by opening any habit
          afterward. Desktop hides this row — it has its own "Add Habit"
          button that opens the full editor directly. */}
      <header className="dashboard-toolbar shrink-0">
        {viewMode === "list" && <WeekStrip selectedDate={selectedDate} onSelect={onSelectDate} />}

        <form onSubmit={handleQuickAdd} className="dashboard-quick-add mt-4 flex items-center gap-3 px-5">
          <input
            ref={quickAddRef}
            value={quickAddName}
            onChange={(e) => setQuickAddName(e.target.value)}
            placeholder="Add a habit"
            maxLength={40}
            className="dashboard-quick-add-input tap-target min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none"
          />
          <button
            type="submit"
            disabled={!quickAddName.trim()}
            aria-label="Add habit"
            className={`dashboard-quick-add-submit tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
              quickAddName.trim() ? "is-armed" : "opacity-0"
            }`}
          >
            <Plus size={15} strokeWidth={2} />
          </button>
        </form>
      </header>

      <main className="scroll-area flex-1 px-4 py-4">
        <StepCounterCard />

        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="font-display text-lg font-semibold text-ink">Nothing scheduled</p>
            <p className="max-w-[16rem] text-sm text-muted">
              No habits scheduled. Add one above to get started.
            </p>
          </div>
        ) : viewMode === "list" ? (
          scheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="font-display text-lg font-semibold text-ink">Nothing scheduled</p>
              <p className="max-w-[16rem] text-sm text-muted">
                No habits scheduled for this day. Add one above.
              </p>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {pending.map((habit) => (
                  <li key={habit.id}>
                    <HabitCard habit={habit} date={selectedDate} onEdit={() => onOpenHabit(habit.id!)} />
                  </li>
                ))}
              </ul>

              {done.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Completed ({done.length})
                    </p>
                    <button
                      onClick={toggleShowCompleted}
                      aria-label={showCompleted ? "Hide completed habits" : "Show completed habits"}
                      aria-pressed={showCompleted}
                      className="tap-target -m-2 flex items-center gap-1 text-xs font-semibold text-muted active:text-accent"
                    >
                      {showCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
                      {showCompleted ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showCompleted && (
                    <ul className="flex flex-col gap-2 opacity-60">
                      {done.map((habit) => (
                        <li key={habit.id}>
                          <HabitCard habit={habit} date={selectedDate} onEdit={() => onOpenHabit(habit.id!)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="pb-20" />
            </>
          )
        ) : (
          <>
            <div className="no-scrollbar overflow-x-auto">
              <LoopDaysHeader selectedDate={selectedDate} />
              <ul className="mt-1 flex min-w-max flex-col gap-1.5 pb-24">
                {habits.map((habit) => (
                  <li key={habit.id}>
                    <LoopHabitRow habit={habit} onEdit={() => onOpenHabit(habit.id!)} selectedDate={selectedDate} />
                  </li>
                ))}
                <li>
                  <button type="button" className="grid-list-insert-habit" onClick={onAddHabit}>
                    <Plus size={16} /> Add a habit to your grid
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

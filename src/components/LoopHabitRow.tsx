import { useMemo, useState, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Check, CheckCircle2, Flame, Moon, Trash2 } from "lucide-react";
import type { Habit } from "../types/habit";
import { useLogsForHabit } from "../hooks/useHabits";
import { computeStreakSync } from "../utils/streak";
import { archiveHabit, logMeasurement, toggleLog, toggleRest } from "../services/habitService";
import { formatFullDate, isHabitScheduledOn, monthDates, todayStr } from "../utils/date";
import { playCheckSound, playUncheckSound } from "../utils/sound";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { useConfirm } from "./ui/ConfirmDialog";
import { Modal } from "./ui/Modal";
import { QuantityInput } from "./ui/QuantityInput";
import { getIcon } from "../utils/icons";

const LONG_PRESS_MS = 500;

interface Props {
  habit: Habit;
  onEdit: () => void;
  selectedDate?: string;
}

/**
 * Modeled on Loop Habit Tracker's signature list row: instead of only
 * showing "today", every habit gets a strip of its recent days so you
 * can see (and fill in) a stretch of history at a glance.
 */
export function LoopHabitRow({ habit, onEdit, selectedDate }: Props) {
  const confirm = useConfirm();
  const logs = useLogsForHabit(habit.id);
  const dates = useMemo(() => monthDates(selectedDate), [selectedDate]);
  const doneDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  const restDates = new Set(logs.filter((l) => l.rested).map((l) => l.date));
  const valuesByDate = useMemo(
    () => new Map(logs.filter((l) => l.value != null).map((l) => [l.date, l.value ?? 0])),
    [logs]
  );
  const streak = computeStreakSync(habit.frequency, doneDates, selectedDate ?? todayStr(), restDates);
  // Total days ever checked off, independent of the current streak.
  const totalChecked = doneDates.size;
  const measurement = habit.measurement;

  // For quantity habits, a tap opens this instead of instantly toggling —
  // the user needs to type/step in how much they actually reached that
  // day, not just flip between "full target" and "nothing".
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState(0);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  function handleCellPointerDown(e: ReactPointerEvent<HTMLButtonElement>, date: string) {
    e.stopPropagation();
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      if (measurement) {
        setEditingAmount(logs.find((l) => l.date === date)?.value ?? 0);
        setEditingDate(date);
      } else if (habit.id) {
        // Long-press an unmeasured day to mark/unmark it as a rest day —
        // excused from streaks and completion stats instead of a miss.
        void toggleRest(habit.id, date);
      }
    }, LONG_PRESS_MS);
  }

  function clearLongPressTimer() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  async function handleCellClick(date: string) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (measurement) {
      const currentVal = logs.find((l) => l.date === date)?.value ?? 0;
      await handleAmountChangeForDate(date, currentVal + 1);
    } else if (restDates.has(date)) {
      // Tapping a resting day just clears the rest — a deliberate second
      // tap is needed to actually check it off.
      if (habit.id) await toggleRest(habit.id, date);
    } else {
      await handleToggleDate(date);
    }
  }

  async function handleAmountChangeForDate(targetDate: string, next: number) {
    if (!habit.id || !measurement) return;
    const wasCompleted = doneDates.has(targetDate);
    const nowCompleted = await logMeasurement(habit.id, targetDate, next);
    if (nowCompleted && !wasCompleted) playCheckSound();
    else if (!nowCompleted && wasCompleted) playUncheckSound();
  }



  async function handleToggleDate(date: string) {
    if (!habit.id) return;
    const next = await toggleLog(habit.id, date);
    if (next) playCheckSound();
    else playUncheckSound();
  }

  async function handleAmountChange(next: number) {
    if (!habit.id || !editingDate || !measurement) return;
    setEditingAmount(next);
    const wasCompleted = doneDates.has(editingDate);
    const nowCompleted = await logMeasurement(habit.id, editingDate, next);
    if (nowCompleted && !wasCompleted) playCheckSound();
    else if (!nowCompleted && wasCompleted) playUncheckSound();
  }

  async function handleDelete() {
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

  const Icon = getIcon(habit.icon);

  return (
    <SwipeToDelete
      className="overflow-visible"
      onSwipeRight={{
        onTrigger: handleDelete,
        icon: <Trash2 size={17} className="text-white" />,
        requireConfirm: false
      }}
    >
      <div className="flex min-w-max items-center rounded-2xl bg-surface px-3 py-2.5 shadow-sm border border-border overflow-visible">
        {/* Left Side: Habit Details */}
        <button
          onClick={onEdit}
          className="pinned-habit-column sticky left-0 z-30 flex w-[170px] shrink-0 flex-col self-stretch justify-center bg-surface/90 pr-3 text-left"
          aria-label={`Edit ${habit.name}`}
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            {/* Color-tinted icon background */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${habit.color}15`, color: habit.color }}
            >
              <Icon size={14} strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">
                {habit.name}
              </span>
              {(streak > 0 || totalChecked > 0) && (
                <div className="mt-0.5 flex items-center gap-2">
                  {streak > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-accent"
                      title={`${streak} day streak`}
                      aria-label={`${streak} day streak`}
                    >
                      <Flame size={9} strokeWidth={2.5} className="fill-accent text-accent" />
                      <span>{streak}</span>
                    </span>
                  )}
                  {totalChecked > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-muted"
                      title={`${totalChecked} days checked in total`}
                      aria-label={`${totalChecked} days checked in total`}
                    >
                      <CheckCircle2 size={9} strokeWidth={2.5} />
                      <span>{totalChecked}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Right Side: Day Cells */}
        <div className="flex items-center gap-1.5 ml-2 py-0.5">
          {dates.map((date) => {
            const scheduled = isHabitScheduledOn(habit.frequency, date);
            const done = doneDates.has(date);
            const rested = restDates.has(date);
            const value = measurement ? valuesByDate.get(date) ?? 0 : 0;
            return (
              <button
                key={date}
                onClick={() => handleCellClick(date)}
                onPointerDown={(e) => handleCellPointerDown(e, date)}
                onPointerUp={clearLongPressTimer}
                onPointerCancel={clearLongPressTimer}
                onPointerMove={(e) => e.stopPropagation()}
                disabled={!scheduled}
                aria-label={
                  rested
                    ? `${date} — resting`
                    : measurement
                    ? `${date} — ${value} of ${measurement.target} ${measurement.unit}`
                    : `${date}${done ? " — done" : ""}${!measurement ? " (hold to mark as a rest day)" : ""}`
                }
                aria-pressed={done}
                title={rested ? "Resting — tap to undo" : !measurement ? "Hold to mark as a rest day" : undefined}
                className={[
                  "h-7 w-7 rounded-full flex items-center justify-center transition-all duration-100",
                  scheduled ? "active:scale-90" : "opacity-20 cursor-default"
                ].join(" ")}
                style={{
                  backgroundColor: done ? habit.color : "transparent",
                  border: rested
                    ? "2px dashed rgb(var(--color-muted) / 0.6)"
                    : scheduled
                    ? `2px solid ${habit.color}`
                    : "none",
                  borderColor: done ? habit.color : scheduled && !rested ? habit.color : undefined
                }}
              >
                {measurement && scheduled && !rested && value > 0 && (
                  <span
                    className="font-mono text-[9px] font-bold leading-none"
                    style={{ color: done ? "white" : habit.color }}
                  >
                    {value}
                  </span>
                )}
                {rested && <Moon size={10} strokeWidth={2.4} className="text-muted opacity-80" />}
                {!measurement && !rested && done && <Check size={11} strokeWidth={3} className="text-white" />}
                {!scheduled && (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {measurement && (
        <Modal
          open={editingDate != null}
          onClose={() => setEditingDate(null)}
          title={habit.name}
          variant="dialog"
        >
          <QuantityInput
            initialValue={editingAmount}
            target={measurement.target}
            unit={measurement.unit}
            color={habit.color}
            title={editingDate ? formatFullDate(editingDate) : ""}
            onSave={async (val) => {
              if (editingDate) {
                await handleAmountChange(val);
              }
              setEditingDate(null);
            }}
            onCancel={() => setEditingDate(null)}
          />
        </Modal>
      )}
    </SwipeToDelete>
  );
}

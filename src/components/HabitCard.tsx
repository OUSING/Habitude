import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Check, CheckCircle2, Flame, Moon, Pencil, Trash2 } from "lucide-react";
import type { Habit } from "../types/habit";
import { useLogsForHabit } from "../hooks/useHabits";
import { computeStreakSync } from "../utils/streak";
import { archiveHabit, logMeasurement, toggleLog, toggleRest } from "../services/habitService";
import { getIcon } from "../utils/icons";
import { playCheckSound, playUncheckSound } from "../utils/sound";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { useConfirm } from "./ui/ConfirmDialog";
import { Modal } from "./ui/Modal";
import { QuantityInput } from "./ui/QuantityInput";
import { fireCompletionCelebration } from "../utils/completionCelebration";

const LONG_PRESS_MS = 500;


interface Props {
  habit: Habit;
  date: string;
  onEdit: () => void;
}

export function HabitCard({ habit, date, onEdit }: Props) {
  const logs = useLogsForHabit(habit.id);
  const doneDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  const restDates = new Set(logs.filter((l) => l.rested).map((l) => l.date));
  const completed = doneDates.has(date);
  const rested = restDates.has(date);
  const streak = computeStreakSync(habit.frequency, doneDates, date, restDates);
  // Total days ever checked off, independent of the current streak — this
  // doesn't reset when a scheduled day is skipped, it just keeps counting.
  const totalChecked = doneDates.size;
  const Icon = getIcon(habit.icon);
  const confirm = useConfirm();
  const measurement = habit.measurement;
  const todayLog = logs.find((l) => l.date === date);

  const wasCompleted = useRef(completed);
  const [amount, setAmount] = useState(todayLog?.value ?? 0);
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const checkLongPressTimer = useRef<number | null>(null);
  const checkLongPressTriggered = useRef(false);

  // Keep the input's local value in sync if the log changes elsewhere
  // (e.g. a fresh day rolling over).
  useEffect(() => {
    setAmount(todayLog?.value ?? 0);
  }, [todayLog?.value]);

  async function handleToggle(e: MouseEvent) {
    e.stopPropagation();
    if (checkLongPressTriggered.current) {
      checkLongPressTriggered.current = false;
      return;
    }
    if (!habit.id) return;
    // Tapping a resting day just clears the rest instead of completing it
    // outright — a deliberate second tap is needed to actually check it off.
    if (rested) {
      await toggleRest(habit.id, date);
      return;
    }
    const next = await toggleLog(habit.id, date);
    if (next) {
      playCheckSound();
      fireCompletionCelebration("habit", document.documentElement.className.includes("theme-christmas") ? "christmas" : document.documentElement.className.includes("theme-halloween") ? "halloween" : "");
    } else playUncheckSound();
    wasCompleted.current = next;
  }

  // Long-press the check circle to mark/unmark the day as a rest day —
  // excused from streaks and completion stats instead of counting as a
  // miss. Kept separate from the measurement long-press (which opens the
  // quantity modal) so the two never collide.
  function handleCheckPointerDown(e: ReactPointerEvent) {
    if (measurement || !habit.id) return;
    e.stopPropagation();
    checkLongPressTriggered.current = false;
    checkLongPressTimer.current = window.setTimeout(() => {
      checkLongPressTriggered.current = true;
      void toggleRest(habit.id!, date);
    }, LONG_PRESS_MS);
  }

  function clearCheckLongPressTimer() {
    if (checkLongPressTimer.current != null) {
      window.clearTimeout(checkLongPressTimer.current);
      checkLongPressTimer.current = null;
    }
  }

  async function handleAmountChange(next: number) {
    setAmount(next);
    if (!habit.id || !measurement) return;
    const nowCompleted = await logMeasurement(habit.id, date, next);
    if (nowCompleted && !wasCompleted.current) {
      playCheckSound();
      fireCompletionCelebration("habit", document.documentElement.className.includes("theme-christmas") ? "christmas" : document.documentElement.className.includes("theme-halloween") ? "halloween" : "");
    } else if (!nowCompleted && wasCompleted.current) {
      playUncheckSound();
    }
    wasCompleted.current = nowCompleted;
  }

  // Tapping the badge logs +1 directly — the habit only moves into the
  // "done" list once the running total reaches the target (see
  // habitService.logMeasurement), so a few taps below target just update
  // the count and the quantity chart without completing the habit yet.
  // Holding it down (500ms) instead opens a modal with a direct number
  // field, for setting an exact amount without tapping +1 repeatedly.
  function handleQuantityPointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setQuantityModalOpen(true);
    }, LONG_PRESS_MS);
  }

  function clearLongPressTimer() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleQuantityClick(e: MouseEvent) {
    e.stopPropagation();
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    handleAmountChange(amount + 1);
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

  return (
    <SwipeToDelete
      onSwipeLeft={{
        onTrigger: onEdit,
        icon: <Pencil size={17} className="text-white" />,
        requireConfirm: false
      }}
      onSwipeRight={{
        onTrigger: handleDelete,
        icon: <Trash2 size={17} className="text-white" />,
        confirmMessage: `Delete "${habit.name}"?`,
        requireConfirm: true
      }}
    >
      <div
        className="habit-row-elevated flex min-h-[54px] items-center gap-2 rounded-full border px-3.5 py-2 transition-all duration-200 active:scale-[0.985] sm:min-h-[58px] sm:px-4"
        style={{
          backgroundColor: `${habit.color}24`,
          borderColor: `${habit.color}14`
        }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Delete ${habit.name}`}
          title={`Delete ${habit.name}`}
          className="tap-target flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted/60 transition-colors hover:text-red-500 active:scale-90"
        >
          <Trash2 size={13} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
          >
            <Icon size={15} strokeWidth={2.3} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-ink sm:text-[13.5px]">
              {habit.name}
            </p>
            {(streak > 0 || totalChecked > 0) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {streak > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-accent"
                    title={`${streak} day streak`}
                    aria-label={`${streak} day streak`}
                  >
                    <Flame size={9} strokeWidth={2.5} className="fill-accent text-accent" />
                    <span>{streak} day streak</span>
                  </span>
                )}
                {totalChecked > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-muted"
                    title={`${totalChecked} days checked in total`}
                    aria-label={`${totalChecked} days checked in total`}
                  >
                    <CheckCircle2 size={9} strokeWidth={2.5} />
                    <span>{totalChecked} checked</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative shrink-0">
          {measurement ? (
            <button
              onClick={handleQuantityClick}
              onPointerDown={handleQuantityPointerDown}
              onPointerUp={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onPointerMove={(e) => e.stopPropagation()}
              aria-label={`${amount} of ${measurement.target} ${measurement.unit} — tap to add 1, hold to enter amount`}
              className={[
                "tap-target relative flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-2 sm:h-8 sm:min-w-8",
                "transition-all duration-150 active:scale-90",
                completed ? "text-white" : "border-2 bg-transparent"
              ].join(" ")}
              style={
                completed
                  ? { backgroundColor: habit.color }
                  : { borderColor: habit.color, color: habit.color }
              }
            >
              {completed ? (
                <Check size={14} strokeWidth={3} className="animate-check-bounce" />
              ) : (
                <span className="font-mono text-[10.5px] font-bold leading-none">
                  {amount}/{measurement.target}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={handleToggle}
              onPointerDown={handleCheckPointerDown}
              onPointerUp={clearCheckLongPressTimer}
              onPointerCancel={clearCheckLongPressTimer}
              onPointerMove={(e) => e.stopPropagation()}
              aria-label={
                rested
                  ? "Resting today — tap to undo"
                  : completed
                  ? "Mark as not done"
                  : "Mark as done (hold to mark as a rest day)"
              }
              aria-pressed={completed}
              title={rested ? "Resting — tap to undo" : "Hold to mark as a rest day"}
              className={[
                "tap-target relative flex h-[30px] w-[30px] items-center justify-center rounded-full sm:h-8 sm:w-8",
                "transition-all duration-150 active:scale-90",
                rested ? "text-muted" : completed ? "text-white" : "border-2 bg-transparent text-transparent"
              ].join(" ")}
              style={
                rested
                  ? { borderWidth: 2, borderStyle: "dashed", borderColor: "rgb(var(--color-muted) / 0.6)" }
                  : completed
                  ? { backgroundColor: habit.color }
                  : { borderColor: habit.color }
              }
            >
              {rested ? (
                <Moon size={12} strokeWidth={2.4} className="opacity-80" />
              ) : (
                <Check
                  key={completed ? "on" : "off"}
                  size={14}
                  strokeWidth={3}
                  className={completed ? "animate-check-bounce opacity-100" : "opacity-0"}
                />
              )}
            </button>
          )}
        </div>
      </div>

      {measurement && (
        <Modal
          open={quantityModalOpen}
          onClose={() => setQuantityModalOpen(false)}
          title={habit.name}
          variant="dialog"
        >
          <QuantityInput
            initialValue={amount}
            target={measurement.target}
            unit={measurement.unit}
            color={habit.color}
            title="Today"
            onSave={(val) => {
              handleAmountChange(val);
              setQuantityModalOpen(false);
            }}
            onCancel={() => setQuantityModalOpen(false)}
          />
        </Modal>
      )}
    </SwipeToDelete>
  );
}

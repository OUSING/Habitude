import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { useSubTodos, useTodos } from "../hooks/useTodos";
import { clearCompletedTodos, createSubTodo, createTodo, deleteTodo, toggleTodo, updateTodo } from "../services/todoService";
import { ICON_KEYS, defaultIcon, getIcon } from "../utils/icons";
import { CheckBurst } from "../components/CheckBurst";
import { SwipeToDelete } from "../components/ui/SwipeToDelete";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { playCheckSound, playUncheckSound } from "../utils/sound";
import { getShowCompletedTodos, setShowCompletedTodos } from "../services/settings";
import type { Todo } from "../types/todo";
import { fireCompletionCelebration } from "../utils/completionCelebration";
import { Modal } from "../components/ui/Modal";

// Tasks-screen accent — follows the active app theme (same brand color used
// for the date highlight and everywhere else), so it only actually reads as
// purple when the "Purple" theme itself is selected.
const TODO_ACCENT = "rgb(var(--color-brand))";
const TODO_ACCENT_SOFT = "rgb(var(--color-brand) / 0.11)";

function localDayKey(timestamp = Date.now()): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


function taskStreak(todos: Todo[], todayKey: string): number {
  const completedDays = new Set(
    todos
      .filter((t) => t.done && t.completedAt)
      .map((t) => localDayKey(t.completedAt))
  );

  if (!completedDays.has(todayKey)) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  while (completedDays.has(localDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function CompletionCard({ done, total, streak }: { done: number; total: number; streak: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <section
      aria-label={`Today's task completion: ${percent}%`}
      className="mt-3 flex min-h-[82px] w-full items-center rounded-[18px] border border-border/50 bg-surface px-3 py-2 shadow-sm sm:min-h-[88px] sm:px-4"
    >
      <div className="relative flex h-[62px] w-[62px] shrink-0 items-center justify-center sm:h-[68px] sm:w-[68px]">
        <svg
          viewBox="0 0 68 68"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke="rgb(var(--color-surface-2))"
            strokeWidth="5"
          />
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke="rgb(var(--color-brand))"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <span className="font-display text-[14px] font-semibold text-ink">{percent}%</span>
      </div>

      <div className="ml-3 min-w-0 flex-1 pr-3 sm:ml-4">
        <p className="text-[10px] font-medium text-muted sm:text-[11px]">Today's Progress</p>
        <p className="mt-0.5 truncate text-[13px] font-medium text-ink sm:text-[14px]">
          {done} / {total} completed
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, backgroundColor: TODO_ACCENT }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-l border-border/60 pl-3 sm:pl-4">
        <span className="text-[18px] leading-none sm:text-[20px]" aria-hidden="true">🔥</span>
        <div className="leading-none">
          <p className="text-[16px] font-semibold text-ink sm:text-[18px]">{streak}</p>
          <p className="mt-1 text-[8px] text-muted sm:text-[9px]">day streak</p>
        </div>
      </div>
    </section>
  );
}

function useTodayKey(): string {
  const [day, setDay] = useState(() => localDayKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 50);
      timer = setTimeout(() => {
        setDay(localDayKey());
        schedule();
      }, Math.max(250, next.getTime() - now.getTime()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return day;
}

/** The small ring checkbox shared by main rows and subtask rows — this is
 *  the "check cycle": deliberately compact (Microsoft To Do–sized) rather
 *  than the bigger circle habit rows use, so a dense task list stays
 *  scannable. */
function CheckCircle({
  done,
  size,
  onClick,
  label
}: {
  done: boolean;
  size: "sm" | "xs" | "lg";
  onClick: () => void;
  label: string;
}) {
  const dims = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-[16px] w-[16px]" : "h-[13px] w-[13px]";
  const minOverride = size === "lg" ? "!min-h-5 !min-w-5" : size === "sm" ? "!min-h-4 !min-w-4" : "!min-h-3 !min-w-3";
  const border = "border-2";
  const iconSize = size === "lg" ? 9 : size === "sm" ? 9 : 7;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      aria-pressed={done}
      aria-label={label}
      className={[
        "tap-target flex shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90",
        dims,
        minOverride,
        border,
        done ? "text-white" : "bg-transparent text-transparent"
      ].join(" ")}
      style={{ borderColor: TODO_ACCENT, backgroundColor: done ? TODO_ACCENT : "transparent" }}
    >
      <svg
        viewBox="0 0 24 24"
        width={iconSize}
        height={iconSize}
        className={done ? "animate-check-bounce opacity-100" : "opacity-0"}
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

function SubTodoRow({ todo }: { todo: Todo }) {
  const [burstKey, setBurstKey] = useState(0);

  async function handleToggle() {
    if (!todo.id) return;
    const next = await toggleTodo(todo.id);
    if (next) {
      setBurstKey((k) => k + 1);
      playCheckSound();
      fireCompletionCelebration("task", document.documentElement.className.includes("theme-christmas") ? "christmas" : document.documentElement.className.includes("theme-halloween") ? "halloween" : "");
    } else {
      playUncheckSound();
    }
  }

  async function handleDelete() {
    if (!todo.id) return;
    await deleteTodo(todo.id);
  }

  return (
    <div className="group flex min-h-0 min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2/60">
      <div className="relative shrink-0">
        <CheckBurst triggerKey={burstKey} color={TODO_ACCENT} />
        <CheckCircle
          done={todo.done}
          size="lg"
          onClick={handleToggle}
          label={todo.done ? "Mark as not done" : "Mark as done"}
        />
      </div>
      <p
        className={[
          "min-w-0 flex-1 truncate text-[11px]",
          todo.done ? "text-muted line-through" : "font-medium text-ink"
        ].join(" ")}
      >
        {todo.text}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        aria-label="Delete subtask"
        className="flex h-5 w-5 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-full text-muted/70 opacity-0 transition-opacity group-hover:opacity-100 active:text-accent sm:opacity-40"
      >
        <X size={10} />
      </button>
    </div>
  );
}

/** Click-to-add row for subtasks. At rest it reads as a clear, labeled
 *  "Add subtask" affordance (dashed ring + plus + text) rather than an
 *  unlabeled empty circle, so it's obvious this is where new steps go.
 *  One tap turns it into a focused text field in place — Enter or
 *  blur-with-text saves it, Escape/blur-empty just reverts. */
function AddSubTodoRow({ onAdd }: { onAdd: (text: string) => void }) {
  // Opens already in editing mode: this row is remounted fresh each time
  // the subtasks panel opens (see the `{subsOpen && (...)}` block below),
  // so starting here means a single tap on the task is enough to start
  // typing a subtask — no second tap on an "Add subtask" placeholder needed.
  const [editing, setEditing] = useState(true);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const trimmed = value.trim();
    setEditing(false);
    setValue("");
    if (trimmed) onAdd(trimmed);
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
        className="flex min-h-0 min-w-0 items-center gap-2 rounded-lg px-1.5 py-1"
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: TODO_ACCENT, color: TODO_ACCENT }}
        >
          <Plus size={10} strokeWidth={2.5} />
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue("");
              setEditing(false);
            }
          }}
          placeholder="Subtask name"
          maxLength={80}
          className="subtask-input min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-muted"
        />
      </form>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      aria-label="Add subtask"
      className="tap-target !min-h-6 flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2/60 active:scale-[0.99]"
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-dashed opacity-60"
        style={{ borderColor: TODO_ACCENT, color: TODO_ACCENT }}
      >
        <Plus size={10} strokeWidth={2.5} />
      </span>
      <span className="text-[11px] font-medium text-muted">Add subtask</span>
    </button>
  );
}

function TodoRow({ todo, todayKey }: { todo: Todo; todayKey: string }) {
  const [burstKey, setBurstKey] = useState(0);
  const subTodos = useSubTodos(todo.id);
  const [subsOpen, setSubsOpen] = useState(false);
  const visibleSubTodos = subTodos.filter((s) => !s.done || localDayKey(s.completedAt ?? 0) === todayKey);
  const doneSteps = visibleSubTodos.filter((s) => s.done).length;
  const hasSubs = visibleSubTodos.length > 0;
  const subProgress = hasSubs ? Math.round((doneSteps / visibleSubTodos.length) * 100) : 0;
  const TaskIcon = getIcon(todo.icon);
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [editIcon, setEditIcon] = useState(todo.icon || defaultIcon());

  function openEdit() {
    setEditText(todo.text);
    setEditIcon(todo.icon || defaultIcon());
    setEditOpen(true);
  }

  async function handleEditSave() {
    const trimmed = editText.trim();
    if (!todo.id || !trimmed) return;
    await updateTodo(todo.id, { text: trimmed, icon: editIcon });
    setEditOpen(false);
  }

  async function handleToggle() {
    if (!todo.id) return;
    const next = await toggleTodo(todo.id);
    if (next) {
      setBurstKey((k) => k + 1);
      playCheckSound();
      fireCompletionCelebration("task", document.documentElement.className.includes("theme-christmas") ? "christmas" : document.documentElement.className.includes("theme-halloween") ? "halloween" : "");
    } else {
      playUncheckSound();
    }
  }

  async function handleDelete() {
    if (!todo.id) return;
    await deleteTodo(todo.id);
  }

  async function handleDeleteButton() {
    const ok = await confirm({
      title: "Delete Confirmation",
      message: `Delete "${todo.text}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });
    if (ok) await handleDelete();
  }

  return (
    <li>
      <SwipeToDelete
        onSwipeLeft={{
          onTrigger: openEdit,
          icon: <Pencil size={15} className="text-white" />,
          bgClassName: "bg-brand",
          requireConfirm: false
        }}
        onSwipeRight={{
          onTrigger: handleDelete,
          icon: <Trash2 size={15} className="text-white" />,
          confirmTitle: "Delete task?",
          confirmMessage: `Delete "${todo.text}"?`
        }}
        className="mb-2"
      >
        <div
          className="group rounded-2xl border px-3 py-2.5 shadow-none transition-all duration-200 sm:px-3.5"
          style={{
            backgroundColor: "rgb(var(--color-surface))",
            borderColor: "rgb(var(--color-border) / 0.6)"
          }}
        >
          <div className="flex min-h-[38px] items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8"
              style={{ backgroundColor: "rgb(var(--color-brand) / 0.14)" }}
              aria-hidden="true"
            >
              <TaskIcon size={16} strokeWidth={2} style={{ color: TODO_ACCENT }} />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setSubsOpen((v) => !v);
              }}
              className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
              aria-expanded={subsOpen}
            >
              <p
                className={[
                  "truncate text-[13px] font-medium leading-tight sm:text-[13.5px]",
                  todo.done ? "text-muted line-through" : "text-ink"
                ].join(" ")}
              >
                {todo.text}
              </p>
              {hasSubs ? (
                <div className="flex w-full items-center gap-1.5">
                  <div className="h-1 w-full max-w-[110px] shrink-0 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${subProgress}%`, backgroundColor: TODO_ACCENT }}
                    />
                  </div>
                  <span className="shrink-0 text-[9.5px] leading-tight text-muted">
                    {doneSteps}/{visibleSubTodos.length} subtasks
                  </span>
                </div>
              ) : (
                <p className="text-[9.5px] leading-tight text-muted/80">
                  {todo.done ? "Completed today" : "Tap to add subtasks"}
                </p>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSubsOpen((v) => !v);
              }}
              aria-label={subsOpen ? "Hide subtasks" : "Show subtasks"}
              aria-expanded={subsOpen}
              className="tap-target flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink sm:h-5 sm:w-5"
            >
              <ChevronRight
                size={14}
                className={["transition-transform duration-150", subsOpen ? "rotate-90" : ""].join(" ")}
              />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleDeleteButton();
              }}
              aria-label="Delete task"
              className="tap-target flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted/70 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 active:scale-90 sm:h-5 sm:w-5 sm:opacity-40"
            >
              <Trash2 size={13} />
            </button>

            <div className="relative shrink-0">
              <CheckBurst triggerKey={burstKey} color={TODO_ACCENT} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleToggle();
                }}
                aria-pressed={todo.done}
                aria-label={todo.done ? "Mark as not done" : "Mark as done"}
                className={[
                  "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90 sm:h-7 sm:w-7",
                  todo.done ? "text-white" : "border-[1.5px] bg-transparent text-transparent"
                ].join(" ")}
                style={todo.done ? { backgroundColor: TODO_ACCENT } : { borderColor: TODO_ACCENT }}
              >
                {todo.done && (
                  <svg
                    viewBox="0 0 24 24"
                    width={12}
                    height={12}
                    className="animate-check-bounce"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {subsOpen && (
            <div
              className="ml-[46px] mt-2 border-l-2 pl-3 sm:ml-[50px]"
              style={{ borderColor: "rgb(var(--color-brand) / 0.18)" }}
            >
              {visibleSubTodos.map((sub) => (
                <SubTodoRow key={sub.id} todo={sub} />
              ))}

              <AddSubTodoRow onAdd={(text) => todo.id && createSubTodo(todo.id, text)} />
            </div>
          )}
        </div>
      </SwipeToDelete>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit task">
        <div className="task-edit-sheet">
          <label htmlFor={`edit-task-${todo.id}`} className="task-edit-label">Task name</label>
          <input
            id={`edit-task-${todo.id}`}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            maxLength={80}
            autoFocus
            className="task-edit-input"
            placeholder="Task name"
          />

          <div className="task-edit-label task-edit-icon-label">Icon</div>
          <div className="task-edit-icon-grid">
            {ICON_KEYS.map((key) => {
              const Ic = getIcon(key);
              const selected = key === editIcon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEditIcon(key)}
                  aria-label={`Use ${key} icon`}
                  aria-pressed={selected}
                  className="task-edit-icon-button"
                  style={selected ? { backgroundColor: TODO_ACCENT_SOFT, color: TODO_ACCENT } : undefined}
                >
                  <Ic size={19} strokeWidth={2} />
                </button>
              );
            })}
          </div>

          <div className="task-edit-actions">
            <button type="button" onClick={() => setEditOpen(false)} className="task-edit-cancel">Cancel</button>
            <button type="button" onClick={() => void handleEditSave()} disabled={!editText.trim()} className="task-edit-save">Save changes</button>
          </div>
        </div>
      </Modal>
    </li>
  );
}

export function TodoList() {
  const todos = useTodos();
  const todayKey = useTodayKey();

  // Tasks are daily. Incomplete tasks can remain visible until finished,
  // but completed tasks belong only to the day they were completed.
  const completedToday = todos.filter(
    (t) => t.done && localDayKey(t.completedAt ?? 0) === todayKey
  );
  const pending = todos.filter((t) => !t.done);
  const done = completedToday;
  const visibleTodayCount = pending.length + completedToday.length;

  const [text, setText] = useState("");
  const [icon, setIcon] = useState(defaultIcon());
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    getShowCompletedTodos().then(setShowCompleted);
  }, []);

  function toggleShowCompleted() {
    setShowCompleted((prev) => {
      const next = !prev;
      setShowCompletedTodos(next);
      return next;
    });
  }

  const doneCount = completedToday.length;
  const taskStreakCount = taskStreak(todos, todayKey);
  const SelectedIcon = getIcon(icon);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    await createTodo({ text: trimmed, icon });
    setText("");
    setIcon(defaultIcon());
    setPickerOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 bg-bg px-4 pb-2 pt-safe-top">
        <div className="flex items-end justify-between pt-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Tasks</h1>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {pending.length === 0 ? "All done" : `${pending.length} task${pending.length === 1 ? "" : "s"} left`}
            </p>
          </div>
          {doneCount > 0 && (
            <button
              onClick={() => clearCompletedTodos()}
              className="pb-1 text-xs font-semibold text-muted hover:text-red-500 active:scale-95 transition-transform"
            >
              Clear completed
            </button>
          )}
        </div>

        {todos.length > 0 && (
          <CompletionCard
            done={doneCount}
            total={visibleTodayCount}
            streak={taskStreakCount}
          />
        )}

        <form
          onSubmit={handleAdd}
          className="task-composer mt-3 flex items-center gap-2 rounded-2xl border px-3 py-1.5"
          style={{ backgroundColor: "rgb(var(--color-surface))", borderColor: "rgb(var(--color-border) / 0.6)" }}
        >
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Choose an icon"
            className="tap-target flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
          >
            <SelectedIcon size={15} strokeWidth={2} style={{ color: TODO_ACCENT }} />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a task"
            maxLength={80}
            className="tap-target min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Add"
            className="tap-target flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-0"
            style={{ backgroundColor: TODO_ACCENT }}
          >
            <Plus size={15} strokeWidth={2.5} className="text-white" />
          </button>
        </form>

        {pickerOpen && (
          <div className="mt-2 grid grid-cols-7 gap-2 rounded-2xl bg-surface-2/70 p-2.5 animate-pop sm:grid-cols-9">
            {ICON_KEYS.map((key) => {
              const Ic = getIcon(key);
              const selected = key === icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setIcon(key);
                    setPickerOpen(false);
                  }}
                  className="tap-target mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-transform active:scale-90"
                  style={selected ? { backgroundColor: TODO_ACCENT_SOFT, color: TODO_ACCENT } : undefined}
                >
                  <Ic size={20} strokeWidth={2} className={selected ? "" : "text-muted"} />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label="Close icon picker"
              className="tap-target mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted"
            >
              <X size={20} />
            </button>
          </div>
        )}
      </header>

      <main className="scroll-area flex-1 px-4 py-2">
        {visibleTodayCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div
              className="mb-1 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgb(var(--color-brand) / 0.14)" }}
            >
              <ListChecks size={20} style={{ color: TODO_ACCENT }} />
            </div>
            <p className="font-display text-lg font-semibold text-ink">Nothing to do</p>
            <p className="max-w-[16rem] text-sm text-muted">
              Add a one-off task above — for anything that isn't a recurring habit.
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {pending.map((todo) => (
                <TodoRow key={todo.id} todo={todo} todayKey={todayKey} />
              ))}
            </ul>

            {done.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={toggleShowCompleted}
                  aria-expanded={showCompleted}
                  className="tap-target -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 px-1 py-2 text-[12.5px] font-semibold text-muted hover:text-ink active:scale-95 transition-transform"
                >
                  <ChevronDown
                    size={13}
                    className={["transition-transform duration-150", showCompleted ? "" : "-rotate-90"].join(" ")}
                  />
                  Completed ({done.length})
                </button>
                {showCompleted && (
                  <ul className="flex flex-col gap-2 opacity-65">
                    {done.map((todo) => (
                      <TodoRow key={todo.id} todo={todo} todayKey={todayKey} />
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="pb-8" />
          </>
        )}
      </main>
    </div>
  );
}

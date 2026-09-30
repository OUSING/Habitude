import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, PanelRight, Plus, Repeat2, Trash2, X } from "lucide-react";
import { useEvents } from "../hooks/useEvents";
import { useAllTodos, useSubTodos } from "../hooks/useTodos";
import { createEvent, deleteEvent, updateEvent } from "../services/eventService";
import { createSubTodo, createTodo, deleteTodo, toggleTodo, updateTodo } from "../services/todoService";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { playCheckSound, playUncheckSound } from "../utils/sound";
import { getShowCalendarAgenda, setShowCalendarAgenda } from "../services/settings";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { addDays, formatFullDate, todayStr, weekdayOf } from "../utils/date";
import {
  addMonths,
  formatTime12,
  itemsForDate,
  layoutTimed,
  minToTime,
  monthGrid,
  timeToMin,
  weekDates,
  type CalItem,
  type CalendarViewMode
} from "../utils/calendar";
import type { CalEvent } from "../types/event";
import type { Todo } from "../types/todo";

const TASK_COLOR = "rgb(var(--color-brand))";
const EVENT_COLORS = ["#3B82F6", "#22C55E", "#EF4444", "#F97316", "#EAB308", "#8B5CF6", "#A3B18A", "#9CA3AF"];
const HOUR_H = 48;
const GUTTER = 44;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Soft tinted fill for chips/blocks. Events use a hex color (append alpha);
 *  tasks use the theme's brand color variable. */
function tint(item: CalItem, strength: "soft" | "strong" = "soft"): string {
  if (item.color.startsWith("#")) return `${item.color}${strength === "soft" ? "26" : "3D"}`;
  return `rgb(var(--color-brand) / ${strength === "soft" ? 0.14 : 0.22})`;
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useIsWide(): boolean {
  const query = "(min-width: 768px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

function parts(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return { d, day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
}

function headerTitle(view: CalendarViewMode, cursor: string): string {
  const { d } = parts(cursor);
  if (view === "month") return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (view === "day") return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const week = weekDates(cursor);
  const a = new Date(`${week[0]}T00:00:00`);
  const b = new Date(`${week[6]}T00:00:00`);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const right = b.toLocaleDateString("en-US", sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${left} – ${right}, ${b.getFullYear()}`;
}

/* ------------------------------ Editor ------------------------------ */

type EditorState =
  | { kind: "new"; date: string; startTime?: string; endTime?: string }
  | { kind: "event"; event: CalEvent }
  | { kind: "task"; todo: Todo; date: string };

const fieldClass = "w-full rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] text-ink outline-none";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </label>
  );
}

function ColorRow({ value, onChange, allowDefault }: { value: string; onChange: (c: string) => void; allowDefault?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-muted">Color</span>
      <div className="flex flex-wrap justify-end gap-2">
        {allowDefault && (
          <button
            type="button"
            aria-label="Theme color"
            aria-pressed={value === ""}
            onClick={() => onChange("")}
            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ backgroundColor: "rgb(var(--color-brand))", outline: value === "" ? "2px solid rgb(var(--color-brand))" : "none", outlineOffset: 2 }}
          >
            {value === "" && <Check size={12} strokeWidth={3.5} color="#fff" />}
          </button>
        )}
        {EVENT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ backgroundColor: c, outline: value === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
          >
            {value === c && <Check size={12} strokeWidth={3.5} color="#fff" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Subtasks inside the task editor. For an existing task it edits the real
 *  subtasks live (rename, tick, delete, add). For a task that hasn't been
 *  saved yet it collects names in `drafts`, which the editor turns into
 *  subtasks once the task exists. */
function SubtasksSection({
  parentId,
  drafts,
  setDrafts,
  input,
  setInput
}: {
  parentId?: number;
  drafts: string[];
  setDrafts: (d: string[]) => void;
  input: string;
  setInput: (v: string) => void;
}) {
  const confirm = useConfirm();
  const subs = useSubTodos(parentId);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  async function addFromInput() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (parentId != null) await createSubTodo(parentId, text);
    else setDrafts([...drafts, text]);
  }

  async function commitEdit(sub: Todo) {
    const next = editText.trim();
    setEditingId(null);
    if (next && next !== sub.text && sub.id != null) await updateTodo(sub.id, { text: next });
  }

  async function removeSub(sub: Todo) {
    if (sub.id == null) return;
    const ok = await confirm({
      title: "Delete Subtask",
      message: `Delete "${sub.text}"?\n\nThis can't be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });
    if (ok) await deleteTodo(sub.id);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted">Subtasks</span>
      <ul className="flex flex-col gap-1">
        {parentId != null &&
          subs.map((sub) => (
            <li key={sub.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5">
              <button
                type="button"
                aria-label={sub.done ? "Mark subtask not done" : "Mark subtask done"}
                aria-pressed={sub.done}
                onClick={() => sub.id != null && void toggleTodo(sub.id)}
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 !min-h-0 !min-w-0"
                style={{ borderColor: TASK_COLOR, backgroundColor: sub.done ? TASK_COLOR : "transparent" }}
              >
                {sub.done && <Check size={10} strokeWidth={4} color="#fff" />}
              </button>
              {editingId === sub.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => void commitEdit(sub)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitEdit(sub);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingId(null);
                    }
                  }}
                  maxLength={200}
                  aria-label="Edit subtask"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditText(sub.text);
                    setEditingId(sub.id ?? null);
                  }}
                  className={["min-w-0 flex-1 truncate text-left text-[13px]", sub.done ? "text-muted line-through" : "text-ink"].join(" ")}
                >
                  {sub.text}
                </button>
              )}
              <button type="button" aria-label="Delete subtask" onClick={() => void removeSub(sub)} className="shrink-0 text-muted active:text-ink !min-h-0 !min-w-0">
                <X size={14} />
              </button>
            </li>
          ))}
        {parentId == null &&
          drafts.map((text, i) => (
            <li key={`${text}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5">
              <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2" style={{ borderColor: TASK_COLOR }} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{text}</span>
              <button
                type="button"
                aria-label="Remove subtask"
                onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                className="shrink-0 text-muted active:text-ink !min-h-0 !min-w-0"
              >
                <X size={14} />
              </button>
            </li>
          ))}
      </ul>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2 py-1.5">
        <Plus size={14} className="shrink-0 text-muted" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addFromInput();
            }
          }}
          onBlur={() => void addFromInput()}
          placeholder="Add subtask"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted/70"
        />
      </div>
    </div>
  );
}

function ItemEditor({ state, onClose }: { state: EditorState | null; onClose: () => void }) {
  const confirm = useConfirm();
  const [mode, setMode] = useState<"event" | "task">("event");
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [taskTime, setTaskTime] = useState("");
  const [taskEndTime, setTaskEndTime] = useState("");
  const [taskColor, setTaskColor] = useState("");
  const [subDrafts, setSubDrafts] = useState<string[]>([]);
  const [subInput, setSubInput] = useState("");
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [note, setNote] = useState("");

  // Reset the form whenever the sheet is opened for a different target.
  useEffect(() => {
    if (!state) return;
    setSubDrafts([]);
    setSubInput("");
    if (state.kind === "new") {
      const start = state.startTime ?? "09:00";
      setMode("event");
      setTitle("");
      setAllDay(state.startTime == null && false);
      setDate(state.date);
      setEndDate("");
      setStartTime(start);
      setEndTime(state.endTime ?? minToTime((timeToMin(start) ?? 540) + 60));
      setTaskTime(state.startTime ?? "");
      setTaskEndTime(state.startTime ? (state.endTime ?? "") : "");
      setTaskColor("");
      setColor(EVENT_COLORS[0]);
      setNote("");
    } else if (state.kind === "event") {
      const e = state.event;
      setMode("event");
      setTitle(e.title);
      setAllDay(e.allDay);
      setDate(e.date);
      setEndDate(e.endDate ?? "");
      setStartTime(e.startTime ?? "09:00");
      setEndTime(e.endTime ?? "10:00");
      setColor(e.color);
      setNote(e.note ?? "");
    } else {
      setMode("task");
      setTitle(state.todo.text);
      setDate(state.todo.dueDate ?? state.date);
      setTaskTime(state.todo.dueTime ?? "");
      setTaskEndTime(state.todo.dueTime ? (state.todo.dueEndTime ?? "") : "");
      setTaskColor(state.todo.color ?? "");
    }
  }, [state]);

  if (!state) return null;
  const editing = state.kind !== "new";
  const canSave = title.trim().length > 0 && date.length > 0;

  async function save() {
    if (!state || !canSave) return;
    if (mode === "task") {
      // An end time only means something after a start time.
      const endOk = taskTime && taskEndTime && (timeToMin(taskEndTime) ?? 0) > (timeToMin(taskTime) ?? 0);
      const times = { dueTime: taskTime || undefined, dueEndTime: endOk ? taskEndTime : undefined, color: taskColor || undefined };
      if (state.kind === "task" && state.todo.id != null && inheritsSchedule) {
        await updateTodo(state.todo.id, { text: title.trim() });
      } else if (state.kind === "task" && state.todo.id != null) {
        await updateTodo(state.todo.id, { text: title.trim(), dueDate: date, ...times });
      } else {
        const created = await createTodo({ text: title.trim(), icon: "check", dueDate: date, ...times });
        // Subtasks typed before the task existed (plus one still in the box).
        const pending = [...subDrafts, subInput.trim()].filter(Boolean);
        for (const text of pending) if (created.id != null) await createSubTodo(created.id, text);
      }
    } else {
      let end = endTime;
      if (!allDay && (timeToMin(end) ?? 0) <= (timeToMin(startTime) ?? 0)) {
        end = minToTime(Math.min((timeToMin(startTime) ?? 0) + 60, 23 * 60 + 59));
      }
      const payload = {
        title: title.trim(),
        date,
        endDate: allDay && endDate && endDate > date ? endDate : undefined,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : end,
        color,
        note: note.trim() || undefined
      };
      if (state.kind === "event" && state.event.id != null) await updateEvent(state.event.id, payload);
      else await createEvent(payload);
    }
    onClose();
  }

  async function remove() {
    if (!state || state.kind === "new") return;
    const label = state.kind === "event" ? state.event.title : state.todo.text;
    const ok = await confirm({
      title: state.kind === "event" ? "Delete Event" : "Delete Task",
      message: `Delete "${label}"?\n\nThis can't be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });
    if (!ok) return;
    if (state.kind === "event" && state.event.id != null) await deleteEvent(state.event.id);
    if (state.kind === "task" && state.todo.id != null) await deleteTodo(state.todo.id);
    onClose();
  }

  // A subtask with no schedule of its own follows its parent, so only its
  // title is editable here (setting a date would detach it from the parent).
  const inheritsSchedule = state.kind === "task" && state.todo.parentId != null && !state.todo.dueDate;
  // Subtasks can be managed from any main task (or a new one), not from a subtask.
  const canHaveSubtasks = state.kind === "new" || (state.kind === "task" && state.todo.parentId == null);
  const isRecurringTask = state.kind === "task" && state.todo.frequency && state.todo.frequency !== "once";

  return (
    <Modal open onClose={onClose} title={editing ? "Edit" : "New"}>
      <div className="flex flex-col gap-4 px-5 pb-4 pt-3">
        {!editing && (
          <div className="flex rounded-xl bg-surface-2 p-1" role="tablist">
            {(["event", "task"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={[
                  "tap-target flex-1 rounded-lg py-1.5 text-[13px] font-semibold capitalize transition-colors",
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-muted"
                ].join(" ")}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <input
          autoFocus={!editing}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mode === "event" ? "Event title" : "Task"}
          className="w-full border-b border-border bg-transparent pb-2 font-display text-[20px] font-semibold text-ink outline-none placeholder:text-muted/60"
        />

        {mode === "event" ? (
          <>
            <Row label="All day">
              <button
                type="button"
                role="switch"
                aria-checked={allDay}
                onClick={() => setAllDay((v) => !v)}
                className={["relative h-6 w-11 rounded-full transition-colors", allDay ? "bg-brand" : "bg-border"].join(" ")}
              >
                <span className={["absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", allDay ? "left-[22px]" : "left-0.5"].join(" ")} />
              </button>
            </Row>
            <Row label={allDay ? "Starts" : "Date"}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: "light" }} className={fieldClass} />
            </Row>
            {allDay ? (
              <Row label="Ends">
                <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} style={{ colorScheme: "light" }} className={fieldClass} />
              </Row>
            ) : (
              <>
                <Row label="Start">
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ colorScheme: "light" }} className={fieldClass} />
                </Row>
                <Row label="End">
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ colorScheme: "light" }} className={fieldClass} />
                </Row>
              </>
            )}
            <ColorRow value={color} onChange={setColor} />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes"
              rows={3}
              className={`${fieldClass} resize-none`}
            />
          </>
        ) : (
          <>
            {inheritsSchedule ? (
              <p className="text-[12px] leading-snug text-muted">
                This subtask follows its main task's schedule. Change the date, time or repeat on the main task.
              </p>
            ) : (
              <>
            <Row label="Due date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: "light" }} className={fieldClass} />
            </Row>
            <Row label="Start">
              <input
                type="time"
                value={taskTime}
                onChange={(e) => {
                  const v = e.target.value;
                  setTaskTime(v);
                  // Give a fresh start time a sensible one-hour end, unless the user already set one.
                  if (v && !taskEndTime) setTaskEndTime(minToTime((timeToMin(v) ?? 0) + 60));
                  if (!v) setTaskEndTime("");
                }}
                style={{ colorScheme: "light" }}
                className={fieldClass}
              />
            </Row>
            <Row label="End">
              <input
                type="time"
                value={taskEndTime}
                min={taskTime || undefined}
                disabled={!taskTime}
                onChange={(e) => setTaskEndTime(e.target.value)}
                style={{ colorScheme: "light" }}
                className={`${fieldClass} disabled:opacity-40`}
              />
            </Row>
            <ColorRow value={taskColor} onChange={setTaskColor} allowDefault />
            {canHaveSubtasks && (
              <SubtasksSection
                parentId={state.kind === "task" ? state.todo.id : undefined}
                drafts={subDrafts}
                setDrafts={setSubDrafts}
                input={subInput}
                setInput={setSubInput}
              />
            )}
            {taskTime && (
              <button
                type="button"
                onClick={() => {
                  setTaskTime("");
                  setTaskEndTime("");
                }}
                className="self-end text-[12px] font-medium text-muted underline"
              >
                Clear times (all-day)
              </button>
            )}
              </>
            )}
            {isRecurringTask && (
              <p className="text-[12px] leading-snug text-muted">
                This task repeats. Changing the date moves where the repeat starts; edit the repeat rule itself from the To-Do tab.
              </p>
            )}
          </>
        )}

        <div className="flex gap-2 pt-1">
          {editing && (
            <Button variant="danger" onClick={remove} aria-label="Delete">
              <Trash2 size={17} />
            </Button>
          )}
          <Button fullWidth onClick={save} disabled={!canSave}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Month view ------------------------------ */

/** Toggle a task from anywhere on the calendar. */
async function toggleFromCalendar(item: CalItem) {
  const id = item.todo?.id;
  if (id == null) return;
  const next = await toggleTodo(id);
  if (next) playCheckSound();
  else playUncheckSound();
}

/** Small round checkbox for task items — same ring style as the To-Do tab. */
function CheckDot({ item, size = 14 }: { item: CalItem; size?: number }) {
  return (
    <button
      type="button"
      aria-label={item.done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
      aria-pressed={!!item.done}
      onClick={(e) => {
        e.stopPropagation();
        void toggleFromCalendar(item);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex shrink-0 items-center justify-center rounded-full border-2 transition-transform active:scale-90 !min-h-0 !min-w-0"
      style={{ width: size, height: size, borderColor: item.color, backgroundColor: item.done ? item.color : "transparent" }}
    >
      {item.done && <Check size={size - 6} strokeWidth={4} color="#fff" />}
    </button>
  );
}

function Chip({ item, onOpen }: { item: CalItem; onOpen: (i: CalItem) => void }) {
  const isTask = item.kind === "task" && item.todo?.id != null;
  return (
    <div
      className="flex w-full items-center gap-0.5 rounded-[4px] px-0.5 py-px"
      style={{ backgroundColor: tint(item, "strong"), borderLeft: `2px solid ${item.color}` }}
    >
      {isTask && <CheckDot item={item} size={11} />}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen(item);
        }}
        className={[
          "min-w-0 flex-1 truncate text-left text-[10px] font-medium leading-[14px] text-ink",
          item.done ? "line-through opacity-50" : ""
        ].join(" ")}
        title={item.title}
      >
        {item.isSub ? "↳ " : ""}{item.title}
      </button>
    </div>
  );
}

function MonthView({
  cursor,
  selected,
  itemsByDate,
  onSelect,
  onOpenItem
}: {
  cursor: string;
  selected: string;
  itemsByDate: (d: string) => CalItem[];
  onSelect: (d: string) => void;
  onOpenItem: (i: CalItem) => void;
}) {
  const wide = useIsWide();
  const today = todayStr();
  const weeks = useMemo(() => monthGrid(cursor), [cursor]);
  const curMonth = parts(cursor).month;
  const maxChips = wide ? 4 : 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1.5 text-center text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            {w}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 md:grid-rows-6" style={wide ? undefined : { gridAutoRows: 72 }}>
        {weeks.flat().map((d) => {
          const p = parts(d);
          const items = itemsByDate(d);
          const isToday = d === today;
          const isSel = d === selected;
          const inMonth = p.month === curMonth;
          const shown = items.slice(0, maxChips);
          const extra = items.length - shown.length;
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              aria-label={formatFullDate(d)}
              aria-pressed={isSel}
              onClick={() => onSelect(d)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(d)}
              className={[
                "flex min-h-0 min-w-0 cursor-pointer flex-col gap-px overflow-hidden border-b border-r border-border/60 p-0.5 transition-colors",
                isSel ? "bg-brand/10" : "active:bg-surface-2"
              ].join(" ")}
            >
              <span
                className={[
                  "mx-auto mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  isToday ? "bg-brand text-white" : inMonth ? "text-ink" : "text-muted/50"
                ].join(" ")}
              >
                {p.day}
              </span>
              {shown.map((it) => (
                <Chip key={it.key} item={it} onOpen={onOpenItem} />
              ))}
              {extra > 0 && <span className="px-1 text-[9.5px] font-medium leading-[12px] text-muted">+{extra} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Agenda (selected day) ------------------------------ */

function Agenda({
  date,
  items,
  onOpenItem,
  onAdd,
  onClose,
  boxed
}: {
  date: string;
  items: CalItem[];
  onOpenItem: (i: CalItem) => void;
  onAdd: () => void;
  onClose: () => void;
  /** Week/Day on a phone: the panel sits under the time grid, so cap its height and scroll inside it. */
  boxed?: boolean;
}) {
  return (
    <section
      className={[
        "flex flex-col border-t border-border bg-surface md:min-h-0 md:w-72 md:shrink-0 md:border-l md:border-t-0",
        boxed ? "max-h-[36%] min-h-[120px] shrink-0 md:max-h-none md:min-h-0" : ""
      ].join(" ")}
      aria-label="Selected day"
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
        <h2 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">{formatFullDate(date)}</h2>
        <button onClick={onAdd} className="tap-target flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-brand active:bg-surface-2">
          <Plus size={14} strokeWidth={2.6} /> Add
        </button>
        <button
          onClick={onClose}
          aria-label="Hide day panel"
          title="Hide day panel"
          className="tap-target ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-2"
        >
          <X size={15} />
        </button>
      </div>
      <div className={["scroll-area px-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:pb-4", boxed ? "min-h-0 flex-1 overflow-y-auto pb-16" : "pb-20"].join(" ")}>
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-muted">Nothing planned.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((it) => (
              <li key={it.key}>
                <div
                  className={["flex items-center gap-2.5 rounded-xl py-2 pr-3", it.isSub ? "ml-5 pl-2.5" : "pl-3"].join(" ")}
                  style={{ backgroundColor: tint(it), borderLeft: `3px solid ${it.color}` }}
                >
                  {it.kind === "task" && it.todo?.id != null && <CheckDot item={it} size={20} />}
                  <button onClick={() => onOpenItem(it)} className="min-w-0 flex-1 text-left">
                    <p className={["truncate text-[13.5px] font-medium text-ink", it.done ? "line-through opacity-50" : ""].join(" ")}>
                      {it.title}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted">
                      {it.allDay ? "All day" : `${formatTime12(minToTime(it.startMin!))} – ${formatTime12(minToTime(it.endMin ?? it.startMin! + 30))}`}
                      {it.recurring && <Repeat2 size={11} aria-label="Repeats" />}
                      {it.kind === "task" && <span>· {it.isSub && it.parentTitle ? `Subtask of ${it.parentTitle}` : "Task"}</span>}
                    </p>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ Week / Day time grid ------------------------------ */

function TimeGrid({
  days,
  itemsByDate,
  selected,
  onSelect,
  onOpenItem,
  onCreateRange
}: {
  days: string[];
  itemsByDate: (d: string) => CalItem[];
  selected: string;
  onSelect: (d: string) => void;
  onOpenItem: (i: CalItem) => void;
  onCreateRange: (date: string, startTime: string, endTime: string) => void;
}) {
  const now = useNow();
  const today = todayStr();
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cols = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`;
  const perDay = days.map((d) => itemsByDate(d));
  const hasAllDay = perDay.some((list) => list.some((i) => i.allDay));
  const firstDay = days[0];

  const SNAP = 15;
  const [sel, setSel] = useState<{ date: string; start: number; end: number } | null>(null);
  const drag = useRef<{
    date: string;
    anchor: number;
    col: HTMLElement;
    pointerId: number;
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    timer?: number;
  } | null>(null);

  function minAt(clientY: number, col: HTMLElement): number {
    const rect = col.getBoundingClientRect();
    const raw = ((clientY - rect.top) / HOUR_H) * 60;
    return Math.max(0, Math.min(24 * 60 - SNAP, Math.floor(raw / SNAP) * SNAP));
  }

  function endDrag() {
    const d = drag.current;
    if (d?.timer) window.clearTimeout(d.timer);
    drag.current = null;
    setSel(null);
  }

  function onColPointerDown(e: React.PointerEvent<HTMLDivElement>, date: string) {
    if ((e.target as HTMLElement).closest("button, [data-cal-item]")) return; // let existing items handle their own taps
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const col = e.currentTarget;
    const anchor = minAt(e.clientY, col);
    const state = {
      date, anchor, col, pointerId: e.pointerId, active: false, moved: false,
      startX: e.clientX, startY: e.clientY, timer: undefined as number | undefined
    };
    drag.current = state;

    const begin = () => {
      if (drag.current !== state) return;
      state.active = true;
      try { col.setPointerCapture(state.pointerId); } catch { /* pointer already gone */ }
      setSel({ date, start: anchor, end: anchor + SNAP });
    };

    if (e.pointerType === "touch") {
      // On touch, a quick swipe must still scroll the grid — so selection
      // only starts after a short press-and-hold.
      state.timer = window.setTimeout(() => {
        begin();
        navigator.vibrate?.(8);
      }, 300);
    } else {
      begin();
    }
  }

  function onColPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
      d.moved = true;
      // Finger moved before the hold finished: the user is scrolling.
      if (!d.active) {
        endDrag();
        return;
      }
    }
    if (!d.active) return;
    const cur = minAt(e.clientY, d.col);
    setSel({ date: d.date, start: Math.min(d.anchor, cur), end: Math.max(d.anchor, cur) + SNAP });
  }

  function onColPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const wasActive = d.active;
    const cur = minAt(e.clientY, d.col);
    const date = d.date;
    const anchor = d.anchor;
    const moved = d.moved;
    endDrag();
    if (wasActive && moved) {
      const start = Math.min(anchor, cur);
      const end = Math.max(anchor, cur) + SNAP;
      onCreateRange(date, minToTime(start), minToTime(Math.min(end, 24 * 60 - 1)));
    } else if (wasActive || !moved) {
      // A plain click/tap: default to a one-hour slot like before.
      const start = Math.floor(anchor / 30) * 30;
      onCreateRange(date, minToTime(start), minToTime(Math.min(start + 60, 24 * 60 - 1)));
    }
  }

  // Once a touch selection is active, stop the page from scrolling under the finger.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const block = (ev: TouchEvent) => {
      if (drag.current?.active && ev.cancelable) ev.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  useEffect(() => () => {
    if (drag.current?.timer) window.clearTimeout(drag.current.timer);
  }, []);

  // Land on something useful: an hour before now if today is visible, else 7am.
  useEffect(() => {
    if (!scrollRef.current) return;
    const focusMin = days.includes(todayStr()) ? Math.max(0, nowMin - 60) : 7 * 60;
    scrollRef.current.scrollTop = (focusMin / 60) * HOUR_H;
    // Only when the visible range changes, not every minute tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDay, days.length]);

  return (
    <div ref={scrollRef} className="scroll-area min-h-0 flex-1 overflow-y-auto">
      {/* Sticky header: day names + all-day strip */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const p = parts(d);
            const isToday = d === today;
            return (
              <button key={d} onClick={() => onSelect(d)} className="flex flex-col items-center py-1.5" aria-label={formatFullDate(d)}>
                <span className={["text-[10px] font-semibold uppercase tracking-wide", isToday ? "text-brand" : "text-muted"].join(" ")}>
                  {WEEKDAY_LABELS[weekdayOf(d)]}
                </span>
                <span
                  className={[
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold",
                    isToday ? "bg-brand text-white" : d === selected && days.length > 1 ? "bg-brand/15 text-ink" : "text-ink"
                  ].join(" ")}
                >
                  {p.day}
                </span>
              </button>
            );
          })}
        </div>
        {hasAllDay && (
          <div className="grid border-t border-border/60" style={{ gridTemplateColumns: cols }}>
            <div className="flex items-start justify-end pr-1 pt-1 text-[9px] text-muted">all-day</div>
            {perDay.map((list, i) => (
              <div key={days[i]} className="flex min-w-0 flex-col gap-px border-l border-border/40 p-0.5">
                {list.filter((it) => it.allDay).map((it) => (
                  <Chip key={it.key} item={it} onOpen={onOpenItem} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hour grid */}
      <div className="relative grid" style={{ gridTemplateColumns: cols, height: HOUR_H * 24 }}>
        <div className="relative">
          {Array.from({ length: 24 }, (_, h) => (
            <span
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[9.5px] text-muted"
              style={{ top: h * HOUR_H, display: h === 0 ? "none" : undefined }}
            >
              {formatTime12(`${String(h).padStart(2, "0")}:00`)}
            </span>
          ))}
        </div>
        {days.map((d, i) => {
          const positioned = layoutTimed(perDay[i]);
          return (
            <div
              key={d}
              className="relative select-none border-l border-border/50"
              style={{
                touchAction: "pan-y",
                WebkitTouchCallout: "none",
                cursor: "crosshair",
                backgroundImage: "linear-gradient(to bottom, rgb(var(--color-border) / 0.6) 1px, transparent 1px)",
                backgroundSize: `100% ${HOUR_H}px`
              }}
              onPointerDown={(e) => onColPointerDown(e, d)}
              onPointerMove={onColPointerMove}
              onPointerUp={onColPointerUp}
              onPointerCancel={endDrag}
            >
              {positioned.map(({ item, lane, lanes }) => {
                const start = item.startMin!;
                const end = item.endMin ?? start + 30;
                const height = Math.max(20, ((end - start) / 60) * HOUR_H - 2);
                return (
                  <div
                    key={item.key}
                    data-cal-item
                    className="absolute flex items-start gap-1 overflow-hidden rounded-md px-1 py-0.5 text-ink"
                    style={{
                      top: (start / 60) * HOUR_H + 1,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 1px)`,
                      width: `calc(${100 / lanes}% - 2px)`,
                      backgroundColor: tint(item, "strong"),
                      borderLeft: `3px solid ${item.color}`
                    }}
                  >
                    {item.kind === "task" && item.todo?.id != null && (
                      <span className="mt-px">
                        <CheckDot item={item} size={13} />
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenItem(item);
                      }}
                      className={[
                        "min-w-0 flex-1 text-left text-[10.5px] font-medium leading-tight",
                        item.done ? "line-through opacity-50" : ""
                      ].join(" ")}
                    >
                      <span className="block truncate">{item.isSub ? "↳ " : ""}{item.title}</span>
                      {height > 32 && (
                        <span className="block truncate text-[9.5px] font-normal text-muted">
                          {formatTime12(minToTime(start))} – {formatTime12(minToTime(end))}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
              {sel && sel.date === d && (
                <div
                  className="pointer-events-none absolute left-0.5 right-0.5 z-[4] overflow-hidden rounded-md border-2 border-brand bg-brand/20 px-1 py-0.5 text-[10.5px] font-semibold leading-tight text-ink"
                  style={{ top: (sel.start / 60) * HOUR_H, height: Math.max(14, ((sel.end - sel.start) / 60) * HOUR_H) }}
                >
                  {formatTime12(minToTime(sel.start))} – {formatTime12(minToTime(Math.min(sel.end, 24 * 60 - 1)))}
                </div>
              )}
              {d === today && (
                <div className="pointer-events-none absolute left-0 right-0 z-[5] flex items-center" style={{ top: (nowMin / 60) * HOUR_H }}>
                  <span className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
                  <span className="h-px flex-1 bg-red-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Screen ------------------------------ */

export function CalendarView() {
  const events = useEvents();
  const todos = useAllTodos();
  const [view, setView] = useState<CalendarViewMode>("month");
  const [cursor, setCursor] = useState(todayStr());
  const [selected, setSelected] = useState(todayStr());
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showAgenda, setShowAgenda] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);

  // Remember whether the day panel was hidden.
  useEffect(() => {
    void getShowCalendarAgenda().then(setShowAgenda);
  }, []);

  function toggleAgenda() {
    const next = !showAgenda;
    setShowAgenda(next);
    void setShowCalendarAgenda(next);
  }

  const opts = useMemo(() => ({ showEvents, showTasks, taskColor: TASK_COLOR }), [showEvents, showTasks]);
  const itemsByDate = useMemo(() => {
    const cache = new Map<string, CalItem[]>();
    return (d: string) => {
      let v = cache.get(d);
      if (!v) {
        v = itemsForDate(d, events, todos, opts);
        cache.set(d, v);
      }
      return v;
    };
  }, [events, todos, opts]);

  function step(dir: 1 | -1) {
    if (view === "month") {
      const next = addMonths(cursor, dir);
      setCursor(next);
      setSelected(next);
    } else {
      const next = addDays(cursor, dir * (view === "week" ? 7 : 1));
      setCursor(next);
      setSelected(next);
    }
  }

  function goToday() {
    const t = todayStr();
    setCursor(t);
    setSelected(t);
  }

  function selectDate(d: string) {
    setSelected(d);
    // Tapping a day outside the shown month (grey dates) moves to that month.
    if (view === "month" && parts(d).month !== parts(cursor).month) setCursor(d);
    if (view === "week") setCursor(d);
  }

  function openItem(it: CalItem) {
    if (it.event) setEditor({ kind: "event", event: it.event });
    else if (it.todo) setEditor({ kind: "task", todo: it.todo, date: it.date });
  }

  const days = view === "week" ? weekDates(cursor) : [cursor];
  const selectedItems = itemsByDate(selected);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <header className="shrink-0 border-b border-border bg-surface px-3 pb-2 pt-safe-top">
        <div className="flex items-center justify-between gap-2 pt-3">
          <div className="flex min-w-0 items-center gap-1">
            <button onClick={() => step(-1)} aria-label="Previous" className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-surface-2">
              <ChevronLeft size={19} />
            </button>
            <button onClick={() => step(1)} aria-label="Next" className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-surface-2">
              <ChevronRight size={19} />
            </button>
            <h1 className="ml-1 truncate font-display text-[19px] font-semibold text-ink">{headerTitle(view, cursor)}</h1>
          </div>
          <button
            onClick={goToday}
            className="tap-target flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12px] font-semibold text-ink active:bg-surface-2"
          >
            <CalendarDays size={13} /> Today
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex rounded-xl bg-surface-2 p-0.5" role="tablist" aria-label="Calendar view">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  setView(v);
                  setCursor(selected);
                }}
                className={[
                  "tap-target rounded-[10px] px-3 py-1 text-[12px] font-semibold capitalize transition-colors",
                  view === v ? "bg-surface text-ink shadow-sm" : "text-muted"
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { label: "Events", on: showEvents, toggle: () => setShowEvents((v) => !v) },
              { label: "Tasks", on: showTasks, toggle: () => setShowTasks((v) => !v) }
            ].map(({ label, on, toggle }) => (
              <button
                key={label}
                onClick={toggle}
                aria-pressed={on}
                className={[
                  "tap-target rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  on ? "border-brand/40 bg-brand/10 text-ink" : "border-border text-muted"
                ].join(" ")}
              >
                {label}
              </button>
            ))}
            <button
              onClick={toggleAgenda}
              aria-pressed={showAgenda}
              aria-label={showAgenda ? "Hide day panel" : "Show day panel"}
              title={showAgenda ? "Hide day panel" : "Show day panel"}
              className={[
                "tap-target flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                showAgenda ? "border-brand/40 bg-brand/10 text-ink" : "border-border text-muted"
              ].join(" ")}
            >
              <PanelRight size={14} />
            </button>
          </div>
        </div>
      </header>

      <div
        className={[
          "flex min-h-0 flex-1 flex-col md:flex-row md:overflow-hidden",
          view === "month" ? "scroll-area overflow-y-auto" : "overflow-hidden"
        ].join(" ")}
      >
        <div className={["flex min-w-0 flex-col md:min-h-0 md:flex-1", view === "month" ? "shrink-0" : "min-h-0 flex-1"].join(" ")}>
          {view === "month" ? (
            <MonthView cursor={cursor} selected={selected} itemsByDate={itemsByDate} onSelect={selectDate} onOpenItem={openItem} />
          ) : (
            <TimeGrid
              days={days}
              itemsByDate={itemsByDate}
              selected={selected}
              onSelect={(d) => {
                setSelected(d);
                if (view === "week") setCursor(d);
              }}
              onOpenItem={openItem}
              onCreateRange={(date, startTime, endTime) => setEditor({ kind: "new", date, startTime, endTime })}
            />
          )}
        </div>
        {showAgenda && (
          <Agenda
            date={selected}
            items={selectedItems}
            onOpenItem={openItem}
            onAdd={() => setEditor({ kind: "new", date: selected })}
            onClose={toggleAgenda}
            boxed={view !== "month"}
          />
        )}
      </div>

      <button
        onClick={() => setEditor({ kind: "new", date: selected })}
        aria-label="Add event or task"
        className="tap-target absolute bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform active:scale-90 md:bottom-6 md:right-6"
      >
        <Plus size={24} strokeWidth={2.6} />
      </button>

      <ItemEditor state={editor} onClose={() => setEditor(null)} />
    </div>
  );
}

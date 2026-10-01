import type { Todo } from "../types/todo";
import type { CalEvent } from "../types/event";
import type { CustomFrequency, Weekday } from "../types/habit";
import { addDays, isHabitScheduledOn, toDateStr, weekdayOf } from "./date";

export type CalendarViewMode = "month" | "week" | "day";

/** One thing drawn on the calendar — either a real event or a to-do
 *  placed by its due date/time. */
export interface CalItem {
  key: string;
  kind: "event" | "task";
  title: string;
  date: string;
  allDay: boolean;
  /** Minutes from midnight; only for timed items. */
  startMin?: number;
  endMin?: number;
  color: string;
  done?: boolean;
  recurring?: boolean;
  /** True for a subtask; `parentTitle` names the main to-do it belongs to. */
  isSub?: boolean;
  /** A subtask that follows its parent's schedule (has no date of its own). */
  inherited?: boolean;
  parentTitle?: string;
  /** Stable ordering key so a subtask sorts right under its parent. */
  group?: number;
  event?: CalEvent;
  todo?: Todo;
}

export function timeToMin(t?: string): number | undefined {
  if (!t) return undefined;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  return h * 60 + m;
}

export function minToTime(min: number): string {
  const c = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

export function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${suffix}` : `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function localDayOf(timestamp: number): string {
  return toDateStr(new Date(timestamp));
}

/** A to-do repeats if its own schedule (or, for a subtask that follows its
 *  parent, the parent's) is anything other than "once". */
export function isRecurringTodo(source: Todo): boolean {
  return (source.frequency ?? "once") !== "once";
}

/** Is this to-do checked off *on that day*? A one-off task is simply done or
 *  not. A repeating task is done per day: it counts only on the days listed in
 *  `completedDates` (or, for tasks saved before that existed, the single day in
 *  `completedAt`), and is open again on every other day — which is what makes
 *  repeating tasks come back daily. `source` is the item whose schedule applies
 *  (the parent, for a subtask that follows it). */
export function isDoneOn(todo: Todo, dateStr: string, source: Todo = todo): boolean {
  if (!isRecurringTodo(source)) return todo.done;
  if (todo.completedDates?.includes(dateStr)) return true;
  return todo.done && todo.completedAt != null && localDayOf(todo.completedAt) === dateStr;
}

/** Does this to-do land on `dateStr`? One-off tasks use their due date;
 *  repeating ones are expanded from their due date (or, failing that, the
 *  day they were created) using the same rules habits use. */
export function todoOccursOn(todo: Todo, dateStr: string): boolean {
  const freq = todo.frequency ?? "once";
  // A one-off task with no due date still lands on the calendar: on the
  // day it was created, so nothing added to the To-Do list is invisible here.
  if (freq === "once") return (todo.dueDate ?? localDayOf(todo.createdAt)) === dateStr;

  const anchor = todo.dueDate ?? localDayOf(todo.createdAt);
  if (dateStr < anchor) return false;

  switch (freq) {
    case "daily":
      return true;
    case "weekdays": {
      const d = weekdayOf(dateStr);
      return d >= 1 && d <= 5;
    }
    case "weekly":
      return weekdayOf(dateStr) === weekdayOf(anchor);
    case "custom": {
      const c = todo.customRepeat;
      if (!c) return false;
      const rule: CustomFrequency = {
        type: "custom",
        interval: Math.max(1, c.interval || 1),
        unit: c.unit,
        weekdays: c.weekdays as Weekday[] | undefined,
        anchor
      };
      return isHabitScheduledOn(rule, dateStr);
    }
  }
  return false;
}

/** Everything on the calendar for one day, sorted: all-day first, then by time. */
export function itemsForDate(
  dateStr: string,
  events: CalEvent[],
  todos: Todo[],
  opts: { showEvents: boolean; showTasks: boolean; taskColor: string }
): CalItem[] {
  const out: CalItem[] = [];

  if (opts.showEvents) {
    for (const ev of events) {
      const last = ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date;
      if (dateStr < ev.date || dateStr > last) continue;
      const start = ev.allDay ? undefined : timeToMin(ev.startTime);
      let end = ev.allDay ? undefined : timeToMin(ev.endTime);
      if (start != null && (end == null || end <= start)) end = Math.min(start + 60, 24 * 60);
      out.push({
        key: `e${ev.id}-${dateStr}`,
        kind: "event",
        title: ev.title || "(No title)",
        date: dateStr,
        allDay: ev.allDay || start == null,
        startMin: start,
        endMin: end,
        color: ev.color,
        event: ev
      });
    }
  }

  if (opts.showTasks) {
    const byId = new Map<number, Todo>();
    for (const t of todos) if (t.id != null) byId.set(t.id, t);

    for (const t of todos) {
      const parent = t.parentId != null ? byId.get(t.parentId) : undefined;
      if (t.parentId != null && !parent) continue; // orphan subtask

      // A subtask with its own due date is placed by it; otherwise it
      // follows its parent's schedule (same days, incl. repeats).
      const ownSchedule = !parent || !!t.dueDate;
      const source = ownSchedule ? t : parent!;
      if (!todoOccursOn(source, dateStr)) continue;

      const freq = source.frequency ?? "once";
      // A subtask with no schedule of its own follows its parent exactly —
      // same day, same time — rather than falling into "all day".
      const timeSrc = ownSchedule ? t : parent!;
      const start = timeToMin(timeSrc.dueTime);
      const rawEnd = start != null ? timeToMin(timeSrc.dueEndTime) : undefined;
      const end = start == null ? undefined : rawEnd != null && rawEnd > start ? rawEnd : Math.min(start + 30, 24 * 60);
      out.push({
        key: `t${t.id}-${dateStr}`,
        kind: "task",
        title: t.text,
        date: dateStr,
        allDay: start == null,
        startMin: start,
        endMin: end,
        color: t.color ?? parent?.color ?? opts.taskColor,
        done: isDoneOn(t, dateStr, source),
        recurring: freq !== "once",
        isSub: !!parent,
        inherited: !ownSchedule,
        parentTitle: parent?.text,
        group: parent?.id ?? t.id,
        todo: t
      });
    }
  }

  return out.sort((a, b) => {
    const am = a.startMin;
    const bm = b.startMin;
    // Untimed things first, then by time (a subtask shares its parent's time, so it sorts right after it).
    if ((am == null) !== (bm == null)) return am == null ? -1 : 1;
    if ((am ?? 0) !== (bm ?? 0)) return (am ?? 0) - (bm ?? 0);
    if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
    // Tasks: keep a parent and its subtasks together, parent first.
    if (a.kind === "task" && a.group !== b.group) return (a.group ?? 0) - (b.group ?? 0);
    if (a.isSub !== b.isSub) return a.isSub ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
}

/** 6 rows x 7 cols of dates for the month containing `dateStr`, Sunday first. */
export function monthGrid(dateStr: string): string[][] {
  const d = new Date(`${dateStr}T00:00:00`);
  const first = toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = addDays(first, -weekdayOf(first));
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  }
  return weeks;
}

export function weekDates(dateStr: string): string[] {
  const start = addDays(dateStr, -weekdayOf(dateStr));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function addMonths(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toDateStr(d);
}

export interface PositionedItem {
  item: CalItem;
  lane: number;
  lanes: number;
}

/** Side-by-side lanes for overlapping timed items in one day column. */
export function layoutTimed(items: CalItem[]): PositionedItem[] {
  const timed = items
    .filter((i) => !i.allDay && i.startMin != null)
    .sort((a, b) => a.startMin! - b.startMin! || (b.endMin ?? 0) - (a.endMin ?? 0));

  const result: PositionedItem[] = [];
  let cluster: PositionedItem[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const item of timed) {
    const start = item.startMin!;
    const end = item.endMin ?? start + 30;
    if (cluster.length && start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = Math.max(clusterEnd, end);
    cluster.push({ item, lane, lanes: 1 });
  }
  flush();
  return result;
}

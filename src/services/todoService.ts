import { db } from "./db";
import type { NewTodo, Todo } from "../types/todo";
import { isDoneOn, isRecurringTodo, localDayOf } from "../utils/calendar";
import { toDateStr } from "../utils/date";

/** Top-level to-dos only — subtasks are fetched via listSubTodos/useSubTodos
 *  and rendered nested under their parent to-do. */
export async function listTodos(): Promise<Todo[]> {
  const all = await db.todos.toArray();
  return all
    .filter((t) => t.parentId == null)
    .sort((a, b) => {
      // Open items first (newest first), then done items (most recently done first).
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done && b.done) return (b.completedAt ?? 0) - (a.completedAt ?? 0);
      return b.createdAt - a.createdAt;
    });
}

/** Subtasks nested under a given main to-do. */
export async function listSubTodos(parentId: number): Promise<Todo[]> {
  const subs = await db.todos.where("parentId").equals(parentId).toArray();
  return subs.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createTodo(input: NewTodo): Promise<Todo> {
  const todo: Todo = { ...input, done: false, createdAt: Date.now() };
  const id = await db.todos.add(todo);
  return { ...todo, id };
}

/** Convenience wrapper for adding a subtask under a main to-do. */
export async function createSubTodo(parentId: number, text: string): Promise<Todo> {
  return createTodo({ text, icon: "check", parentId });
}

/** Flips a to-do's completion and returns the new state. */
export async function updateTodo(id: number, changes: Partial<Pick<Todo, "text" | "icon" | "frequency" | "customRepeat" | "dueDate" | "dueTime" | "dueEndTime" | "color">>): Promise<void> {
  await db.todos.update(id, changes);
}

/** Checks/unchecks a to-do for one day and returns the new state. Pass
 *  `dateStr` to act on a day other than today — the calendar does this, so a
 *  forgotten day can still be ticked off. A one-off task just flips done. A
 *  repeating task adds/removes that day in `completedDates`, so each missed
 *  day is independent and checking today never leaves it "done" tomorrow. */
export async function toggleTodo(id: number, dateStr?: string): Promise<boolean> {
  const existing = await db.todos.get(id);
  if (!existing) return false;
  // A subtask with no schedule of its own follows its parent's.
  const parent = existing.parentId != null && !existing.dueDate ? await db.todos.get(existing.parentId) : undefined;
  const source = parent ?? existing;
  const today = toDateStr(new Date());
  const day = dateStr ?? today;
  const next = !isDoneOn(existing, day, source);

  if (!isRecurringTodo(source)) {
    await db.todos.update(id, { done: next, completedAt: next ? Date.now() : undefined });
    return next;
  }

  const dates = new Set(existing.completedDates ?? []);
  // Carry over a completion recorded the old way (single flag) so it isn't lost.
  if (existing.done && existing.completedAt != null) dates.add(localDayOf(existing.completedAt));
  if (next) dates.add(day);
  else dates.delete(day);

  // `done` / `completedAt` keep describing *today*, for anything reading them directly.
  const doneToday = dates.has(today);
  const keepStamp = existing.completedAt != null && localDayOf(existing.completedAt) === today;
  await db.todos.update(id, {
    completedDates: [...dates].sort(),
    done: doneToday,
    completedAt: doneToday ? (keepStamp ? existing.completedAt : Date.now()) : undefined
  });
  return next;
}

/** Deleting a to-do also removes its subtasks — they can't outlive their parent. */
export async function deleteTodo(id: number): Promise<void> {
  const subs = await db.todos.where("parentId").equals(id).toArray();
  await db.todos.bulkDelete(subs.map((s) => s.id!));
  await db.todos.delete(id);
}

export async function clearCompletedTodos(): Promise<void> {
  const all = await db.todos.toArray();
  const byId = new Map(all.map((t) => [t.id!, t]));
  // Repeating tasks (and subtasks following one) are "done" only for a day —
  // they come back tomorrow, so clearing completed items must leave them alone.
  const repeats = (t: Todo) => {
    const parent = t.parentId != null && !t.dueDate ? byId.get(t.parentId) : undefined;
    return isRecurringTodo(parent ?? t);
  };
  const doneIds = all.filter((t) => t.done && !repeats(t)).map((t) => t.id!);
  await db.todos.bulkDelete(doneIds);
}

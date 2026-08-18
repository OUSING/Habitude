import { db } from "./db";
import type { NewTodo, Todo } from "../types/todo";

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
export async function toggleTodo(id: number): Promise<boolean> {
  const existing = await db.todos.get(id);
  if (!existing) return false;
  const next = !existing.done;
  await db.todos.update(id, { done: next, completedAt: next ? Date.now() : undefined });
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
  const doneIds = all.filter((t) => t.done).map((t) => t.id!);
  await db.todos.bulkDelete(doneIds);
}

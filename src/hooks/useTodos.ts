import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../services/db";
import type { Todo } from "../types/todo";

/** All top-level to-dos, reactive — sorted with open items first, done
 *  items last. Subtasks are excluded here; use useSubTodos for those. */
export function useTodos(): Todo[] {
  const todos = useLiveQuery(async () => {
    const all = await db.todos.toArray();
    return all
      .filter((t) => t.parentId == null)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.done && b.done) return (b.completedAt ?? 0) - (a.completedAt ?? 0);
        return b.createdAt - a.createdAt;
      });
  }, []);
  return todos ?? [];
}

/** Subtasks nested under a given main to-do, reactive. */
export function useSubTodos(parentId: number | undefined): Todo[] {
  const subs = useLiveQuery(async () => {
    if (parentId == null) return [];
    const all = await db.todos.where("parentId").equals(parentId).toArray();
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }, [parentId]);
  return subs ?? [];
}

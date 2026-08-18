export interface Todo {
  /** Auto-incremented by Dexie — absent until the record is first saved. */
  id?: number;
  text: string;
  done: boolean;
  /** Icon key, see utils/icons.ts */
  icon: string;
  createdAt: number;
  completedAt?: number;
  /** Set only for subtasks — the id of the main to-do they're nested under.
   *  Absent for top-level to-dos. */
  parentId?: number;
}

export type NewTodo = Pick<Todo, "text" | "icon"> & { parentId?: number };

export type TodoFrequency = "once" | "daily" | "weekdays" | "weekly" | "custom";

export type TodoCustomRepeatUnit = "day" | "week" | "month" | "year";

export interface TodoCustomRepeat {
  interval: number;
  unit: TodoCustomRepeatUnit;
  weekdays?: number[]; // 0 = Sunday ... 6 = Saturday; used for weekly/custom weekly rules
}

export interface Todo {
  /** Auto-incremented by Dexie — absent until the record is first saved. */
  id?: number;
  text: string;
  done: boolean;
  /** Icon key, see utils/icons.ts */
  icon: string;
  createdAt: number;
  completedAt?: number;
  /** Optional recurrence for the task. */
  frequency?: TodoFrequency;
  /** Optional custom recurrence settings. */
  customRepeat?: TodoCustomRepeat;
  /** Optional due date in local YYYY-MM-DD format. */
  dueDate?: string;
  /** Optional due time in local 24-hour HH:MM format. */
  dueTime?: string;
  /** Set only for subtasks — the id of the main to-do they're nested under.
   *  Absent for top-level to-dos. */
  parentId?: number;
}

export type NewTodo = Pick<Todo, "text" | "icon"> & Partial<Pick<Todo, "frequency" | "customRepeat" | "dueDate" | "dueTime">> & { parentId?: number };

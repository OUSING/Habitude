import Dexie, { type Table } from "dexie";
import type { Habit, HabitLog } from "../types/habit";
import type { Todo } from "../types/todo";

export interface ActivityLog {
  /** Stable id so the same phone log can be synchronized repeatedly without duplicates. */
  id: string;
  date: string;
  type: "steps" | "run";
  value: number;
  /** For runs: duration in seconds. */
  durationSec?: number;
  /** For runs: seconds per kilometre. */
  paceSecPerKm?: number | null;
  source?: "phone" | "web";
  createdAt: number;
}

export interface DailyNote {
  id?: number;
  date: string;
  title?: string;
  content: string;
  updatedAt: number;
}

/**
 * All habit + log data lives in IndexedDB via Dexie, so the app works
 * fully offline. This is what @capacitor/preferences is deliberately
 * NOT used for — Preferences is a simple key/value store meant for
 * small settings (theme, onboarding flags), not for a growing table
 * of logs. See services/settings.ts for that split.
 */
export class HabitDB extends Dexie {
  habits!: Table<Habit, number>;
  logs!: Table<HabitLog, number>;
  todos!: Table<Todo, number>;
  dailyNotes!: Table<DailyNote, number>;
  activityLogs!: Table<ActivityLog, string>;

  constructor() {
    super("habit-tracker-db");
    this.version(1).stores({
      habits: "++id, name, archived",
      // Compound index [habitId+date] lets us fetch/toggle a single
      // day's log for a habit in O(1) without scanning the table.
      logs: "++id, habitId, date, [habitId+date]"
    });
    // v2 adds the simple, one-off to-do list — separate from habits,
    // which are recurring and scheduled by frequency.
    this.version(2).stores({
      habits: "++id, name, archived",
      logs: "++id, habitId, date, [habitId+date]",
      todos: "++id, createdAt"
    });
    // v3 adds sub-habits/subtasks — an optional parentId index on both
    // habits and todos, letting either be nested under a main item.
    // Existing rows just get parentId === undefined, i.e. top-level.
    this.version(3).stores({
      habits: "++id, name, archived, parentId",
      logs: "++id, habitId, date, [habitId+date]",
      todos: "++id, createdAt, parentId"
    });
    // v4 adds one private note per local calendar day.
    this.version(4).stores({
      habits: "++id, name, archived, parentId",
      logs: "++id, habitId, date, [habitId+date]",
      todos: "++id, createdAt, parentId",
      dailyNotes: "++id, &date, updatedAt"
    });
    // v5 stores phone pedometer and running sessions independently from
    // habits, so activity history can be synchronized across devices.
    this.version(5).stores({
      habits: "++id, name, archived, parentId",
      logs: "++id, habitId, date, [habitId+date]",
      todos: "++id, createdAt, parentId",
      dailyNotes: "++id, &date, updatedAt",
      activityLogs: "&id, date, type, [type+date]"
    });
  }
}

export const db = new HabitDB();

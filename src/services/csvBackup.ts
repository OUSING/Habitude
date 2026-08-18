import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { db } from "./db";
import { buildCsv, parseCsvObjects } from "../utils/csv";
import { paletteDefault } from "../utils/palette";
import { defaultIcon } from "../utils/icons";
import { scheduleHabitReminder } from "./notifications";
import type { Habit, HabitLog, Weekday } from "../types/habit";
import type { Todo } from "../types/todo";

/**
 * CSV export/import, separate from the Google Drive JSON backup
 * (services/driveBackup.ts). This is meant for opening in a
 * spreadsheet, editing, or moving data in/out of another tool — not as
 * the primary backup mechanism. Two files:
 *   - habitude-habits.csv: one row per habit definition, plus one row
 *     per logged day, distinguished by the `type` column. Self-contained
 *     enough to fully recreate habits + history on import.
 *   - habitude-todos.csv: the to-do list.
 */

const HABITS_HEADER = [
  "type",
  "habit",
  "color",
  "icon",
  "frequency_type",
  "frequency_days",
  "reminder_time",
  "unit",
  "target",
  "archived",
  "date",
  "completed",
  "value"
];

const TODOS_HEADER = ["text", "icon", "done", "created_at", "completed_at"];

/* -------------------------------- Export -------------------------------- */

function frequencyDaysToCsv(habit: Habit): string {
  return habit.frequency.type === "weekly" ? habit.frequency.days.join("|") : "";
}

async function buildHabitsCsv(): Promise<string> {
  const [habits, logs] = await Promise.all([db.habits.toArray(), db.logs.toArray()]);
  const habitById = new Map(habits.map((h) => [h.id, h]));

  const rows: unknown[][] = [];

  for (const h of habits) {
    rows.push([
      "habit",
      h.name,
      h.color,
      h.icon,
      h.frequency.type,
      frequencyDaysToCsv(h),
      h.reminderTime ?? "",
      h.measurement?.unit ?? "",
      h.measurement?.target ?? "",
      h.archived ? "1" : "0",
      "",
      "",
      ""
    ]);
  }

  for (const log of logs) {
    const habit = habitById.get(log.habitId);
    if (!habit) continue; // orphaned log with no matching habit — skip
    rows.push([
      "log",
      habit.name,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      log.date,
      log.completed ? "1" : "0",
      log.value ?? ""
    ]);
  }

  return buildCsv(HABITS_HEADER, rows);
}

async function buildTodosCsv(): Promise<string> {
  const todos = await db.todos.toArray();
  const rows = todos.map((t) => [
    t.text,
    t.icon,
    t.done ? "1" : "0",
    new Date(t.createdAt).toISOString(),
    t.completedAt ? new Date(t.completedAt).toISOString() : ""
  ]);
  return buildCsv(TODOS_HEADER, rows);
}

/** Writes the CSV to disk and opens the native share sheet (Android/iOS),
 *  or triggers a plain browser download (web). */
async function saveAndShareCsv(filename: string, csvText: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: filename,
      data: csvText,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    await Share.share({
      title: filename,
      url: written.uri
    });
    return;
  }

  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportHabitsCsv(): Promise<void> {
  const csv = await buildHabitsCsv();
  await saveAndShareCsv("habitude-habits.csv", csv);
}

export async function exportTodosCsv(): Promise<void> {
  const csv = await buildTodosCsv();
  await saveAndShareCsv("habitude-todos.csv", csv);
}

/* -------------------------------- Import -------------------------------- */

function parseFrequencyDays(raw: string): Weekday[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s) as Weekday)
    .filter((n) => n >= 0 && n <= 6);
}

export interface CsvImportResult {
  kind: "habits" | "todos";
  summary: string;
}

async function importHabitsCsv(text: string): Promise<CsvImportResult> {
  const objects = parseCsvObjects(text);
  if (objects.length === 0) {
    throw new Error("The CSV file has no rows.");
  }

  const existingHabits = await db.habits.toArray();
  const habitIdByName = new Map(existingHabits.map((h) => [h.name.trim().toLowerCase(), h.id!]));

  let habitsCreated = 0;
  let habitsUpdated = 0;
  let logsImported = 0;

  // Pass 1: habit definition rows — create or update matching habits by name.
  for (const row of objects) {
    if (row.type !== "habit") continue;
    const name = row.habit?.trim();
    if (!name) continue;

    const patch: Partial<Habit> = {
      name,
      color: row.color || paletteDefault(),
      icon: row.icon || defaultIcon(),
      frequency:
        row.frequency_type === "weekly"
          ? { type: "weekly", days: parseFrequencyDays(row.frequency_days) }
          : { type: "daily" },
      reminderTime: row.reminder_time || undefined,
      measurement: row.unit && row.target ? { unit: row.unit, target: Number(row.target) } : undefined,
      archived: row.archived === "1"
    };

    const existingId = habitIdByName.get(name.toLowerCase());
    if (existingId) {
      await db.habits.update(existingId, patch);
      const updated = await db.habits.get(existingId);
      if (updated) await scheduleHabitReminder(updated);
      habitsUpdated++;
    } else {
      const id = await db.habits.add({ ...patch, createdAt: Date.now() } as Habit);
      habitIdByName.set(name.toLowerCase(), id);
      const created = await db.habits.get(id);
      if (created) await scheduleHabitReminder(created);
      habitsCreated++;
    }
  }

  // Pass 2: log rows — create a minimal habit on the fly if its name never
  // appeared in a "habit" row (e.g. a hand-trimmed CSV with only logs).
  for (const row of objects) {
    if (row.type !== "log") continue;
    const name = row.habit?.trim();
    const date = row.date?.trim();
    if (!name || !date) continue;

    let habitId = habitIdByName.get(name.toLowerCase());
    if (!habitId) {
      const id = await db.habits.add({
        name,
        color: paletteDefault(),
        icon: defaultIcon(),
        frequency: { type: "daily" },
        createdAt: Date.now(),
        archived: false
      } as Habit);
      habitIdByName.set(name.toLowerCase(), id);
      habitId = id;
      habitsCreated++;
    }

    const log: HabitLog = {
      habitId,
      date,
      completed: row.completed === "1",
      value: row.value ? Number(row.value) : undefined
    };
    const existingLog = await db.logs.where("[habitId+date]").equals([habitId, date]).first();
    if (existingLog) {
      await db.logs.update(existingLog.id!, log);
    } else {
      await db.logs.add(log);
    }
    logsImported++;
  }

  return {
    kind: "habits",
    summary: `${habitsCreated} habit(s) created, ${habitsUpdated} updated, ${logsImported} day(s) imported.`
  };
}

async function importTodosCsv(text: string): Promise<CsvImportResult> {
  const objects = parseCsvObjects(text);
  const todos: Todo[] = objects
    .filter((row) => row.text?.trim())
    .map((row) => ({
      text: row.text.trim(),
      icon: row.icon || defaultIcon(),
      done: row.done === "1",
      createdAt: row.created_at ? Date.parse(row.created_at) || Date.now() : Date.now(),
      completedAt: row.completed_at ? Date.parse(row.completed_at) || undefined : undefined
    }));

  if (todos.length === 0) {
    throw new Error("The CSV file has no valid tasks.");
  }

  await db.todos.bulkAdd(todos);
  return { kind: "todos", summary: `${todos.length} task(s) imported (added to the existing list).` };
}

/** Detects which of the two CSV formats `text` is, and imports it. */
export async function importCsv(text: string): Promise<CsvImportResult> {
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0] ?? "";
  const header = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  if (header.includes("frequency_type") && header.includes("habit")) {
    return importHabitsCsv(text);
  }
  if (header.includes("text") && header.includes("done")) {
    return importTodosCsv(text);
  }
  throw new Error(
    "Unrecognized CSV format. Use a file exported from Habitude (habits or tasks)."
  );
}

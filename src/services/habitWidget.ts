import { HabitWidget } from "../platform/habitWidget";
import { db } from "./db";
import type { Habit } from "../types/habit";
import { isHabitScheduledOn, todayStr } from "../utils/date";
import { getStepGoal } from "./settings";
import { StepCounter } from "../platform/stepCounter";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { toggleLog } from "./habitService";
import { toggleTodo } from "./todoService";

/**
 * Pushes today's scheduled habits, tasks, daily progress, and steps to native widgets.
 */
export async function syncHabitWidget(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const today = todayStr();

  try {
    const [allHabits, todaysLogs, todos] = await Promise.all([
      db.habits.toArray(),
      db.logs.where("date").equals(today).toArray(),
      db.todos.toArray()
    ]);

    // 1. Sync Habits & Progress
    const doneHabitIds = new Set(
      todaysLogs.filter((l) => l.completed).map((l) => l.habitId)
    );

    const scheduledHabits = allHabits
      .filter((h): h is Habit & { id: number } => !h.archived && h.parentId == null && h.id != null)
      .filter((h) => isHabitScheduledOn(h.frequency, today))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        completed: doneHabitIds.has(h.id)
      }));

    const doneCount = scheduledHabits.filter(h => h.completed).length;
    const totalCount = scheduledHabits.length;

    await HabitWidget.updateWidgetData({ date: today, habits: scheduledHabits });
    await HabitWidget.updateDailyProgressWidget({ done: doneCount, total: totalCount });

    // 2. Sync Tasks
    const todayStart = new Date(today).getTime();
    const scheduledTasks = todos
      .filter(t => !t.done || (t.completedAt && t.completedAt >= todayStart))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((t) => ({
        id: t.id!,
        text: t.text,
        completed: t.done
      }));

    await HabitWidget.updateTasksWidget({ date: today, tasks: scheduledTasks });
  } catch (err) {
    console.warn("Failed to sync widgets", err);
  }
}

/* ------------------------------ Auto refresh ------------------------------ */

const WIDGET_SYNC_DEBOUNCE_MS = 1200;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let hooksInstalled = false;

function scheduleWidgetSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncHabitWidget();
  }, WIDGET_SYNC_DEBOUNCE_MS);
}

/** Keeps the widget current by re-pushing today's checklist whenever a
 *  habit or log changes. Safe to call more than once. */
export function initHabitWidgetSync(): void {
  if (!Capacitor.isNativePlatform()) return;
  void syncHabitWidget();

  if (hooksInstalled) return;
  hooksInstalled = true;

  for (const table of [db.habits, db.logs, db.todos]) {
    table.hook("creating", () => scheduleWidgetSync());
    table.hook("updating", () => scheduleWidgetSync());
    table.hook("deleting", () => scheduleWidgetSync());
  }

  // Hook into step counter for Step Widget updates
  StepCounter.addListener("stepsChanged", async ({ today }) => {
    const goal = await getStepGoal();
    await HabitWidget.updateStepWidget({ steps: today, goal });
  }).catch(err => {
    console.warn("Could not listen to step counter for widget sync", err);
  });

  // Process pending interactive actions when app comes to foreground
  App.addListener("appStateChange", async ({ isActive }) => {
    if (isActive) {
      await processPendingWidgetActions();
    }
  });

  // Also process once on boot
  void processPendingWidgetActions();
}

async function processPendingWidgetActions() {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { actions } = await HabitWidget.getAndClearPendingActions();
    if (!actions || actions.length === 0) return;

    const today = todayStr();
    for (const action of actions as Array<{ type: "habit" | "task"; id: number }>) {
      if (action.type === "habit") {
        await toggleLog(action.id, today);
      } else if (action.type === "task") {
        await toggleTodo(action.id);
      }
    }
  } catch (err) {
    console.warn("Failed to process pending widget actions", err);
  }
}

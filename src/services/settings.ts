import { Preferences } from "@capacitor/preferences";

/**
 * Small key/value settings (theme, onboarding flags) go through
 * @capacitor/preferences rather than Dexie. On native iOS/Android this
 * is backed by UserDefaults/SharedPreferences; in a plain browser (e.g.
 * `npm run dev`) the plugin transparently falls back to localStorage,
 * so no environment branching is needed here.
 */

const THEME_KEY = "habit-tracker:theme";

/** Four exact-color palettes; each also supports light/dark mode. */
export type ThemeMode = "crimson" | "orange" | "amber" | "purple" | "grey";
export type ThemePreference = ThemeMode | "system";

export async function getThemePreference(): Promise<ThemePreference> {
  const { value } = await Preferences.get({ key: THEME_KEY });
  if (value === "crimson" || value === "orange" || value === "amber" || value === "purple" || value === "grey") {
    return value;
  }
  // Migrate legacy/retired theme names to the closest remaining palette.
  if (value === "rose" || value === "pink" || value === "christmas") return "crimson";
  if (value === "halloween") return "orange";
  return "crimson";
}

export async function setThemePreference(theme: ThemePreference): Promise<void> {
  await Preferences.set({ key: THEME_KEY, value: theme });
}

/** Resolves "system" against the OS preference; every other value passes through. */
export function resolveTheme(pref: ThemePreference): ThemeMode {
  if (pref === "system") return "crimson";
  return pref;
}

const DARK_MODE_KEY = "habit-tracker:darkMode";

export async function getDarkMode(): Promise<boolean> {
  const { value } = await Preferences.get({ key: DARK_MODE_KEY });
  return value === "true";
}

export async function setDarkMode(enabled: boolean): Promise<void> {
  await Preferences.set({ key: DARK_MODE_KEY, value: String(enabled) });
}

/* ------------------------------ Font choice ------------------------------ */

const FONT_KEY = "habit-tracker:font";
export type FontPreference = "jojoba" | "pretty-neat";

export async function getFontPreference(): Promise<FontPreference> {
  const { value } = await Preferences.get({ key: FONT_KEY });
  return value === "pretty-neat" ? "pretty-neat" : "jojoba";
}

export async function setFontPreference(font: FontPreference): Promise<void> {
  await Preferences.set({ key: FONT_KEY, value: font });
}

/* --------------------------- Dashboard view mode --------------------------- */

const VIEW_MODE_KEY = "habit-tracker:viewMode";

export type ViewMode = "list" | "loop";

export async function getViewMode(): Promise<ViewMode> {
  const { value } = await Preferences.get({ key: VIEW_MODE_KEY });
  return value === "loop" ? "loop" : "list";
}

export async function setViewMode(mode: ViewMode): Promise<void> {
  await Preferences.set({ key: VIEW_MODE_KEY, value: mode });
}

/* ------------------------- Google Drive backup ------------------------- */

const DRIVE_FILE_ID_KEY = "habit-tracker:driveFileId";
const LAST_BACKUP_KEY = "habit-tracker:lastBackupAt";

/** Cached Drive file id for the backup file, so repeat backups update the
 *  same file instead of searching Drive (or creating duplicates) every time. */
export async function getDriveFileId(): Promise<string | null> {
  const { value } = await Preferences.get({ key: DRIVE_FILE_ID_KEY });
  return value ?? null;
}

export async function setDriveFileId(fileId: string): Promise<void> {
  await Preferences.set({ key: DRIVE_FILE_ID_KEY, value: fileId });
}

export async function getLastBackupAt(): Promise<Date | null> {
  const { value } = await Preferences.get({ key: LAST_BACKUP_KEY });
  return value ? new Date(value) : null;
}

export async function setLastBackupAt(date: Date): Promise<void> {
  await Preferences.set({ key: LAST_BACKUP_KEY, value: date.toISOString() });
}

/** The Drive file's `modifiedTime` this device last pushed or pulled — lets
 *  auto-pull tell "someone else changed the backup since I last saw it"
 *  apart from "I'm just seeing my own last push", so it only downloads
 *  (and overwrites local data) when there's actually something new. */
const DRIVE_MODIFIED_AT_KEY = "habit-tracker:driveModifiedAt";

export async function getDriveModifiedAt(): Promise<string | null> {
  const { value } = await Preferences.get({ key: DRIVE_MODIFIED_AT_KEY });
  return value ?? null;
}

export async function setDriveModifiedAt(modifiedTime: string): Promise<void> {
  await Preferences.set({ key: DRIVE_MODIFIED_AT_KEY, value: modifiedTime });
}

/** Whether changes to habits/logs/todos should be pushed to the Drive
 *  backup automatically (debounced) instead of only on a manual tap. */
const AUTO_SYNC_ENABLED_KEY = "habit-tracker:autoSyncEnabled";

export async function getAutoSyncEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: AUTO_SYNC_ENABLED_KEY });
  return value === "true";
}

export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: AUTO_SYNC_ENABLED_KEY, value: String(enabled) });
}

/* ------------------------- Completed items visibility ------------------------- */

// Completed habits/to-dos are never deleted just for being done — they stay
// cached in the database either way. These two flags only control whether
// the "Completed" section under each list is expanded or collapsed, and the
// user's choice is remembered across app launches.

const SHOW_COMPLETED_HABITS_KEY = "habit-tracker:showCompletedHabits";
const SHOW_COMPLETED_TODOS_KEY = "habit-tracker:showCompletedTodos";

export async function getShowCompletedHabits(): Promise<boolean> {
  const { value } = await Preferences.get({ key: SHOW_COMPLETED_HABITS_KEY });
  return value !== "false"; // shown by default
}

export async function setShowCompletedHabits(show: boolean): Promise<void> {
  await Preferences.set({ key: SHOW_COMPLETED_HABITS_KEY, value: String(show) });
}

export async function getShowCompletedTodos(): Promise<boolean> {
  const { value } = await Preferences.get({ key: SHOW_COMPLETED_TODOS_KEY });
  return value !== "false"; // shown by default
}

export async function setShowCompletedTodos(show: boolean): Promise<void> {
  await Preferences.set({ key: SHOW_COMPLETED_TODOS_KEY, value: String(show) });
}

/* --------------------------- Step tracking --------------------------- */

const AUTO_STEPS_ENABLED_KEY = "habit-tracker:autoStepsEnabled";
const STEPS_HABIT_ID_KEY = "habit-tracker:stepsHabitId";

export async function getAutoStepsEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: AUTO_STEPS_ENABLED_KEY });
  return value === "true";
}

export async function setAutoStepsEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: AUTO_STEPS_ENABLED_KEY, value: String(enabled) });
}

/** The id of the auto-created "Steps" habit, once one exists — cached here
 *  rather than matched by name each time, so renaming the habit doesn't
 *  break the link. */
export async function getStepsHabitId(): Promise<number | null> {
  const { value } = await Preferences.get({ key: STEPS_HABIT_ID_KEY });
  return value ? Number(value) : null;
}

export async function setStepsHabitId(id: number): Promise<void> {
  await Preferences.set({ key: STEPS_HABIT_ID_KEY, value: String(id) });
}

/* ------------------------- Tracker card visibility ------------------------- */

// Lets the user hide the Step Tracker / Running Tracker cards from the
// Dashboard without losing any of their underlying data — flipping the
// toggle back on just re-reveals the same card, in place.

const SHOW_STEP_TRACKER_KEY = "habit-tracker:showStepTracker";
const SHOW_RUNNING_TRACKER_KEY = "habit-tracker:showRunningTracker";

export async function getShowStepTracker(): Promise<boolean> {
  const { value } = await Preferences.get({ key: SHOW_STEP_TRACKER_KEY });
  return value !== "false"; // shown by default
}

export async function setShowStepTracker(show: boolean): Promise<void> {
  await Preferences.set({ key: SHOW_STEP_TRACKER_KEY, value: String(show) });
}

export async function getShowRunningTracker(): Promise<boolean> {
  const { value } = await Preferences.get({ key: SHOW_RUNNING_TRACKER_KEY });
  return value !== "false"; // shown by default
}

export async function setShowRunningTracker(show: boolean): Promise<void> {
  await Preferences.set({ key: SHOW_RUNNING_TRACKER_KEY, value: String(show) });
}

/* ----------------------------- Step goal ----------------------------- */

const STEP_GOAL_KEY = "habit-tracker:stepGoal";
const DEFAULT_STEP_GOAL = 8000;

export async function getStepGoal(): Promise<number> {
  const { value } = await Preferences.get({ key: STEP_GOAL_KEY });
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STEP_GOAL;
}

export async function setStepGoal(goal: number): Promise<void> {
  await Preferences.set({ key: STEP_GOAL_KEY, value: String(Math.max(1, Math.round(goal))) });
}

/* --------------------------- Background style --------------------------- */

const BACKGROUND_MODE_KEY = "habit-tracker:backgroundMode";

export type BackgroundMode = "ambient" | "moon";

export async function getBackgroundMode(): Promise<BackgroundMode> {
  const { value } = await Preferences.get({ key: BACKGROUND_MODE_KEY });
  return value === "moon" ? "moon" : "ambient";
}

export async function setBackgroundMode(mode: BackgroundMode): Promise<void> {
  await Preferences.set({ key: BACKGROUND_MODE_KEY, value: mode });
}


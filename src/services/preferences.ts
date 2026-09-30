/**
 * Tiny key/value store for small settings, backed by localStorage.
 *
 * It keeps the same async get/set/remove shape the app already used, and the
 * same "CapacitorStorage." key prefix the old Capacitor Preferences web
 * implementation wrote with, so settings saved before the app became
 * web-only are still found.
 */
const PREFIX = "CapacitorStorage.";

export const Preferences = {
  async get({ key }: { key: string }): Promise<{ value: string | null }> {
    try {
      return { value: window.localStorage.getItem(PREFIX + key) };
    } catch {
      return { value: null };
    }
  },
  async set({ key, value }: { key: string; value: string }): Promise<void> {
    try {
      window.localStorage.setItem(PREFIX + key, value);
    } catch {
      /* storage full or blocked (private mode) — settings just won't persist */
    }
  },
  async remove({ key }: { key: string }): Promise<void> {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  }
};

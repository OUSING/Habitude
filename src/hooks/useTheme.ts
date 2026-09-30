import { useCallback, useEffect, useState } from "react";
import {
  getAppearance,
  getThemePreference,
  resolveTheme,
  setAppearance,
  setThemePreference,
  type Appearance,
  type ThemeMode
} from "../services/settings";

const CYCLE: ThemeMode[] = ["crimson", "orange", "amber", "purple", "grey"];
const THEME_CLASSES: Record<ThemeMode, string> = {
  crimson: "theme-crimson",
  orange: "theme-orange-custom",
  amber: "theme-amber",
  purple: "theme-purple",
  grey: "theme-grey"
};

const APPEARANCE_CYCLE: Appearance[] = ["light", "dark", "bright"];
const ALL_THEME_CLASSES = Object.values(THEME_CLASSES);

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("crimson");
  const [appearance, setAppearanceState] = useState<Appearance>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getThemePreference(), getAppearance()]).then(([pref, mode]) => {
      if (cancelled) return;
      setThemeState(resolveTheme(pref));
      setAppearanceState(mode);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...ALL_THEME_CLASSES, "theme-dark-mode", "theme-bright-mode", "theme-dark");
    root.classList.add(THEME_CLASSES[theme]);
    // "bright" is a lighter dark mode: it keeps every dark-mode rule and
    // layers theme-bright-mode on top to lift the background.
    if (appearance === "dark" || appearance === "bright") root.classList.add("theme-dark-mode");
    if (appearance === "bright") root.classList.add("theme-bright-mode");
  }, [theme, appearance]);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      void setThemePreference(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    void setThemePreference(next);
  }, []);

  /** Cycles Light -> Dark -> Bright dark -> Light. */
  const cycleAppearance = useCallback(() => {
    setAppearanceState((current) => {
      const next = APPEARANCE_CYCLE[(APPEARANCE_CYCLE.indexOf(current) + 1) % APPEARANCE_CYCLE.length];
      void setAppearance(next);
      return next;
    });
  }, []);

  return { theme, appearance, isDark: appearance === "dark", toggle, setTheme, cycleAppearance, toggleDark: cycleAppearance, loaded };
}

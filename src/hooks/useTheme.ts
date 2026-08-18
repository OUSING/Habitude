import { useCallback, useEffect, useState } from "react";
import {
  getDarkMode,
  getThemePreference,
  resolveTheme,
  setDarkMode,
  setThemePreference,
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

const ALL_THEME_CLASSES = Object.values(THEME_CLASSES);

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("crimson");
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getThemePreference(), getDarkMode()]).then(([pref, dark]) => {
      if (cancelled) return;
      setThemeState(resolveTheme(pref));
      setIsDark(dark);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...ALL_THEME_CLASSES, "theme-dark-mode", "theme-dark");
    root.classList.add(THEME_CLASSES[theme]);
    if (isDark) root.classList.add("theme-dark-mode");
  }, [theme, isDark]);

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

  const toggleDark = useCallback(() => {
    setIsDark((current) => {
      const next = !current;
      void setDarkMode(next);
      return next;
    });
  }, []);

  return { theme, isDark, toggle, setTheme, toggleDark, loaded };
}

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LayoutGrid, LayoutList, Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import { Dashboard } from "./screens/Dashboard";
import { Stats } from "./screens/Stats";
import { Settings } from "./screens/Settings";
import { TodoList } from "./screens/TodoList";
import { AddEditHabit } from "./screens/AddEditHabit";
import { BottomNav } from "./components/BottomNav";
import { AmbientBackground } from "./components/AmbientBackground";
import { SplashScreen } from "./components/SplashScreen";
import { useNotificationSetup } from "./hooks/useNotificationSetup";
import { useStepSync } from "./hooks/useStepSync";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "./hooks/useAuth";
import { todayStr } from "./utils/date";
import { getViewMode, setViewMode, type ViewMode, type ThemeMode } from "./services/settings";
import { initHabitWidgetSync, syncHabitWidget } from "./services/habitWidget";
import { initAutoSync, initAutoPull } from "./services/driveBackup";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
import { NotificationPrimer } from "./components/ui/NotificationPrimer";
import { CompletionCelebration } from "./components/CompletionCelebration";
import { DesktopShell } from "./components/DesktopShell";
import { ThemeToggle } from "./components/ThemeToggle";

export type Screen = "dashboard" | "todos" | "stats" | "settings";

export default function App() {
  const { theme, isDark, toggle: toggleTheme, toggleDark } = useTheme();
  const { loaded: authLoaded, session, signIn, signOut } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initAutoSync();
    initAutoPull();
    initHabitWidgetSync();
  }, []);

  return (
    <>
      {/* Sits above everything, including the auth-loading placeholder
          below, so the app can keep booting underneath while this plays. */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {!authLoaded ? (
        // Avoid a flash of the screen while we check for a saved session.
        <div className="h-full bg-bg" />
      ) : (
        <ConfirmProvider>
          <AppContent
            theme={theme}
            isDark={isDark}
            toggleTheme={toggleTheme}
            toggleDark={toggleDark}
            session={session}
            onSignIn={signIn}
            onSignOut={signOut}
          />
        </ConfirmProvider>
      )}
    </>
  );
}

interface AppContentProps {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  toggleDark: () => void;
  session: any;
  onSignIn: () => Promise<any>;
  onSignOut: () => Promise<void>;
}

function AppContent({ theme, isDark, toggleTheme, toggleDark, session, onSignIn, onSignOut }: AppContentProps) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [sheetOpen, setSheetOpen] = useState(false);

  // Follow the calendar forward across midnight while the app stays open —
  // but only when the *actual* day has rolled over, and only if the user
  // was looking at "today" in the first place. Comparing against the
  // currently selected date (instead of a remembered "last known today")
  // used to snap any manually-navigated date (e.g. via the grid-mode
  // month chevrons) back to today every 60s/on focus, which made date
  // navigation look like it kept resetting itself.
  const lastKnownTodayRef = useRef(todayStr());
  useEffect(() => {
    const syncCurrentDay = () => {
      const today = todayStr();
      if (today === lastKnownTodayRef.current) return; // day hasn't actually changed

      setSelectedDate((current) => {
        const wasViewingToday = current === lastKnownTodayRef.current;
        if (wasViewingToday) {
          // The widget's checklist is keyed by day too — if the calendar day
          // rolled over while the app was open/backgrounded, push a refresh
          // so it doesn't keep showing yesterday's (now stale) habits.
          void syncHabitWidget();
          return today;
        }
        // User had deliberately navigated elsewhere — leave their place alone.
        return current;
      });

      lastKnownTodayRef.current = today;
    };

    syncCurrentDay();

    const intervalId = window.setInterval(syncCurrentDay, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncCurrentDay();
      }
    };
    const handleFocus = () => syncCurrentDay();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
  const [editingHabitId, setEditingHabitId] = useState<number | undefined>(undefined);
  const [viewMode, setViewModeState] = useState<ViewMode>("list");

  useNotificationSetup();
  useStepSync();

  useEffect(() => {
    getViewMode().then(setViewModeState);
  }, []);

  function changeViewMode(mode: ViewMode) {
    setViewModeState(mode);
    setViewMode(mode);
  }

  function openHabit(id: number) {
    setEditingHabitId(id);
    setSheetOpen(true);
  }
  function addHabit() {
    setEditingHabitId(undefined);
    setSheetOpen(true);
  }
  function closeSheet() {
    setSheetOpen(false);
    setEditingHabitId(undefined);
  }

  return (
    // The whole app lives in a phone-width column, centered on wider
    // (desktop/tablet) viewports — this is what makes it "mobile-first"
    // even when previewed in a browser.
    <div className="app-root relative mx-auto flex h-full max-w-app flex-col bg-bg">
      <AmbientBackground theme={theme} />
      <CompletionCelebration theme={theme} />

      <div className="desktop-only-shell">
        <DesktopShell
          screen={screen}
          onChangeScreen={setScreen}
          viewMode={viewMode}
          onChangeViewMode={changeViewMode}
          onAddHabit={addHabit}
          theme={theme}
          onToggleTheme={toggleTheme}
          isDark={isDark}
          onToggleDark={toggleDark}
        >
          {screen === "dashboard" && (
            <Dashboard
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onOpenHabit={openHabit}
              onAddHabit={addHabit}
              viewMode={viewMode}
            />
          )}
          {screen === "todos" && <TodoList />}
          {screen === "stats" && <Stats />}
          {screen === "settings" && (
            <Settings
              session={session}
              onSignIn={onSignIn}
              onSignOut={onSignOut}
            />
          )}
        </DesktopShell>
      </div>

      <div className="mobile-only-shell">
        <div className="relative z-[1] min-h-0 flex-1">
          {screen === "dashboard" && (
            <div className="flex h-full flex-col">
              <header className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-safe-top">
                <div className="flex items-center justify-between pt-4">
                  <h1 className="font-display text-2xl font-semibold text-ink">Today</h1>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleDark}
                      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                      className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-2 active:text-ink"
                    >
                      {isDark ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
                    </button>
                    <ThemeToggle theme={theme} onToggle={toggleTheme} />
                    <button
                      onClick={() => changeViewMode(viewMode === "loop" ? "list" : "loop")}
                      aria-label={viewMode === "loop" ? "Switch to list view" : "Switch to grid view"}
                      title={viewMode === "loop" ? "Switch to list view" : "Switch to grid view"}
                      className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-2 active:text-ink"
                    >
                      {viewMode === "loop" ? <LayoutList size={16} strokeWidth={2.2} /> : <LayoutGrid size={16} strokeWidth={2.2} />}
                    </button>
                    <button
                      onClick={() => setScreen("settings")}
                      aria-label="Open settings"
                      title="Settings"
                      className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-2 active:text-ink"
                    >
                      <SettingsIcon size={17} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              </header>
              <div className="min-h-0 flex-1">
                <Dashboard
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onOpenHabit={openHabit}
                  onAddHabit={addHabit}
                  viewMode={viewMode}
                />
              </div>
            </div>
          )}
          {screen === "todos" && <TodoList />}
          {screen === "stats" && <Stats />}
          {screen === "settings" && (
            <div className="flex h-full flex-col">
              <header className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-safe-top">
                <div className="flex items-center gap-2 pt-4">
                  <button
                    onClick={() => setScreen("dashboard")}
                    aria-label="Back to Today"
                    className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-2 active:text-ink"
                  >
                    <ArrowLeft size={18} strokeWidth={2.2} />
                  </button>
                  <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
                </div>
              </header>
              <div className="min-h-0 flex-1">
                <Settings
                  session={session}
                  onSignIn={onSignIn}
                  onSignOut={onSignOut}
                />
              </div>
            </div>
          )}
        </div>
        <div className="relative z-[1]">
          <BottomNav
            screen={screen}
            onChange={setScreen}
          />
        </div>
      </div>

      <AddEditHabit open={sheetOpen} habitId={editingHabitId} onClose={closeSheet} />
      <NotificationPrimer onClose={() => {}} />
    </div>
  );
}


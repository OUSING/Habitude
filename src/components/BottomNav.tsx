import { BarChart2, Home, ListChecks } from "lucide-react";
import type { Screen } from "../App";

interface Props {
  screen: Screen;
  onChange: (screen: Screen) => void;
}

const TABS: { screen: Screen; label: string; icon: typeof Home }[] = [
  { screen: "dashboard", label: "Today", icon: Home },
  { screen: "todos", label: "To-Do", icon: ListChecks },
  { screen: "stats", label: "Stats", icon: BarChart2 }
];

function NavTab({ s, label, icon: Icon, active, onChange }: { s: Screen; label: string; icon: typeof Home; active: boolean; onChange: (screen: Screen) => void }) {
  return (
    <button
      onClick={() => onChange(s)}
      aria-current={active ? "page" : undefined}
      className="tap-target flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors duration-150 active:bg-surface-2"
    >
      <span className="flex h-7 w-12 items-center justify-center">
        <Icon size={20} className={active ? "text-brand" : "text-muted"} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className={["text-[11px] font-medium transition-colors duration-150", active ? "text-brand" : "text-muted"].join(" ")}>
        {label}
      </span>
    </button>
  );
}

// Bottom nav is navigation-only — Today, To-Do, Stats. View mode (list/grid)
// and settings live in the Dashboard header instead, since they act on/from
// a specific screen rather than being destinations of their own.
export function BottomNav({ screen, onChange }: Props) {
  return (
    <nav className="z-20 flex items-center border-t border-border bg-surface pb-safe-bottom shadow-[0_-6px_20px_rgb(0,0,0,0.05)]">
      {TABS.map(({ screen: s, label, icon }) => (
        <NavTab key={s} s={s} label={label} icon={icon} active={s === screen} onChange={onChange} />
      ))}
    </nav>
  );
}

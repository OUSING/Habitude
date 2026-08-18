import { Palette, Flame, CircleDot, Sparkles, Cloud } from "lucide-react";
import type { ThemeMode } from "../../services/settings";

interface Props {
  value: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

const THEMES: { mode: ThemeMode; label: string; Icon: typeof Sparkles; color: string; gradient?: string }[] = [
  { mode: "crimson", label: "Crimson", Icon: Palette, color: "#a50104" },
  { mode: "orange", label: "Orange", Icon: Flame, color: "#ec3f13" },
  { mode: "amber", label: "Amber", Icon: CircleDot, color: "#ffaa00" },
  {
    mode: "purple",
    label: "Purple",
    Icon: Sparkles,
    color: "#2c0735",
    gradient: "linear-gradient(90deg, #1c0421 0%, #2c0735 50%, #4a0c58 100%)"
  },
  { mode: "grey", label: "Grey", Icon: Cloud, color: "#6b7280" }
];

export function ThemePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="App color theme">
      {THEMES.map(({ mode, label, Icon, color, gradient }) => {
        const selected = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode)}
            className={["tap-target flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 transition-all duration-100 active:scale-95", selected ? "bg-surface-2" : "bg-surface-2/40"].join(" ")}
            style={selected ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
          >
            {gradient ? (
              <span
                aria-hidden="true"
                className="flex h-4 w-4 items-center justify-center rounded-full"
                style={{ background: gradient }}
              />
            ) : (
              <Icon size={16} strokeWidth={2.2} style={{ color }} />
            )}
            <span className="text-[11px] font-semibold text-ink">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

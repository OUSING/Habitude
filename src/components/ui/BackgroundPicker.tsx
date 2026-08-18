import { Moon, Sparkles } from "lucide-react";
import type { BackgroundMode } from "../../services/settings";

interface Props {
  value: BackgroundMode;
  onChange: (mode: BackgroundMode) => void;
}

const OPTIONS: { mode: BackgroundMode; label: string; Icon: typeof Sparkles; color: string }[] = [
  { mode: "ambient", label: "Ambient", Icon: Sparkles, color: "#EA580C" },
  { mode: "moon", label: "Moon phases", Icon: Moon, color: "#5B6BD6" }
];

/** Lets the user pick what plays behind the app: the original floating
 *  blobs/bubbles, or a night sky showing the real current moon phase. */
export function BackgroundPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Background style">
      {OPTIONS.map(({ mode, label, Icon, color }) => {
        const selected = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode)}
            className={[
              "tap-target flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 transition-all duration-100 active:scale-95",
              selected ? "bg-surface-2" : "bg-surface-2/40"
            ].join(" ")}
            style={selected ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
          >
            <Icon size={16} strokeWidth={2.2} style={{ color }} />
            <span className="text-[11px] font-semibold text-ink">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

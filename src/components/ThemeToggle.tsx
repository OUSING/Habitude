import { Sparkles, Palette, Flame, CircleDot, Cloud } from "lucide-react";
import type { ThemeMode } from "../services/settings";

interface Props { theme: ThemeMode; isDark?: boolean; onToggle: () => void; }

const MODE_META: Record<ThemeMode, { Icon: typeof Sparkles; label: string; color: string }> = {
  crimson: { Icon: Palette, label: "Crimson palette", color: "#a50104" },
  orange: { Icon: Flame, label: "Orange palette", color: "#ec3f13" },
  amber: { Icon: CircleDot, label: "Amber palette", color: "#ffaa00" },
  purple: { Icon: Sparkles, label: "Purple palette", color: "#8338ec" },
  grey: { Icon: Cloud, label: "Grey palette", color: "#6b7280" }
};

export function ThemeToggle({ theme, onToggle }: Props) {
  const meta = MODE_META[theme];
  const Icon = meta.Icon;
  const label = `${meta.label} — tap to switch to the next theme`;
  return (
    <button onClick={onToggle} aria-label={label} title={label} className="tap-target flex h-8 w-8 items-center justify-center rounded-full">
      <Icon key={theme} size={15} strokeWidth={2.2} className="animate-pop" style={{ color: meta.color }} />
    </button>
  );
}

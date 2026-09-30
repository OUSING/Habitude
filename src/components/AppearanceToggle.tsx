import { Moon, MoonStar, Sun } from "lucide-react";
import type { Appearance } from "../services/settings";

const META: Record<Appearance, { Icon: typeof Sun; label: string; next: string }> = {
  light: { Icon: Sun, label: "Light", next: "Dark" },
  dark: { Icon: Moon, label: "Dark", next: "Bright dark" },
  bright: { Icon: MoonStar, label: "Bright dark", next: "Light" }
};

interface Props {
  appearance: Appearance;
  onCycle: () => void;
  size?: number;
  className?: string;
}

/** One button that steps through Light -> Dark -> Bright dark. The icon shows the
 *  current mode; the tooltip says what a tap switches to. */
export function AppearanceToggle({ appearance, onCycle, size = 16, className }: Props) {
  const { Icon, label, next } = META[appearance];
  const text = `${label} mode — tap to switch to ${next}`;
  return (
    <button onClick={onCycle} aria-label={text} title={text} className={className}>
      <Icon key={appearance} size={size} strokeWidth={2.2} className="animate-pop" />
    </button>
  );
}

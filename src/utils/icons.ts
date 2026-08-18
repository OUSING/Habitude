import {
  Dumbbell,
  BookOpen,
  Droplet,
  Moon,
  Sun,
  Heart,
  Brain,
  Salad,
  Pill,
  PenLine,
  Music,
  Bike,
  Footprints,
  Coffee,
  Sparkles,
  Wallet,
  Code,
  Guitar,
  Leaf,
  Smile,
  CheckCircle2,
  type LucideIcon
} from "lucide-react";

/**
 * Small curated set rather than exposing all ~1500 lucide icons — keeps
 * the picker fast to scan on a phone-width grid and keeps every habit's
 * meaning legible at a glance.
 */
export const ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  book: BookOpen,
  water: Droplet,
  sleep: Moon,
  sun: Sun,
  heart: Heart,
  mind: Brain,
  food: Salad,
  pill: Pill,
  write: PenLine,
  music: Music,
  bike: Bike,
  walk: Footprints,
  coffee: Coffee,
  sparkle: Sparkles,
  money: Wallet,
  code: Code,
  guitar: Guitar,
  nature: Leaf,
  smile: Smile,
  check: CheckCircle2
};

export const ICON_KEYS = Object.keys(ICONS);

export function defaultIcon(): string {
  // "check" rather than ICON_KEYS[0] — new habits/to-dos start out showing
  // the checkmark icon by default, since that's what most quick-added
  // items (a plain checklist entry) actually represent.
  return "check";
}

export function getIcon(key: string | undefined): LucideIcon {
  return (key && ICONS[key]) || CheckCircle2;
}

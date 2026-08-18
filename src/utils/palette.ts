export const PALETTE = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#FFFFFF", // White — replaces Pink
  "#A3B18A", // Sage green — replaces Pink
  "#9CA3AF"  // Grey — replaces Pink
] as const;

export function paletteDefault(): string {
  return PALETTE[0];
}

/** Converts "#RRGGBB" to a "r g b" triplet string, the format every
 *  --color-* CSS variable in index.css is stored in (so it can be used
 *  as `rgb(var(--color-x))` and still support Tailwind's opacity modifiers). */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Mixes a hex color toward white by `amount` (0–1) — used to derive a
 *  soft "light" tint of a custom accent for badges/pills. */
export function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `${mix(r)} ${mix(g)} ${mix(b)}`;
}

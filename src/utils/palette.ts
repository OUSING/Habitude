export const PALETTE = [
  // https://coolors.co/palette/5f0f40-9a031e-fb8b24-e36414-0f4c5c
  "#5F0F40", // plum
  "#9A031E", // dark red
  "#FB8B24", // orange
  "#E36414", // burnt orange
  "#0F4C5C", // dark teal

  // https://coolors.co/palette/03071e-370617-6a040f-9d0208-d00000-dc2f02-e85d04-f48c06-faa307-ffba08
  "#03071E", // near-black navy
  "#370617", // dark maroon
  "#6A040F", // oxblood
  "#9D0208", // red
  "#D00000", // bright red
  "#DC2F02", // red-orange
  "#E85D04", // orange
  "#F48C06", // amber orange
  "#FAA307", // gold
  "#FFBA08", // yellow-orange

  // https://coolors.co/palette/31054e-7e35af-b84cff-d9a7ff-72259b-4b1765-37055e
  "#31054E", // deep violet
  "#7E35AF", // purple
  "#B84CFF", // bright violet
  "#D9A7FF", // light lavender
  "#72259B", // grape
  "#4B1765", // dark purple
  "#37055E"  // midnight violet
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

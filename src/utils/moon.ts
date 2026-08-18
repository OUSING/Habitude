/**
 * Real-world moon phase calculation. No dependencies — just the synodic
 * month length and one known new-moon reference date, projected forward
 * (or backward) to whatever date is passed in.
 */

const SYNODIC_MONTH_DAYS = 29.530588853; // average new-moon-to-new-moon length
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0); // Jan 6 2000, 18:14 UTC

export type MoonPhaseName =
  | "New Moon"
  | "Waxing Crescent"
  | "First Quarter"
  | "Waxing Gibbous"
  | "Full Moon"
  | "Waning Gibbous"
  | "Last Quarter"
  | "Waning Crescent";

export interface MoonPhase {
  /** 0 = new moon, 0.5 = full moon, back to 1 = new moon again. */
  phase: number;
  /** Fraction of the disc lit, 0..1. */
  illumination: number;
  /** Days elapsed since the most recent new moon. */
  age: number;
  name: MoonPhaseName;
}

function phaseName(phase: number): MoonPhaseName {
  if (phase < 0.0625 || phase >= 0.9375) return "New Moon";
  if (phase < 0.1875) return "Waxing Crescent";
  if (phase < 0.3125) return "First Quarter";
  if (phase < 0.4375) return "Waxing Gibbous";
  if (phase < 0.5625) return "Full Moon";
  if (phase < 0.6875) return "Waning Gibbous";
  if (phase < 0.8125) return "Last Quarter";
  return "Waning Crescent";
}

/** Computes today's (or any date's) moon phase. */
export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const diffDays = (date.getTime() - KNOWN_NEW_MOON_UTC) / 86400000;
  let phase = (diffDays % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
  if (phase < 0) phase += 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { phase, illumination, age: phase * SYNODIC_MONTH_DAYS, name: phaseName(phase) };
}

/**
 * Builds an SVG path (centered on 0,0) for the lit portion of a moon disc
 * at a given phase, radius `r`. Two half-arcs: one traces the outer edge
 * of the illuminated hemisphere, the other traces the terminator (the
 * curved line between light and shadow), whose "width" is r*cos(theta).
 */
export function moonPhasePath(phase: number, r: number): string {
  const theta = phase * Math.PI * 2;
  const rx = Math.abs(r * Math.cos(theta));
  const outerSweep = phase < 0.5 ? 1 : 0;
  const terminatorSweep = phase < 0.25 || phase > 0.75 ? 1 : 0;
  return [
    `M 0,${-r}`,
    `A ${r},${r} 0 1 ${outerSweep} 0,${r}`,
    `A ${rx},${r} 0 1 ${terminatorSweep} 0,${-r}`,
    "Z"
  ].join(" ");
}

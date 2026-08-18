import { useEffect, useMemo, useState } from "react";
import { getMoonPhase, moonPhasePath } from "../utils/moon";

/**
 * Alternative to <AmbientBackground /> — a quiet night sky with the real
 * current moon phase rendered large, a scattering of twinkling stars, and
 * a slow-drifting trail of small moons stepping through the rest of the
 * lunar cycle. Colors read from the same CSS variables as the rest of the
 * UI so it still matches whichever theme (light/dark/orange/green) is active.
 */

interface Star {
  id: number;
  left: number; // %
  top: number; // %
  size: number; // px
  duration: number; // s
  delay: number; // s
}

function seededStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 4 + ((i * 41) % 92),
    top: 4 + ((i * 31) % 70),
    size: 1.5 + ((i * 7) % 3),
    duration: 3 + ((i * 5) % 4),
    delay: -((i * 3) % 6)
  }));
}

// The 8 canonical phases of the cycle, evenly spaced, drifting faintly
// in the background behind the big "current phase" moon.
const CYCLE_PHASES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

function seededCycleMoons(current: number) {
  return CYCLE_PHASES.map((phase, i) => ({
    id: i,
    phase,
    isCurrentStep: Math.abs(phase - current) < 1 / 16,
    left: 8 + ((i * 27) % 84),
    top: 12 + ((i * 19) % 76),
    size: 15 + ((i * 4) % 8),
    duration: 16 + ((i * 6) % 10),
    driftX: (i % 2 === 0 ? 1 : -1) * (10 + ((i * 8) % 16)),
    driftY: (i % 3 === 0 ? 1 : -1) * (8 + ((i * 6) % 14))
  }));
}

export function MoonPhaseBackground() {
  const [now, setNow] = useState(() => new Date());
  const stars = useMemo(() => seededStars(22), []);

  // Decorative only — refreshing hourly is plenty to keep the phase and
  // any midnight rollover accurate without doing real work every render.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const moon = useMemo(() => getMoonPhase(now), [now]);
  const cycleMoons = useMemo(() => seededCycleMoons(moon.phase), [moon.phase]);
  const bigPath = useMemo(() => moonPhasePath(moon.phase, 48), [moon.phase]);
  const illumPct = Math.round(moon.illumination * 100);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Twinkling stars */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute animate-twinkle rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: "rgb(var(--color-ink) / 0.55)",
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`
          }}
        />
      ))}

      {/* Small moons drifting through the rest of the cycle */}
      {cycleMoons.map((m) => (
        <span
          key={m.id}
          className="absolute animate-icon-drift"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            opacity: m.isCurrentStep ? 0.22 : 0.11,
            animationDuration: `${m.duration}s`,
            ["--icon-drift-x" as string]: `${m.driftX}px`,
            ["--icon-drift-y" as string]: `${m.driftY}px`
          }}
        >
          <svg width={m.size} height={m.size} viewBox="-50 -50 100 100">
            <circle r={48} fill="rgb(var(--color-muted) / 0.4)" />
            <path d={moonPhasePath(m.phase, 48)} fill="rgb(var(--color-accent-light))" />
          </svg>
        </span>
      ))}

      {/* Glow + the real, current-phase moon */}
      <div
        className="absolute right-8 top-16 h-32 w-32 animate-moon-glow rounded-full"
        style={{ background: "rgb(var(--color-brand) / 0.22)", filter: "blur(28px)" }}
      />
      <div className="absolute right-10 top-[4.75rem] flex flex-col items-center">
        <svg width={104} height={104} viewBox="-50 -50 100 100">
          <circle r={48} fill="rgb(var(--color-muted) / 0.3)" />
          <path d={bigPath} fill="rgb(var(--color-accent-light))" />
          {/* Faint craters, clipped to the disc, purely textural */}
          <clipPath id="moon-disc-clip">
            <circle r={48} />
          </clipPath>
          <g clipPath="url(#moon-disc-clip)" fill="rgb(var(--color-ink) / 0.08)">
            <circle cx={-14} cy={-10} r={7} />
            <circle cx={10} cy={6} r={10} />
            <circle cx={-4} cy={20} r={5} />
          </g>
        </svg>
        <span className="mt-1 text-[10px] font-semibold text-muted opacity-70">
          {moon.name} · {illumPct}%
        </span>
      </div>
    </div>
  );
}

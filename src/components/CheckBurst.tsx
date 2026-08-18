import { useEffect, useState } from "react";

interface Props {
  /** Flip this (e.g. increment a counter) each time you want the burst to replay. */
  triggerKey: number;
  color: string;
}

const PARTICLES = 8;

/**
 * A short-lived ring of particles that fires outward from the center of
 * whatever it's absolutely-positioned inside of. Purely decorative —
 * unmounts itself after the animation finishes so it never sits in the DOM.
 */
export function CheckBurst({ triggerKey, color }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (triggerKey === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 550);
    return () => clearTimeout(t);
  }, [triggerKey]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {Array.from({ length: PARTICLES }).map((_, i) => {
        const angle = (360 / PARTICLES) * i;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full animate-burst"
            style={{
              backgroundColor: color,
              // Each particle travels along its own angle via a CSS var
              // consumed by the `burst` keyframes in tailwind.config.js.
              ["--burst-angle" as string]: `${angle}deg`,
              animationDelay: `${i * 8}ms`
            }}
          />
        );
      })}
      <span
        className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full border-solid animate-ring-pop"
        style={{ borderColor: color }}
      />
    </div>
  );
}

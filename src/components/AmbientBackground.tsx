import { useMemo } from "react";
import { Heart, Sparkles, Star, Flame, Droplet, Leaf } from "lucide-react";

/**
 * Purely decorative background: a few slow blurred blobs, a stream of
 * rising bubbles, and faint drifting icons. Colors read from the same
 * CSS variables the rest of the UI uses (--color-brand / --color-accent),
 * so everything automatically matches whichever theme is active.
 */

const BUBBLE_ICONS = [Heart, Sparkles, Star, Flame, Droplet, Leaf];

interface Bubble {
  id: number;
  left: number; // vw
  size: number; // px
  duration: number; // s
  delay: number; // s
  opacity: number;
  drift: number; // px
}

interface FloatingIcon {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  driftX: number;
  driftY: number;
  Icon: (typeof BUBBLE_ICONS)[number];
}

function seededBubbles(count: number): Bubble[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 6 + ((i * 37) % 88),
    size: 10 + ((i * 13) % 26),
    duration: 14 + ((i * 7) % 12),
    delay: -((i * 5) % 20),
    opacity: 0.12 + ((i * 3) % 5) * 0.03,
    drift: ((i % 2 === 0 ? 1 : -1) * (10 + ((i * 11) % 30)))
  }));
}

function seededIcons(count: number): FloatingIcon[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 10 + ((i * 29) % 80),
    top: 8 + ((i * 23) % 82),
    size: 16 + ((i * 5) % 10),
    duration: 10 + ((i * 4) % 8),
    driftX: (i % 2 === 0 ? 1 : -1) * (8 + ((i * 6) % 14)),
    driftY: (i % 3 === 0 ? 1 : -1) * (10 + ((i * 9) % 16)),
    Icon: BUBBLE_ICONS[i % BUBBLE_ICONS.length]
  }));
}

export function AmbientBackground({ theme }: { theme: string }) {
  const bubbles = useMemo(() => seededBubbles(10), []);
  const icons = useMemo(() => seededIcons(6), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Rising bubbles */}
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="absolute bottom-0 rounded-full animate-bubble-rise"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            background: "rgb(var(--color-brand) / 0.5)",
            boxShadow: "inset -2px -2px 4px rgb(var(--color-bg) / 0.25)",
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            ["--bubble-opacity" as string]: b.opacity,
            ["--bubble-drift" as string]: `${b.drift}px`
          }}
        />
      ))}

      {theme === "christmas" && (
        <div className="seasonal-snowfall" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className="snowflake" style={{ left: `${(i * 37) % 101}%`, animationDelay: `${-((i * 1.7) % 9)}s`, animationDuration: `${7 + (i % 6)}s`, fontSize: `${10 + (i % 4) * 4}px` }}>❄</span>
          ))}
        </div>
      )}
      {theme === "halloween" && (
        <div className="seasonal-halloween" aria-hidden="true">
          <span className="floating-spirit spirit-kind">👻</span>
          <span className="floating-spirit spirit-scary">👻</span>
          <span className="floating-pumpkin pumpkin-kind">🎃</span>
          <span className="floating-pumpkin pumpkin-scary">🎃</span>
        </div>
      )}

      {/* Faint drifting icons */}
      {icons.map(({ id, left, top, size, duration, driftX, driftY, Icon }) => (
        <span
          key={id}
          className="absolute animate-icon-drift text-brand"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            opacity: 0.1,
            animationDuration: `${duration}s`,
            ["--icon-drift-x" as string]: `${driftX}px`,
            ["--icon-drift-y" as string]: `${driftY}px`
          }}
        >
          <Icon size={size} strokeWidth={1.6} />
        </span>
      ))}
    </div>
  );
}

import { Minus, Plus } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface Props {
  value: number;
  target: number;
  unit: string;
  color: string;
  onChange: (value: number) => void;
  step?: number;
}

// Keeps the stepper's taps from being picked up by the SwipeToDelete
// gesture tracker that wraps the whole card (it listens for pointer
// activity anywhere inside it) — without this, a tap on +/- could get
// treated as the start of a swipe instead of a plain click.
function stopPointer(e: ReactPointerEvent) {
  e.stopPropagation();
}

export function MeasurementStepper({ value, target, unit, color, onChange, step = 1 }: Props) {
  return (
    <div
      className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-2 py-1.5 animate-pop"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={stopPointer}
      onPointerMove={stopPointer}
      onPointerUp={stopPointer}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange(Math.max(0, value - step));
        }}
        aria-label="Decrease"
        className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink active:scale-90"
      >
        <Minus size={15} />
      </button>

      <div className="flex-1 text-center">
        <span className="font-mono text-sm font-bold text-ink">{value}</span>
        <span className="text-[11px] text-muted"> / {target} {unit}</span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange(value + step);
        }}
        aria-label="Increase"
        className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white active:scale-90"
        style={{ backgroundColor: color }}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

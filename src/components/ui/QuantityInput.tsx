import { useState, type ChangeEvent } from "react";
import { Plus, Minus } from "lucide-react";

interface Props {
  initialValue: number;
  target: number;
  unit: string;
  color: string;
  title: string;
  onSave: (value: number) => void;
  onCancel: () => void;
}

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function QuantityInput({
  initialValue,
  target,
  unit,
  color,
  title,
  onSave,
  onCancel
}: Props) {
  const [value, setValue] = useState<number>(initialValue);

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.value === "") {
      setValue(0);
      return;
    }
    const next = Number(e.target.value);
    if (Number.isNaN(next)) return;
    setValue(Math.max(0, next));
  }

  function adjust(amount: number) {
    setValue((v) => {
      const result = v + amount;
      // Format to avoid floating point issues (e.g. 0.1 + 0.2 = 0.30000000004)
      return Math.max(0, Math.round(result * 100) / 100);
    });
  }

  // Calculate quick-preset buttons based on the target value
  const presets = (() => {
    if (target <= 5) {
      return [-1, 1, 2];
    } else if (target <= 15) {
      return [-2, -1, 1, 2];
    } else if (target <= 50) {
      return [-5, -1, 1, 5];
    } else if (target <= 200) {
      return [-25, -10, 10, 25];
    } else {
      // For large targets (e.g. 2000ml water or 10000 steps)
      const base = Math.round(target / 10); // e.g. 200 or 1000
      const step1 = Math.round(target / 4);  // e.g. 500 or 2500
      return [-step1, -base, base, step1];
    }
  })();

  const progress = target > 0 ? Math.min(1, value / target) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const reached = target > 0 && value >= target;

  return (
    <div className="flex w-full max-w-sm mx-auto flex-col items-center gap-5 px-1 pb-1 animate-pop" onClick={(e) => e.stopPropagation()}>
      {/* Date Title Context */}
      {title && (
        <span className="text-xs font-semibold text-muted tracking-wide uppercase">
          {title}
        </span>
      )}

      {/* Progress ring with stepper controls */}
      <div className="relative flex h-[176px] w-[176px] items-center justify-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={RING_RADIUS} fill="none" stroke={`${color}1f`} strokeWidth="9" />
          <circle
            cx="60"
            cy="60"
            r={RING_RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset .25s ease" }}
          />
        </svg>

        <button
          type="button"
          onClick={() => adjust(-1)}
          aria-label="Decrease"
          className="tap-target absolute left-0 flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 border-2 bg-surface"
          style={{ borderColor: `${color}40`, color: color }}
        >
          <Minus size={16} strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value === 0 ? "" : value}
            placeholder="0"
            onChange={handleInputChange}
            className="w-[88px] text-center text-3xl font-extrabold bg-transparent text-ink outline-none"
            style={{ caretColor: color }}
          />
          <span className="text-[11px] font-semibold text-muted -mt-1">{unit}</span>
        </div>

        <button
          type="button"
          onClick={() => adjust(1)}
          aria-label="Increase"
          className="tap-target absolute right-0 flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Target Goal Label */}
      <span className="text-[12.5px] font-medium text-muted -mt-2">
        {reached ? (
          <span className="font-semibold" style={{ color }}>Goal reached 🎉</span>
        ) : (
          <>Goal: <span className="font-mono font-semibold text-ink">{target}</span> {unit}</>
        )}
      </span>

      {/* Quick Add Presets */}
      <div className="flex flex-wrap justify-center gap-1.5 w-full">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => adjust(preset)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 border"
            style={{
              backgroundColor: `${color}0c`,
              borderColor: `${color}26`,
              color: color
            }}
          >
            {preset > 0 ? `+${preset}` : preset}
          </button>
        ))}
      </div>

      {/* Action Dialog Buttons */}
      <div className="flex gap-2 w-full mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="tap-target flex-1 rounded-xl bg-surface-2 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-border active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(value)}
          className="tap-target flex-1 rounded-xl py-3 text-[13px] font-semibold text-white transition-all shadow-sm active:scale-[0.98]"
          style={{ backgroundColor: color }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

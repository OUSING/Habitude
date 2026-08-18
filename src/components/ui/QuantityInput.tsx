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

  return (
    <div className="flex w-full max-w-sm mx-auto flex-col items-center gap-4 px-1 pb-1 animate-pop" onClick={(e) => e.stopPropagation()}>
      {/* Date Title Context */}
      {title && (
        <span className="text-xs font-semibold text-muted tracking-wide uppercase">
          {title}
        </span>
      )}

      {/* Stepper controls */}
      <div className="flex items-center justify-center gap-4 w-full max-w-[260px]">
        <button
          type="button"
          onClick={() => adjust(-1)}
          className="tap-target flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 border-2"
          style={{ borderColor: `${color}40`, color: color }}
        >
          <Minus size={16} strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center min-w-[80px]">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value === 0 ? "" : value}
            placeholder="0"
            onChange={handleInputChange}
            className="w-full text-center text-2xl font-bold bg-transparent text-ink outline-none"
            style={{ caretColor: color }}
          />
          <div className="h-0.5 w-16 mt-1 rounded-full" style={{ backgroundColor: color }} />
        </div>

        <button
          type="button"
          onClick={() => adjust(1)}
          className="tap-target flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Target Goal Label */}
      <span className="text-[12.5px] font-medium text-muted">
        Goal: <span className="font-mono font-semibold text-ink">{target}</span> {unit}
      </span>

      {/* Quick Add Presets */}
      <div className="flex flex-wrap justify-center gap-1.5 w-full mt-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => adjust(preset)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 border"
            style={{
              backgroundColor: `${color}08`,
              borderColor: `${color}20`,
              color: color
            }}
          >
            {preset > 0 ? `+${preset}` : preset}
          </button>
        ))}
      </div>

      {/* Action Dialog Buttons */}
      <div className="flex gap-2 w-full mt-2">
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

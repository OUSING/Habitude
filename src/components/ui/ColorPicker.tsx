import { Check } from "lucide-react";
import { PALETTE } from "../../utils/palette";

interface Props {
  value: string;
  onChange: (color: string) => void;
}

/**
 * Small circular swatches that wrap across rows, rather than a few big
 * squares — this leaves room for a much bigger palette (see utils/palette)
 * while keeping every swatch a proper 44px tap target underneath.
 */
export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="habit-color-palette" role="radiogroup" aria-label="Habit color">
      {PALETTE.map((color) => {
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            className="habit-color-swatch tap-target flex items-center justify-center rounded-full transition-transform duration-100 active:scale-90"
          >
            <span
              className="flex items-center justify-center rounded-full transition-all duration-150"
              style={{
                backgroundColor: color,
                width: selected ? 28 : 22,
                height: selected ? 28 : 22,
                boxShadow: selected ? `0 0 0 2px rgb(var(--color-surface)), 0 0 0 3px ${color}` : "none"
              }}
            >
              {selected && <Check size={12} color="#fff" strokeWidth={3.5} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

import { Check } from "lucide-react";
import { PALETTE } from "../../utils/palette";

interface Props {
  value: string;
  onChange: (color: string) => void;
}

const LABELS = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "White", "Sage green", "Grey"];

/** Keeps the original habit colors and replaces the old Pink option with three neutral options. */
export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="habit-color-palette" role="radiogroup" aria-label="Habit color">
      {PALETTE.map((color, index) => {
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LABELS[index]}
            title={LABELS[index]}
            onClick={() => onChange(color)}
            className="habit-color-swatch tap-target"
            style={{ backgroundColor: color }}
          >
            {selected && <Check size={18} color={color === "#FFFFFF" ? "#4B5563" : "#fff"} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

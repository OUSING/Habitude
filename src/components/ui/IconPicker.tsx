import { ICON_KEYS, getIcon } from "../../utils/icons";

interface Props {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, color, onChange }: Props) {
  return (
    <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-8" role="radiogroup" aria-label="Habit icon">
      {ICON_KEYS.map((key) => {
        const Icon = getIcon(key);
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={key}
            onClick={() => onChange(key)}
            className={[
              "tap-target mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-100 active:scale-90",
              selected ? "" : "bg-surface-2"
            ].join(" ")}
            style={
              selected
                ? { backgroundColor: `${color}22`, color, boxShadow: `0 0 0 2px ${color}` }
                : undefined
            }
          >
            <Icon size={20} strokeWidth={2.2} className={selected ? "" : "text-muted"} />
          </button>
        );
      })}
    </div>
  );
}

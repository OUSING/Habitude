import type { Weekday } from "../../types/habit";

interface Props {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
  /** Optional accent used for active days — falls back to the app's
   *  default brand color when omitted. */
  activeColor?: string;
}

const LABELS: { day: Weekday; label: string }[] = [
  { day: 1, label: "L" },
  { day: 2, label: "M" },
  { day: 3, label: "M" },
  { day: 4, label: "J" },
  { day: 5, label: "V" },
  { day: 6, label: "S" },
  { day: 0, label: "D" }
];

export function WeekdaySelector({ value, onChange, activeColor }: Props) {
  function toggle(day: Weekday) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());
  }

  return (
    <div className="flex justify-between gap-1.5" role="group" aria-label="Days of the week">
      {LABELS.map(({ day, label }) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={active}
            className={[
              "tap-target flex-1 rounded-full text-sm font-bold transition-colors duration-100",
              active ? "text-white" : "bg-surface-2 text-muted active:bg-border"
            ].join(" ")}
            style={active ? { backgroundColor: activeColor || "rgb(var(--color-brand))" } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

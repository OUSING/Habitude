import type { Weekday } from "../../types/habit";

interface Props {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
  /** Optional accent used for active days — falls back to the app's
   *  default brand color when omitted. */
  activeColor?: string;
  activeTextColor?: string;
}

// Same day order and single-letter labels as the Todo list's custom-repeat
// picker, so the two "which days" pickers in the app look and behave alike
// instead of one using French initials and the other English.
const LABELS: { day: Weekday; label: string }[] = [
  { day: 1, label: "M" },
  { day: 2, label: "T" },
  { day: 3, label: "W" },
  { day: 4, label: "T" },
  { day: 5, label: "F" },
  { day: 6, label: "S" },
  { day: 0, label: "S" }
];

const DAY_NAMES: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday"
};

export function WeekdaySelector({ value, onChange, activeColor, activeTextColor }: Props) {
  function toggle(day: Weekday) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());
  }

  return (
    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days of the week">
      {LABELS.map(({ day, label }) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={active}
            aria-label={DAY_NAMES[day]}
            title={DAY_NAMES[day]}
            className={[
              "tap-target aspect-square rounded-full text-sm font-bold transition-colors duration-100",
              active ? "text-white" : "bg-surface-2 text-muted active:bg-border"
            ].join(" ")}
            style={active ? { backgroundColor: activeColor || "rgb(var(--color-brand))", color: activeTextColor || "#fff" } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

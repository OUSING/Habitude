import { Bell, BellOff } from "lucide-react";

interface Props {
  /** "HH:MM" or undefined if no reminder is set. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/**
 * Native <input type="time"> is deliberately used instead of a custom
 * picker — on iOS/Android WebViews it renders the platform's own wheel
 * picker, which is faster to use and instantly familiar to users.
 */
export function TimePicker({ value, onChange }: Props) {
  const enabled = value !== undefined;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2 text-ink">
        {enabled ? <Bell size={18} /> : <BellOff size={18} className="text-muted" />}
        <span className="text-[15px] font-medium">Daily reminder</span>
      </div>

      {enabled ? (
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tap-target rounded-lg bg-surface px-2 text-[15px] font-mono text-ink"
          aria-label="Reminder time"
        />
      ) : (
        <button
          type="button"
          onClick={() => onChange("08:00")}
          className="tap-target rounded-lg bg-surface px-3 text-sm font-semibold text-brand active:bg-border"
        >
          Enable
        </button>
      )}

      {enabled && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="tap-target shrink-0 rounded-lg px-2 text-xs font-semibold text-muted active:bg-surface"
        >
          Remove
        </button>
      )}
    </div>
  );
}

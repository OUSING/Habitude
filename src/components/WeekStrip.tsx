import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isHabitScheduledOn, monthDates, todayStr, weekdayLetter } from "../utils/date";
import { useHabits, useLogsInRange } from "../hooks/useHabits";

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function WeekStrip({ selectedDate, onSelect }: Props) {
  const dates = monthDates(selectedDate);
  const habits = useHabits();
  const logs = useLogsInRange(dates[0], dates[dates.length - 1]);
  const today = todayStr();
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Jump straight to the selected day (today, by default) on open and
  // whenever the visible month changes, so people never have to scroll
  // to find it themselves.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [dates[0]]);

  // The strip can hold a whole month of dates, wider than the viewport —
  // dragging it isn't obvious (especially with a mouse), so these chevrons
  // page it a few days at a time as a click-friendly alternative.
  function scrollBy(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.7, 140), behavior: "smooth" });
  }

  function ratioFor(date: string): number {
    const scheduled = habits.filter((h) => isHabitScheduledOn(h.frequency, date));
    if (scheduled.length === 0) return 0;
    const doneIds = new Set(
      logs.filter((l) => l.completed && l.date === date).map((l) => l.habitId)
    );
    const done = scheduled.filter((h) => doneIds.has(h.id!)).length;
    return done / scheduled.length;
  }

  // deg is passed to a conic-gradient below to draw each day's progress
  // ring — how much of that day's habits are already checked off.

  return (
    <div className="week-strip-wrap">
      <button
        type="button"
        className="week-strip-nav week-strip-nav-left"
        onClick={() => scrollBy(-1)}
        aria-label="Scroll days left"
      >
        <ChevronLeft size={14} strokeWidth={2.4} />
      </button>

      <div ref={scrollRef} className="week-strip-scroll no-scrollbar flex overflow-x-auto">
        {dates.map((date) => {
          const selected = date === selectedDate;
          const isToday = date === today;
          const ratio = ratioFor(date);
          const complete = ratio >= 1 && ratio > 0;
          const dayNum = Number(date.slice(-2));
          const deg = Math.round(ratio * 360);

          return (
            <button
              key={date}
              ref={selected ? selectedRef : undefined}
              onClick={() => onSelect(date)}
              className={[
                "week-strip-day tap-target",
                selected ? "is-selected" : "",
                isToday ? "is-today" : "",
                complete ? "is-complete" : ""
              ].join(" ").trim()}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              aria-label={isToday ? `${date} (today)` : date}
            >
              <span className="week-strip-day-label">{weekdayLetter(date)}</span>
              <span
                className={["week-strip-day-ring", ratio <= 0 ? "is-empty" : ""].join(" ").trim()}
                style={
                  ratio > 0 && !selected
                    ? {
                        backgroundImage: `conic-gradient(rgb(var(--color-brand)) ${deg}deg, rgb(var(--color-border)) ${deg}deg 360deg)`
                      }
                    : undefined
                }
              >
                <span className="week-strip-day-core">{dayNum}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="week-strip-nav week-strip-nav-right"
        onClick={() => scrollBy(1)}
        aria-label="Scroll days right"
      >
        <ChevronRight size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
}

import { monthDates, todayStr, weekdayLetter } from "../utils/date";

interface Props {
  selectedDate?: string;
}

/**
 * Sits above the stack of LoopHabitRow cards in the "loop" view.
 * Aligns the day letters and numbers to the right-aligned horizontal grid of circles in each row,
 * using an empty spacer on the left to perfectly match the flexbox layout of the habit rows.
 */
export function LoopDaysHeader({ selectedDate = todayStr() }: Props) {
  const dates = monthDates(selectedDate);
  const today = todayStr();

  return (
    <div className="flex min-w-max items-center px-3 py-1.5">
      {/* Spacer matching the left column width (habit icon + text details) in LoopHabitRow */}
      <div className="sticky left-0 z-30 w-[170px] shrink-0 self-stretch bg-surface pinned-habit-column" />

      {/* Days headers matching the row cells */}
      <div className="flex items-center gap-1.5 ml-2 py-0.5">
        {dates.map((date) => {
          const isToday = date === today;
          const dayNum = Number(date.slice(-2));

          return (
            <div key={date} className="w-7 flex flex-col items-center justify-center">
              <span
                className={[
                  "text-center text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5",
                  isToday ? "text-brand" : "text-muted/70"
                ].join(" ")}
              >
                {weekdayLetter(date)}
              </span>
              <span
                className={[
                  "font-mono text-[9px] leading-none",
                  isToday ? "font-bold text-brand" : "text-muted/50"
                ].join(" ")}
              >
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

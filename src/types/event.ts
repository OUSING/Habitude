/** A calendar event — separate from to-dos, which show up on the calendar
 *  too (via their due date/time) but live in their own table. */
export interface CalEvent {
  /** Auto-incremented by Dexie — absent until the record is first saved. */
  id?: number;
  title: string;
  /** Start date, local "YYYY-MM-DD". */
  date: string;
  /** Last day for multi-day all-day events. Absent = single day. */
  endDate?: string;
  allDay: boolean;
  /** Local 24h "HH:MM". Only for timed events. */
  startTime?: string;
  endTime?: string;
  /** Hex color, one of PALETTE. */
  color: string;
  note?: string;
  createdAt: number;
}

export type NewCalEvent = Omit<CalEvent, "id" | "createdAt">;

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../services/db";
import type { CalEvent } from "../types/event";

/** Every calendar event, reactive. The table is small (personal calendar),
 *  so the calendar filters per-day in memory rather than range-querying. */
export function useEvents(): CalEvent[] {
  const events = useLiveQuery(() => db.events.toArray(), []);
  return events ?? [];
}

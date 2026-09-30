import { db } from "./db";
import type { CalEvent, NewCalEvent } from "../types/event";

export async function createEvent(input: NewCalEvent): Promise<CalEvent> {
  const ev: CalEvent = { ...input, createdAt: Date.now() };
  const id = await db.events.add(ev);
  return { ...ev, id };
}

export async function updateEvent(id: number, changes: Partial<NewCalEvent>): Promise<void> {
  await db.events.update(id, changes);
}

export async function deleteEvent(id: number): Promise<void> {
  await db.events.delete(id);
}

import {
  BUFFER_MIN,
  LUNCH_MIN,
  LUNCH_WINDOW_END,
  LUNCH_WINDOW_START,
  SHIFT_END,
  SHIFT_START,
  SLOT_STEP_MIN,
} from "../config";

/** Busy interval in local minutes, [start, end). `end` already includes the buffer. */
export interface Interval {
  start: number;
  end: number;
}

export interface TherapistDay {
  id: string;
  busy: Interval[];
}

export interface RoomDay {
  id: number;
  busy: Interval[];
}

export interface SlotRequest {
  durationMin: number;
  therapistsRequired: number; // 2 for couples (also needs 2 rooms)
  /** Therapists on shift that day, qualified, not absent. */
  therapists: TherapistDay[];
  rooms: RoomDay[];
  preferredTherapistId?: string | null;
  /** Earliest allowed start in minutes (e.g. now + lead time for today). */
  notBefore?: number;
}

export interface Slot {
  start: number;
  end: number;
  therapistIds: string[];
  roomIds: number[];
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Earliest start of a free 30-min lunch inside 12:00–14:00, or null if none fits. */
export function placeLunch(busy: Interval[]): number | null {
  for (let t = LUNCH_WINDOW_START; t + LUNCH_MIN <= LUNCH_WINDOW_END; t += 5) {
    const lunch = { start: t, end: t + LUNCH_MIN };
    if (!busy.some((b) => overlaps(b, lunch))) return t;
  }
  return null;
}

/** Interval a booking occupies for therapist & room: procedure + rest/prep buffer. */
export function blockedInterval(start: number, durationMin: number): Interval {
  return { start, end: start + durationMin + BUFFER_MIN };
}

export function therapistCanTake(busy: Interval[], start: number, durationMin: number): boolean {
  if (start < SHIFT_START || start + durationMin > SHIFT_END) return false;
  const block = blockedInterval(start, durationMin);
  if (busy.some((b) => overlaps(b, block))) return false;
  // The therapist must still be able to take a 30-min lunch between 12:00 and 14:00.
  return placeLunch([...busy, block]) !== null;
}

export function roomFree(busy: Interval[], start: number, durationMin: number): boolean {
  const block = blockedInterval(start, durationMin);
  return !busy.some((b) => overlaps(b, block));
}

const load = (t: TherapistDay) => t.busy.reduce((s, b) => s + (b.end - b.start), 0);

/** Picks therapists/rooms for one candidate start, or null if impossible. */
export function assignAt(req: SlotRequest, start: number): Slot | null {
  const { durationMin, therapistsRequired } = req;
  const able = req.therapists.filter((t) => therapistCanTake(t.busy, start, durationMin));
  let chosen: TherapistDay[];
  if (req.preferredTherapistId) {
    const pref = able.find((t) => t.id === req.preferredTherapistId);
    if (!pref) return null;
    const others = able.filter((t) => t.id !== pref.id).sort((a, b) => load(a) - load(b) || a.id.localeCompare(b.id));
    chosen = [pref, ...others].slice(0, therapistsRequired);
  } else {
    chosen = [...able].sort((a, b) => load(a) - load(b) || a.id.localeCompare(b.id)).slice(0, therapistsRequired);
  }
  if (chosen.length < therapistsRequired) return null;

  const rooms = req.rooms
    .filter((r) => roomFree(r.busy, start, durationMin))
    .sort((a, b) => a.id - b.id)
    .slice(0, therapistsRequired);
  if (rooms.length < therapistsRequired) return null;

  return {
    start,
    end: start + durationMin,
    therapistIds: chosen.map((t) => t.id),
    roomIds: rooms.map((r) => r.id),
  };
}

/** All bookable starts for a day on a 15-minute grid. */
export function computeSlots(req: SlotRequest): Slot[] {
  const slots: Slot[] = [];
  const first = Math.max(SHIFT_START, req.notBefore ?? 0);
  const firstAligned = Math.ceil(first / SLOT_STEP_MIN) * SLOT_STEP_MIN;
  for (let start = firstAligned; start + req.durationMin <= SHIFT_END; start += SLOT_STEP_MIN) {
    const slot = assignAt(req, start);
    if (slot) slots.push(slot);
  }
  return slots;
}

import { describe, expect, it } from "vitest";
import { assignAt, computeSlots, placeLunch, therapistCanTake } from "./availability";

const H = (h: number, m = 0) => h * 60 + m;
const rooms = (n = 3) => Array.from({ length: n }, (_, i) => ({ id: i + 1, busy: [] }));

describe("availability", () => {
  it("blocks the 20-minute buffer after a procedure", () => {
    // 60-min massage 10:00–11:00 → blocked until 11:20
    const busy = [{ start: H(10), end: H(11, 20) }];
    expect(therapistCanTake(busy, H(11), 60)).toBe(false);
    expect(therapistCanTake(busy, H(11, 15), 60)).toBe(false);
    expect(therapistCanTake(busy, H(11, 20), 30)).toBe(true);
  });

  it("requires procedures to end by 19:00", () => {
    expect(therapistCanTake([], H(18), 60)).toBe(true);
    expect(therapistCanTake([], H(18, 15), 60)).toBe(false);
    expect(therapistCanTake([], H(9, 45), 30)).toBe(false);
  });

  it("keeps a 30-minute lunch possible between 12:00 and 14:00", () => {
    const busy = [{ start: H(11), end: H(12, 50) }];
    // leaves 12:50–13:20 free for lunch
    expect(therapistCanTake(busy, H(13, 20), 20)).toBe(true);
    // 12:50–14:10 would leave no 30-min gap in the window
    expect(therapistCanTake(busy, H(12, 50), 60)).toBe(false);
    expect(placeLunch([{ start: H(12), end: H(14) }])).toBeNull();
    expect(placeLunch([{ start: H(12), end: H(13) }])).toBe(H(13));
  });

  it("couples massage needs two therapists and two rooms", () => {
    const req = {
      durationMin: 60,
      therapistsRequired: 2,
      therapists: [
        { id: "a", busy: [] },
        { id: "b", busy: [] },
      ],
      rooms: [{ id: 1, busy: [] }, { id: 2, busy: [{ start: H(10), end: H(11, 20) }] }, { id: 3, busy: [] }],
    };
    const slot = assignAt(req, H(10));
    expect(slot?.therapistIds.sort()).toEqual(["a", "b"]);
    expect(slot?.roomIds).toEqual([1, 3]);
    expect(assignAt({ ...req, therapists: [{ id: "a", busy: [] }] }, H(10))).toBeNull();
    expect(assignAt({ ...req, rooms: [{ id: 1, busy: [] }] }, H(10))).toBeNull();
  });

  it("honours the preferred therapist", () => {
    const req = {
      durationMin: 60,
      therapistsRequired: 1,
      therapists: [
        { id: "a", busy: [] },
        { id: "b", busy: [{ start: H(10), end: H(11, 20) }] },
      ],
      rooms: rooms(),
      preferredTherapistId: "b",
    };
    expect(assignAt(req, H(10))).toBeNull();
    expect(assignAt(req, H(11, 30))?.therapistIds).toEqual(["b"]);
  });

  it("blocks the room during the buffer too", () => {
    const req = {
      durationMin: 30,
      therapistsRequired: 1,
      therapists: [{ id: "a", busy: [] }],
      rooms: [{ id: 1, busy: [{ start: H(10), end: H(10, 50) }] }],
    };
    expect(assignAt(req, H(10, 30))).toBeNull();
    expect(assignAt(req, H(10, 50))).not.toBeNull();
  });

  it("produces a 15-minute grid and respects notBefore", () => {
    const slots = computeSlots({
      durationMin: 60,
      therapistsRequired: 1,
      therapists: [{ id: "a", busy: [] }],
      rooms: rooms(),
      notBefore: H(17, 5),
    });
    expect(slots.map((s) => s.start)).toEqual([H(17, 15), H(17, 30), H(17, 45), H(18)]);
  });
});

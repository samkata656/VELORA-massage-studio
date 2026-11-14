import { describe, expect, it } from "vitest";
import { coverageByDay, generateRota, validateRota, type TherapistDays } from "./rota";
import { addDays, rangeKeys } from "../time";

const IDS = ["georgi", "maria", "ivana", "petar", "elena"];
const MON = "2026-01-05"; // a Monday
const weeks = (n: number) => Array.from({ length: n }, (_, i) => addDays(MON, i * 7));
const empty = (): TherapistDays => new Map();
const set = (...k: string[]) => new Set(k);

describe("rota generator", () => {
  it("creates a compliant 4-week rota with 3 therapists every day", () => {
    const { shifts, warnings } = generateRota({ therapistIds: IDS, weekStarts: weeks(4), existing: empty(), absences: empty() });
    const keys = rangeKeys(MON, addDays(MON, 27));
    expect(validateRota(shifts, empty(), MON, addDays(MON, 27))).toEqual([]);
    for (const c of coverageByDay(shifts, keys).values()) expect(c).toBeGreaterThanOrEqual(3);
    expect(warnings.filter((w) => w.type === "BELOW_MINIMUM")).toEqual([]);
  });

  it("never schedules an absent therapist and keeps coverage", () => {
    const absent = new Map([["georgi", set(...rangeKeys(MON, addDays(MON, 6)))]]);
    const { shifts, warnings } = generateRota({ therapistIds: IDS, weekStarts: weeks(2), existing: empty(), absences: absent });
    for (const k of rangeKeys(MON, addDays(MON, 6))) expect(shifts.get("georgi")!.has(k)).toBe(false);
    expect(validateRota(shifts, absent, MON, addDays(MON, 13))).toEqual([]);
    // 4 therapists × max 5 days = 20 < 21 needed → exactly one day drops to 2 and is reported
    const cov = [...coverageByDay(shifts, rangeKeys(MON, addDays(MON, 6))).values()];
    expect(Math.min(...cov)).toBe(2);
    expect(cov.filter((c) => c < 3)).toHaveLength(1);
    expect(warnings.filter((w) => w.type === "UNDERSTAFFED")).toHaveLength(1);
  });

  it("re-spreads an existing rota when someone falls sick (no 4-on/2-on days)", () => {
    const base = generateRota({ therapistIds: IDS, weekStarts: weeks(4), existing: empty(), absences: empty() });
    const days = rangeKeys(MON, addDays(MON, 27));
    const absent = new Map([["georgi", set(...days)]]);
    const { shifts } = generateRota({ therapistIds: IDS, weekStarts: weeks(4), existing: base.shifts, absences: absent });
    expect(validateRota(shifts, absent, MON, addDays(MON, 27))).toEqual([]);
    for (let w = 0; w < 4; w++) {
      const cov = [...coverageByDay(shifts, rangeKeys(addDays(MON, w * 7), addDays(MON, w * 7 + 6))).values()];
      expect(Math.max(...cov)).toBe(3); // nobody idles in a 4th room that doesn't exist
      expect(cov.filter((c) => c < 3)).toHaveLength(1); // 20 shifts for 21 slots → one short day
    }
  });

  it("escapes a local optimum that needs two therapists to swap days", () => {
    // Real state seen in the app: Sunday has 4 on duty while Thu and Fri have 2.
    const d = (...offsets: number[]) => set(...offsets.map((o) => addDays(MON, o)));
    const existing: TherapistDays = new Map([
      ["georgi", d(0, 2, 3, 4)],
      ["elena", d(0, 1, 2, 3, 6)],
      ["ivana", d(0, 1, 4, 5)],
      ["maria", d(3, 4, 5, 6)],
      ["petar", d(1, 2, 5, 6)],
    ]);
    // Same weekly pattern for 3 weeks; "today" is Saturday of week 1; Georgi sick from today on;
    // Ivana asks for 2 extra shifts this week.
    for (const days of existing.values()) for (const k of [...days]) for (const w of [1, 2]) days.add(addDays(k, w * 7));
    const today = addDays(MON, 5);
    const absent = new Map([["georgi", set(...rangeKeys(today, addDays(MON, 20)))]]);
    const { shifts } = generateRota({
      therapistIds: IDS,
      weekStarts: weeks(3),
      existing,
      absences: absent,
      lockedBefore: today,
      extraShifts: [{ therapistId: "ivana", count: 2, from: today, to: addDays(MON, 6) }],
    });
    for (const w of [1, 2]) {
      const cov = [...coverageByDay(shifts, rangeKeys(addDays(MON, w * 7), addDays(MON, w * 7 + 6))).values()];
      expect(Math.max(...cov)).toBe(3);
      expect(cov.filter((c) => c < 3)).toHaveLength(1);
    }
  });

  it("breaks out of a published rota where everyone works Sundays", () => {
    // Stuck state: 4 therapists, all on Sunday, Thu+Fri short every week. Fixing it needs one
    // transition week where somebody works 4 days so they can start a Mon–Fri pattern.
    const d = (w: number, ...offsets: number[]) => offsets.map((o) => addDays(MON, w * 7 + o));
    const existing: TherapistDays = new Map([
      ["elena", set(...[0, 1, 2, 3].flatMap((w) => d(w, 0, 1, 2, 3, 6)))],
      ["ivana", set(...[0, 1, 2, 3].flatMap((w) => d(w, 0, 1, 4, 5, 6)))],
      ["maria", set(...[0, 1, 2, 3].flatMap((w) => d(w, 2, 3, 4, 5, 6)))],
      ["petar", set(...[0, 1, 2, 3].flatMap((w) => d(w, 0, 1, 2, 5, 6)))],
    ]);
    const absent = new Map([["georgi", set(...rangeKeys(MON, addDays(MON, 27)))]]);
    const today = addDays(MON, 7);
    const { shifts } = generateRota({ therapistIds: IDS, weekStarts: weeks(4).slice(1), existing, absences: absent, lockedBefore: today });
    expect(validateRota(shifts, absent, today, addDays(MON, 27))).toEqual([]);
    for (const w of [1, 2, 3]) {
      const cov = [...coverageByDay(shifts, rangeKeys(addDays(MON, w * 7), addDays(MON, w * 7 + 6))).values()];
      expect(Math.max(...cov)).toBe(3);
      if (w > 1) expect(cov.filter((c) => c < 3)).toHaveLength(1);
    }
  });

  it("grants extra shifts when the rules allow it", () => {
    const base = generateRota({ therapistIds: IDS, weekStarts: weeks(1), existing: empty(), absences: empty() });
    const before = base.shifts.get("ivana")!.size;
    const res = generateRota({
      therapistIds: IDS,
      weekStarts: weeks(1),
      existing: base.shifts,
      absences: empty(),
      extraShifts: [{ therapistId: "ivana", count: 1, from: MON, to: addDays(MON, 6) }],
    });
    expect(res.shifts.get("ivana")!.size).toBe(Math.min(5, before + 1));
    expect(validateRota(res.shifts, empty(), MON, addDays(MON, 6))).toEqual([]);
  });

  it("reports extra shifts that would break the 5-day limit", () => {
    const res = generateRota({
      therapistIds: IDS,
      weekStarts: weeks(1),
      existing: empty(),
      absences: empty(),
      extraShifts: [{ therapistId: "ivana", count: 4, from: MON, to: addDays(MON, 6) }],
    });
    expect(res.shifts.get("ivana")!.size).toBeLessThanOrEqual(5);
    expect(res.warnings.some((w) => w.type === "EXTRA_SHORTFALL" && w.therapistId === "ivana")).toBe(true);
  });

  it("keeps the published rota stable when nothing changes", () => {
    const first = generateRota({ therapistIds: IDS, weekStarts: weeks(2), existing: empty(), absences: empty() });
    const again = generateRota({ therapistIds: IDS, weekStarts: weeks(2), existing: first.shifts, absences: empty() });
    for (const id of IDS) expect([...again.shifts.get(id)!].sort()).toEqual([...first.shifts.get(id)!].sort());
  });

  it("respects the 5-day limit across week boundaries", () => {
    // Previous week ends with 4 work days (Thu–Sun)
    const prev = new Map(IDS.map((id) => [id, set("2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04")]));
    const { shifts } = generateRota({ therapistIds: IDS, weekStarts: weeks(1), existing: prev, absences: empty() });
    const merged: TherapistDays = new Map(IDS.map((id) => [id, new Set([...prev.get(id)!, ...shifts.get(id)!])]));
    expect(validateRota(merged, empty(), "2026-01-01", addDays(MON, 6)).filter((v) => v.type === "CONSECUTIVE")).toEqual([]);
  });

  it("does not change locked past days", () => {
    const first = generateRota({ therapistIds: IDS, weekStarts: weeks(1), existing: empty(), absences: empty() });
    const absent = new Map([["maria", set(...rangeKeys(MON, addDays(MON, 6)))]]);
    const res = generateRota({ therapistIds: IDS, weekStarts: weeks(1), existing: first.shifts, absences: absent, lockedBefore: addDays(MON, 3) });
    for (const id of IDS)
      for (const k of rangeKeys(MON, addDays(MON, 2))) expect(res.shifts.get(id)!.has(k)).toBe(first.shifts.get(id)!.has(k));
  });
});

describe("rota validation", () => {
  it("flags 6 days in a row and missing weekly rest", () => {
    const six = new Map([["maria", set(...rangeKeys(MON, addDays(MON, 5)))]]);
    const v = validateRota(six, empty(), MON, addDays(MON, 6));
    expect(v.some((x) => x.type === "CONSECUTIVE")).toBe(true);
    expect(v.some((x) => x.type === "NO_WEEKLY_REST")).toBe(true);
  });

  it("flags split days off (Mon + Thu) as no weekly rest", () => {
    const split = new Map([["maria", set(addDays(MON, 1), addDays(MON, 2), addDays(MON, 4), addDays(MON, 5), addDays(MON, 6))]]);
    expect(validateRota(split, empty(), MON, addDays(MON, 6))).toEqual([{ type: "NO_WEEKLY_REST", therapistId: "maria", weekStart: MON }]);
  });

  it("flags work during an absence", () => {
    const v = validateRota(new Map([["maria", set(MON)]]), new Map([["maria", set(MON)]]), MON, MON);
    expect(v[0].type).toBe("WORKS_WHILE_ABSENT");
  });
});

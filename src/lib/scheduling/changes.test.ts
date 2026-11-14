import { describe, expect, it } from "vitest";
import { SchedulerResponseSchema, resolveTherapist } from "./changes";

const team = [
  { id: "t1", name: "Georgi Petrov" },
  { id: "t2", name: "Maria Ivanova" },
  { id: "t3", name: "Ivana Dimitrova" },
];

describe("SchedulerResponseSchema (n8n AI reply)", () => {
  it("parses the example request from the admin chat", () => {
    const r = SchedulerResponseSchema.parse({
      reply: "Done",
      changes: [
        { type: "absence", therapist: "Georgi", from: "2026-11-14", to: "2027-01-06", absenceType: "SICK" },
        { type: "absence", therapist: "Maria", from: "2027-01-13", to: "2027-01-18", absenceType: "PAID_LEAVE" },
        { type: "extra_shifts", therapist: "Ivana", count: 2 },
      ],
    });
    expect(r.changes).toHaveLength(3);
    expect(r.changes[2]).toMatchObject({ type: "extra_shifts", count: 2 });
  });

  it("fills defaults for a minimal reply", () => {
    expect(SchedulerResponseSchema.parse({})).toEqual({ reply: "", changes: [] });
    const r = SchedulerResponseSchema.parse({ changes: [{ type: "absence", therapist: "t1", from: "2026-12-01", to: "2026-12-02" }] });
    expect(r.changes[0]).toMatchObject({ absenceType: "OTHER" });
  });

  it("rejects bad dates, unknown change types and silly counts", () => {
    expect(SchedulerResponseSchema.safeParse({ changes: [{ type: "day_off", therapist: "t1", date: "6 January" }] }).success).toBe(false);
    expect(SchedulerResponseSchema.safeParse({ changes: [{ type: "fire", therapist: "t1" }] }).success).toBe(false);
    expect(SchedulerResponseSchema.safeParse({ changes: [{ type: "extra_shifts", therapist: "t1", count: 0 }] }).success).toBe(false);
    expect(SchedulerResponseSchema.safeParse({ changes: [{ type: "extra_shifts", therapist: "t1", count: 11 }] }).success).toBe(false);
    expect(SchedulerResponseSchema.safeParse({ changes: [{ type: "absence", therapist: "t1", from: "2026-12-01", to: "2026-12-02", absenceType: "HOLIDAY" }] }).success).toBe(false);
  });
});

describe("resolveTherapist", () => {
  it("matches by id, full name and first name, ignoring case", () => {
    expect(resolveTherapist("t2", team)?.id).toBe("t2");
    expect(resolveTherapist("maria ivanova", team)?.id).toBe("t2");
    expect(resolveTherapist("GEORGI", team)?.id).toBe("t1");
  });

  it("matches Bulgarian spelling to the Latin name", () => {
    expect(resolveTherapist("Георги", team)?.id).toBe("t1");
    expect(resolveTherapist("Ивана Димитрова", team)?.id).toBe("t3");
  });

  it("prefers the exact first name over a partial match", () => {
    // "Ivana" is contained in "Maria Ivanova" but is Ivana Dimitrova's first name
    expect(resolveTherapist("Ivana", team)?.id).toBe("t3");
  });

  it("returns null for someone not on the team", () => {
    expect(resolveTherapist("Nikolay", team)).toBeNull();
  });
});

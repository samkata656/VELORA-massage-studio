import { describe, expect, it } from "vitest";
import { instantToKey, instantToMinutes, localToInstant, mondayOf, weekday } from "./time";

describe("time", () => {
  it("converts studio local time across DST", () => {
    expect(localToInstant("2026-01-10", 600).toISOString()).toBe("2026-01-10T08:00:00.000Z");
    expect(localToInstant("2026-07-10", 600).toISOString()).toBe("2026-07-10T07:00:00.000Z");
    const i = localToInstant("2026-07-10", 13 * 60 + 15);
    expect(instantToKey(i)).toBe("2026-07-10");
    expect(instantToMinutes(i)).toBe(13 * 60 + 15);
  });

  it("weekday helpers", () => {
    expect(weekday("2026-01-05")).toBe(0);
    expect(mondayOf("2026-01-11")).toBe("2026-01-05");
  });
});

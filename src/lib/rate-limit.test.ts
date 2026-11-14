import { describe, expect, it } from "vitest";
import { createLimiter, safeNext } from "./rate-limit";

describe("createLimiter", () => {
  it("blocks after max failures and unblocks when the window ends", () => {
    let t = 0;
    const l = createLimiter({ max: 3, windowMs: 1000, now: () => t });
    for (let i = 0; i < 3; i++) {
      expect(l.allowed("a")).toBe(true);
      l.hit("a");
    }
    expect(l.allowed("a")).toBe(false);
    expect(l.allowed("b")).toBe(true);
    t = 1000;
    expect(l.allowed("a")).toBe(true);
  });

  it("reset clears a key after a successful login", () => {
    const l = createLimiter({ max: 1, windowMs: 1000 });
    l.hit("a");
    expect(l.allowed("a")).toBe(false);
    l.reset("a");
    expect(l.allowed("a")).toBe(true);
  });
});

describe("safeNext", () => {
  it("allows paths on this site", () => {
    expect(safeNext("/admin", "/x")).toBe("/admin");
    expect(safeNext("/en/account?tab=history", "/x")).toBe("/en/account?tab=history");
  });

  it("rejects links that leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/ /evil", "", null, 42])
      expect(safeNext(bad, "/x")).toBe("/x");
  });
});

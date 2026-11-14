import { describe, expect, it } from "vitest";
import { bookingCode, hashPassword, hmacSha256, randomToken, safeEqual, sha256, verifyPassword } from "./crypto";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("VeloraTest!2026");
    expect(stored).toMatch(/^scrypt\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("VeloraTest!2026", stored)).toBe(true);
    expect(await verifyPassword("veloratest!2026", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(await verifyPassword("x", "scrypt$onlysalt")).toBe(false);
  });
});

describe("tokens and signatures", () => {
  it("safeEqual compares exactly, including different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("hmacSha256 matches the RFC 4231 test vector", () => {
    // RFC 4231, test case 2
    expect(hmacSha256("Jefe", "what do ya want for nothing?")).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });

  it("sha256 hashes deterministically", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("randomToken is url-safe and unique", () => {
    const a = randomToken();
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("bookingCode avoids look-alike characters", () => {
    for (let i = 0; i < 200; i++) expect(bookingCode()).toMatch(/^VEL-[2-9A-HJ-NP-Z]{6}$/);
  });
});

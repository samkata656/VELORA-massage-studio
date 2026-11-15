import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { turnstileSiteKey, verifyTurnstile } from "./turnstile";

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-123");
    vi.stubEnv("TURNSTILE_SITE_KEY", "site-123");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("passes everything when no secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const f = reply({ success: false });
    expect(await verifyTurnstile(undefined, "login", undefined, f)).toBe(true);
    expect(f).not.toHaveBeenCalled();
    expect(turnstileSiteKey()).toBeNull();
  });

  it("accepts a valid token for the same form and sends secret, token and IP", async () => {
    const f = reply({ success: true, action: "booking" });
    expect(await verifyTurnstile("tok", "booking", "203.0.113.7", f)).toBe(true);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const sent = init.body as URLSearchParams;
    expect(sent.get("secret")).toBe("secret-123");
    expect(sent.get("response")).toBe("tok");
    expect(sent.get("remoteip")).toBe("203.0.113.7");
    expect(turnstileSiteKey()).toBe("site-123");
  });

  it("rejects a token issued for a different form", async () => {
    expect(await verifyTurnstile("tok", "login", undefined, reply({ success: true, action: "register" }))).toBe(false);
  });

  it("accepts Cloudflare's test keys, which send no action but flag the result", async () => {
    expect(await verifyTurnstile("tok", "login", undefined, reply({ success: true, metadata: { result_with_testing_key: true } }))).toBe(true);
    // without the flag a missing action is not enough
    expect(await verifyTurnstile("tok", "login", undefined, reply({ success: true }))).toBe(false);
  });

  it("rejects failed, missing or oversized tokens without trusting the client", async () => {
    expect(await verifyTurnstile("tok", "login", undefined, reply({ success: false, "error-codes": ["timeout-or-duplicate"] }))).toBe(false);
    const f = reply({ success: true, action: "login" });
    expect(await verifyTurnstile("", "login", undefined, f)).toBe(false);
    expect(await verifyTurnstile(null, "login", undefined, f)).toBe(false);
    expect(await verifyTurnstile("x".repeat(2049), "login", undefined, f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare errors or is unreachable", async () => {
    expect(await verifyTurnstile("tok", "login", undefined, reply({}, false))).toBe(false);
    const down = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await verifyTurnstile("tok", "login", undefined, down)).toBe(false);
  });
});

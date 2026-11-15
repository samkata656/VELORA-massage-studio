/**
 * Cloudflare Turnstile (bot protection) — server-side token check.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * - TURNSTILE_SECRET_KEY unset → protection is off (local dev / quick start) and every request passes.
 * - Set → the token must be valid, unused, and issued for the same form ("action").
 * - Cloudflare unreachable → the request is rejected (fail closed).
 */

export type TurnstileAction = "login" | "register" | "booking";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;

/** Site key for the browser widget, or null when protection is off. Read at request time, not baked into the build. */
export const turnstileSiteKey = () => (turnstileEnabled() && process.env.TURNSTILE_SITE_KEY) || null;

interface SiteverifyResponse {
  success: boolean;
  action?: string;
  "error-codes"?: string[];
  metadata?: { result_with_testing_key?: boolean };
}

export async function verifyTurnstile(
  token: unknown,
  action: TurnstileAction,
  remoteIp?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  // Tokens are at most 2048 characters.
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);
  try {
    const res = await fetchImpl(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return false;
    const data = (await res.json()) as SiteverifyResponse;
    // Real keys echo the action set on the widget. Cloudflare's public test keys send no action
    // and flag the result instead (only possible when the secret itself is a test key).
    return data.success === true && (data.action === action || data.metadata?.result_with_testing_key === true);
  } catch {
    return false;
  }
}

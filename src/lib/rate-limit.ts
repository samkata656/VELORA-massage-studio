/**
 * Small in-memory fixed-window limiter (per server process). Good enough for a single
 * container; use Redis or similar if the app is ever scaled to several instances.
 */
export function createLimiter({ max, windowMs, now = () => Date.now() }: { max: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    /** True while the key still has attempts left in the current window. */
    allowed(key: string) {
      const h = hits.get(key);
      return !h || h.resetAt <= now() || h.count < max;
    },
    /** Records a failed attempt. */
    hit(key: string) {
      const t = now();
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      const h = hits.get(key);
      if (!h || h.resetAt <= t) hits.set(key, { count: 1, resetAt: t + windowMs });
      else h.count++;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}

/** "/admin" yes; "//evil.com", "/\evil.com" (browsers read it as //), "https://…", whitespace no. */
export const safeNext = (next: unknown, fallback: string) =>
  typeof next === "string" && next.startsWith("/") && next[1] !== "/" && !next.includes("\\") && !/\s/.test(next) ? next : fallback;

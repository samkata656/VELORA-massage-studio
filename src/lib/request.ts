import "server-only";
import { headers } from "next/headers";

/** Client IP as reported by the proxy in front of the app (Cloudflare sets CF-Connecting-IP). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? ((h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown");
}

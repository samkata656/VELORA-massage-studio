import "server-only";
import { db, type Tx } from "../db";
import { hmacSha256 } from "../crypto";
import type { Prisma } from "@/generated/prisma/client";

export type OutboundEvent =
  | "appointment.created"
  | "appointment.cancelled"
  | "appointment.rescheduled"
  | "appointment.deleted"
  | "procedure.created"
  | "procedure.updated"
  | "procedure.deleted"
  | "rota.updated";

/** Records an event inside the caller's transaction (transactional outbox). */
export async function enqueue(tx: Tx, event: OutboundEvent, payload: Prisma.InputJsonValue) {
  await tx.webhookOutbox.create({ data: { event, payload } });
}

const MAX_ATTEMPTS = 8;

/**
 * Delivers pending events to N8N_WEBHOOK_URL. Body: { id, event, createdAt, data }.
 * Header X-Velora-Signature = hex HMAC-SHA256(body, N8N_WEBHOOK_SECRET).
 */
export async function flushOutbox(limit = 20): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const url = process.env.N8N_WEBHOOK_URL;
  // Never send unsigned events: n8n could not tell them apart from forged ones.
  if (!url || !process.env.N8N_WEBHOOK_SECRET) return { sent: 0, failed: 0, skipped: true };
  const pending = await db.webhookOutbox.findMany({
    where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  for (const item of pending) {
    const body = JSON.stringify({ id: item.id, event: item.event, createdAt: item.createdAt, data: item.payload });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-velora-event": item.event,
          "x-velora-signature": hmacSha256(process.env.N8N_WEBHOOK_SECRET ?? "", body),
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await db.webhookOutbox.update({ where: { id: item.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } } });
      sent++;
    } catch (e) {
      const attempts = item.attempts + 1;
      await db.webhookOutbox.update({
        where: { id: item.id },
        data: { attempts, lastError: String(e).slice(0, 500), status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING" },
      });
      failed++;
    }
  }
  return { sent, failed, skipped: false };
}

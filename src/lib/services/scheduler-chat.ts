import "server-only";
import { db } from "../db";
import { addDays, mondayOf, todayKey } from "../time";
import { SchedulerResponseSchema, type ScheduleChange } from "../scheduling/changes";
import { activeTherapists, applyPreview, buildPreview, type RotaPreview } from "./rota";
import { ROTA_WEEKS_AHEAD } from "../config";
import type { Prisma } from "@/generated/prisma/client";

export const schedulerConnected = () => !!process.env.N8N_SCHEDULER_WEBHOOK_URL;

/**
 * Sends the admin's message to the n8n scheduler workflow and turns the structured
 * changes it returns into a rota preview. The AI never writes shifts itself:
 * the deterministic engine builds the rota and checks every rule.
 */
export async function sendSchedulerMessage(message: string) {
  await db.schedulerMessage.create({ data: { role: "ADMIN", content: message } });

  const url = process.env.N8N_SCHEDULER_WEBHOOK_URL;
  if (!url) {
    return db.schedulerMessage.create({
      data: {
        role: "SYSTEM",
        content:
          "The AI scheduler is not connected yet. Set N8N_SCHEDULER_WEBHOOK_URL to your n8n workflow. Meanwhile you can use the manual form below.",
      },
    });
  }

  const therapists = await activeTherapists();
  const history = await db.schedulerMessage.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  const today = todayKey();
  const payload = {
    message,
    today,
    timezone: "Europe/Sofia",
    rotaHorizon: { from: mondayOf(today), to: addDays(mondayOf(today), ROTA_WEEKS_AHEAD * 7 - 1) },
    therapists: therapists.map((t) => ({ id: t.id, name: t.name })),
    history: history.reverse().map((h) => ({ role: h.role, content: h.content })),
    rules: [
      "Therapists work 10:00-19:00; max 5 consecutive work days; at least 2 consecutive days off in every Mon-Sun week.",
      "Target 3 therapists per day (one per room), minimum 2.",
    ],
    responseFormat: {
      reply: "short message to the admin, same language as the admin wrote in",
      changes: [
        { type: "absence", therapist: "<id>", from: "YYYY-MM-DD", to: "YYYY-MM-DD", absenceType: "SICK|PAID_LEAVE|UNPAID|OTHER", note: "optional" },
        { type: "extra_shifts", therapist: "<id>", count: 2, from: "YYYY-MM-DD (optional)", to: "YYYY-MM-DD (optional)" },
        { type: "day_off", therapist: "<id>", date: "YYYY-MM-DD" },
        { type: "add_shift", therapist: "<id>", date: "YYYY-MM-DD" },
      ],
    },
  };

  let reply = "";
  let changes: ScheduleChange[] = [];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.N8N_API_KEY ?? ""}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`n8n responded with HTTP ${res.status}`);
    const json = await res.json();
    const parsed = SchedulerResponseSchema.safeParse(Array.isArray(json) ? json[0] : (json.output ?? json));
    if (!parsed.success) throw new Error("The AI response did not match the expected format.");
    reply = parsed.data.reply;
    changes = parsed.data.changes;
  } catch (e) {
    return db.schedulerMessage.create({ data: { role: "SYSTEM", content: `Could not reach the AI scheduler: ${(e as Error).message}` } });
  }
  return proposeChanges(changes, reply);
}

/** Builds and stores a preview for a set of changes (from AI or the manual form). */
export async function proposeChanges(changes: ScheduleChange[], reply = "") {
  if (!changes.length) {
    return db.schedulerMessage.create({ data: { role: "AI", content: reply || "I didn't find any schedule changes in that message." } });
  }
  const preview = await buildPreview(changes);
  return db.schedulerMessage.create({
    data: {
      role: "AI",
      content: reply || "Here is the proposed schedule.",
      changes: changes as unknown as Prisma.InputJsonValue,
      preview: preview as unknown as Prisma.InputJsonValue,
      status: preview.weeks.length || preview.absences.length ? "PROPOSED" : "NONE",
    },
  });
}

export async function applyProposal(messageId: string, source: "AI" | "MANUAL" = "AI") {
  const msg = await db.schedulerMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.status !== "PROPOSED" || !msg.changes) throw new Error("Nothing to apply");
  // Rebuild against the current rota so a stale preview never overwrites newer edits.
  const fresh = await buildPreview(msg.changes as unknown as ScheduleChange[]);
  await applyPreview(fresh, source);
  await db.schedulerMessage.updateMany({ where: { status: "PROPOSED" }, data: { status: "DISCARDED" } });
  await db.schedulerMessage.update({ where: { id: messageId }, data: { status: "APPLIED", preview: fresh as unknown as Prisma.InputJsonValue } });
  await db.schedulerMessage.create({
    data: { role: "SYSTEM", content: `Applied: ${fresh.added.length} shifts added, ${fresh.removed.length} removed, ${fresh.absences.length} absences recorded.` },
  });
}

export async function discardProposal(messageId: string) {
  await db.schedulerMessage.update({ where: { id: messageId }, data: { status: "DISCARDED" } });
}

export type { RotaPreview };

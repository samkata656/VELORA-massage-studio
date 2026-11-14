import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
/** Therapist reference: id, or name as written by the admin (matched case-insensitively). */
const therapistRef = z.string().min(1);

export const absenceTypes = ["SICK", "PAID_LEAVE", "UNPAID", "OTHER"] as const;

export const ScheduleChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("absence"),
    therapist: therapistRef,
    from: dateStr,
    to: dateStr,
    absenceType: z.enum(absenceTypes).default("OTHER"),
    note: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal("extra_shifts"),
    therapist: therapistRef,
    count: z.number().int().min(1).max(10),
    from: dateStr.optional(),
    to: dateStr.optional(),
  }),
  z.object({ type: z.literal("day_off"), therapist: therapistRef, date: dateStr }),
  z.object({ type: z.literal("add_shift"), therapist: therapistRef, date: dateStr }),
]);

export type ScheduleChange = z.infer<typeof ScheduleChangeSchema>;

/** What the n8n scheduler workflow must respond with. */
export const SchedulerResponseSchema = z.object({
  reply: z.string().default(""),
  changes: z.array(ScheduleChangeSchema).default([]),
});

export type SchedulerResponse = z.infer<typeof SchedulerResponseSchema>;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Small BG→Latin transliteration so "Георги" matches "Georgi". */
const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};
const latin = (s: string) => [...fold(s)].map((c) => translit[c] ?? c).join("");

export function resolveTherapist<T extends { id: string; name: string }>(ref: string, therapists: T[]): T | null {
  const byId = therapists.find((t) => t.id === ref);
  if (byId) return byId;
  const r = latin(ref);
  return (
    therapists.find((t) => latin(t.name) === r) ??
    therapists.find((t) => latin(t.name).split(/\s+/)[0] === r.split(/\s+/)[0]) ??
    therapists.find((t) => latin(t.name).includes(r)) ??
    null
  );
}

import { z } from "zod";

// U+FFFD (the replacement character) means the text was garbled by a wrong encoding somewhere along the way.
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `at least ${min} characters`)
    .max(max, `at most ${max.toLocaleString("en")} characters`)
    .refine((s) => !s.includes("�"), "contains invalid characters (�) — retype or paste it again");

/** Benefits article form (Admin → Procedures → Edit article). Plain text: blank line = new paragraph, "- " lines = bullet list. */
export const ArticleSchema = z.object({
  titleEn: text(3, 200),
  titleBg: text(3, 200),
  bodyEn: text(20, 10_000),
  bodyBg: text(20, 10_000),
});

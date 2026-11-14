import { z } from "zod";

// U+FFFD appears when the request body was not valid UTF-8 (e.g. Cyrillic sent in a legacy code page).
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !s.includes("�"),"Text is not valid UTF-8; send the body as UTF-8 JSON");

/** Body of PUT /api/n8n/articles/:slug. Plain text: blank line = new paragraph, "- " lines = bullet list. */
export const ArticleSchema = z.object({
  titleEn: text(3, 200),
  titleBg: text(3, 200),
  bodyEn: text(20, 10_000),
  bodyBg: text(20, 10_000),
});

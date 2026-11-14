import { describe, expect, it } from "vitest";
import { ArticleSchema } from "./articles";

const valid = {
  titleEn: "Sports massage for recovery",
  titleBg: "Спортен масаж за възстановяване",
  bodyEn: "Helps muscles recover after training.\n\n- Less soreness\n- Better mobility",
  bodyBg: "Помага на мускулите да се възстановят след тренировка.",
};

describe("ArticleSchema (PUT /api/n8n/articles/:slug)", () => {
  it("accepts Bulgarian and English text and trims it", () => {
    const r = ArticleSchema.parse({ ...valid, titleEn: "  Sports massage for recovery  " });
    expect(r.titleEn).toBe("Sports massage for recovery");
    expect(r.titleBg).toBe(valid.titleBg);
  });

  it("rejects text garbled by a wrong encoding", () => {
    const r = ArticleSchema.safeParse({ ...valid, titleBg: "������� �����" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ["titleBg"], message: expect.stringContaining("UTF-8") });
  });

  it("decodes a real UTF-8 request body correctly but flags a Latin-1 one", () => {
    const json = JSON.stringify(valid);
    expect(ArticleSchema.safeParse(JSON.parse(new TextDecoder().decode(Buffer.from(json, "utf8")))).success).toBe(true);
    const cp1251ish = Buffer.from(json.replace(/[^\x00-\x7f]/g, "\xe8"), "latin1");
    expect(ArticleSchema.safeParse(JSON.parse(new TextDecoder().decode(cp1251ish))).success).toBe(false);
  });

  it("requires every field with sensible lengths", () => {
    expect(ArticleSchema.safeParse({ ...valid, bodyBg: undefined }).success).toBe(false);
    expect(ArticleSchema.safeParse({ ...valid, titleEn: "Hi" }).success).toBe(false);
    expect(ArticleSchema.safeParse({ ...valid, bodyEn: "Too short" }).success).toBe(false);
    expect(ArticleSchema.safeParse({ ...valid, titleBg: "x".repeat(201) }).success).toBe(false);
  });
});

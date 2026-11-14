import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { n8nGuard } from "@/lib/n8n";
import { ArticleSchema } from "@/lib/articles";

/** PUT /api/n8n/articles/:procedureSlug — create or replace the benefits article. */
export async function PUT(req: Request, ctx: RouteContext<"/api/n8n/articles/[slug]">) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const { slug } = await ctx.params;
  const procedure = await db.procedure.findUnique({ where: { slug } });
  if (!procedure || procedure.deletedAt) return NextResponse.json({ error: "NOT_FOUND", message: "No active procedure with this slug" }, { status: 404 });
  const parsed = ArticleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", issues: parsed.error.issues }, { status: 400 });
  const article = await db.article.upsert({
    where: { procedureId: procedure.id },
    update: { ...parsed.data, source: "N8N" },
    create: { ...parsed.data, procedureId: procedure.id, source: "N8N" },
  });
  return NextResponse.json({ article: { id: article.id, slug, url: `${process.env.APP_URL ?? ""}/en/benefits/${slug}` } });
}

/** DELETE /api/n8n/articles/:procedureSlug */
export async function DELETE(req: Request, ctx: RouteContext<"/api/n8n/articles/[slug]">) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const { slug } = await ctx.params;
  const procedure = await db.procedure.findUnique({ where: { slug }, include: { article: true } });
  if (!procedure?.article) return NextResponse.json({ deleted: false, message: "No article for this slug" }, { status: 404 });
  await db.article.delete({ where: { id: procedure.article.id } });
  return NextResponse.json({ deleted: true });
}

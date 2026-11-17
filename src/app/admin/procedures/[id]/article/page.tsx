import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ArticleBody } from "@/components/ArticleBody";
import { deleteArticleAction } from "../../../actions";
import { ArticleForm } from "./ArticleForm";

export const metadata: Metadata = { title: "Benefits article" };

export default async function ArticleEditorPage({ params }: PageProps<"/admin/procedures/[id]/article">) {
  const { id } = await params;
  const p = await db.procedure.findFirst({ where: { id, deletedAt: null }, include: { article: true } });
  if (!p) notFound();
  const a = p.article;

  return (
    <>
      <Link href="/admin/procedures" className="text-sm text-bronze-deep hover:underline">
        ← Procedures & prices
      </Link>
      <PageHeader
        title={p.nameEn}
        lead={
          a
            ? `Benefits article, last saved ${a.updatedAt.toLocaleDateString("en-GB", { timeZone: "Europe/Sofia" })} (${a.source.toLowerCase()}).`
            : "No article yet: the benefits page shows “Article coming soon” until you publish one."
        }
      >
        {a && (
          <>
            <Link href={`/en/benefits/${p.slug}`} className="btn btn-ghost btn-sm" target="_blank">
              View EN
            </Link>
            <Link href={`/bg/benefits/${p.slug}`} className="btn btn-ghost btn-sm" target="_blank">
              View BG
            </Link>
            <form action={deleteArticleAction.bind(null, p.id)}>
              <ConfirmButton className="btn btn-danger btn-sm" message={`Delete the article for “${p.nameEn}”? The site will show “Article coming soon”.`}>
                Delete article
              </ConfirmButton>
            </form>
          </>
        )}
      </PageHeader>

      <Panel>
        {/* Remount only when the article appears or disappears; keeps the "Saved" message after an edit. */}
        <ArticleForm key={a ? "edit" : "new"} procedureId={p.id} article={a && { titleEn: a.titleEn, titleBg: a.titleBg, bodyEn: a.bodyEn, bodyBg: a.bodyBg }} />
      </Panel>

      {a && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {(["En", "Bg"] as const).map((l) => (
            <Panel key={l} title={`Preview (${l.toUpperCase()})`}>
              <h2 className="mb-3 font-display text-2xl">{a[`title${l}`]}</h2>
              <ArticleBody text={a[`body${l}`]} />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

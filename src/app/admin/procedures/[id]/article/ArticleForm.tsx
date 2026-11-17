"use client";

import { useState, useTransition } from "react";
import { saveArticleAction } from "../../../actions";

type Article = { titleEn: string; titleBg: string; bodyEn: string; bodyBg: string };

export function ArticleForm({ procedureId, article }: { procedureId: string; article: Article | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setMsg(null);
        start(async () => {
          const r = await saveArticleAction(procedureId, f);
          setMsg(r.ok ? { ok: true, text: "Saved ✓ The article is live on the site." } : { ok: false, text: r.error ?? "Could not save the article." });
        });
      }}
    >
      {(["En", "Bg"] as const).map((l) => (
        <div key={l} className="min-w-0 space-y-3">
          <div className="field">
            <label htmlFor={`title${l}`}>Title ({l.toUpperCase()})</label>
            <input id={`title${l}`} name={`title${l}`} defaultValue={article?.[`title${l}`] ?? ""} className="input" required minLength={3} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor={`body${l}`}>Text ({l.toUpperCase()})</label>
            <textarea id={`body${l}`} name={`body${l}`} defaultValue={article?.[`body${l}`] ?? ""} rows={16} className="input font-[inherit] leading-relaxed" required minLength={20} maxLength={10000} />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted md:col-span-2">
        A blank line starts a new paragraph. Lines starting with <code>- </code> become a bullet list.
      </p>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : article ? "Save article" : "Publish article"}
        </button>
        {msg && <span className={msg.ok ? "text-sm text-success" : "error-text"}>{msg.text}</span>}
      </div>
    </form>
  );
}

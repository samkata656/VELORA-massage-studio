"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { applyProposalAction, clearChatAction, discardProposalAction, sendChatAction } from "../actions";

export interface ChatMessage {
  id: string;
  role: "ADMIN" | "AI" | "SYSTEM";
  content: string;
  status: "NONE" | "PROPOSED" | "APPLIED" | "DISCARDED";
  createdAt: string;
  summary?: { added: string[]; removed: string[]; absences: string[]; warnings: string[]; issues: string[] };
}

const examples = [
  "Georgi is sick until 6 January",
  "Maria wants paid leave 13–18 January",
  "Ivana wants 2 extra shifts this week",
];

export function SchedulerChat({ messages, connected }: { messages: ChatMessage[]; connected: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = (msg: string) => {
    if (!msg.trim()) return;
    start(async () => {
      await sendChatAction(msg);
      setText("");
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`chip ${connected ? "!text-success" : "!text-warn"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success" : "bg-warn"}`} aria-hidden="true" />
          {connected ? "AI assistant connected" : "AI not connected"}
        </span>
        {messages.length > 0 && (
          <button className="text-xs text-muted hover:text-espresso" onClick={() => start(() => clearChatAction())}>
            Clear chat
          </button>
        )}
      </div>

      <div className="max-h-[460px] min-h-56 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-white/60 p-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="p-3 text-sm text-muted">
            <p>Describe changes in plain language (English or Bulgarian). The AI turns them into absences and shift requests; the rota engine then rebuilds the schedule within the rules and shows a preview before anything is saved.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((e) => (
                <button key={e} type="button" className="chip hover:!border-oak hover:!text-espresso" onClick={() => setText(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "ADMIN" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "ADMIN" ? "bg-espresso text-linen" : m.role === "SYSTEM" ? "bg-sand/70 text-muted" : "border border-line bg-linen"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.summary && (
                <div className="mt-2 space-y-1.5 border-t border-line pt-2 text-xs">
                  {m.summary.absences.map((a) => (
                    <p key={a}>• {a}</p>
                  ))}
                  {m.summary.added.map((line) => (
                    <p key={`+${line}`} className="text-success">
                      + {line}
                    </p>
                  ))}
                  {m.summary.removed.map((line) => (
                    <p key={`-${line}`} className="text-danger">
                      − {line}
                    </p>
                  ))}
                  {m.summary.added.length + m.summary.removed.length === 0 && m.summary.absences.length > 0 && <p className="text-muted">No shift changes needed.</p>}
                  {[...m.summary.issues, ...m.summary.warnings].map((w) => (
                    <p key={w} className="text-warn">
                      ⚠ {w}
                    </p>
                  ))}
                  {m.status === "PROPOSED" && (
                    <div className="flex gap-2 pt-1.5">
                      <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(() => applyProposalAction(m.id))}>
                        Apply to rota
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => discardProposalAction(m.id))}>
                        Discard
                      </button>
                    </div>
                  )}
                  {m.status === "APPLIED" && <p className="font-medium text-success">✓ Applied</p>}
                  {m.status === "DISCARDED" && <p className="text-muted">Discarded</p>}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="text-xs text-muted">Working on it…</p>}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor="chat" className="sr-only">
          Message to the AI scheduler
        </label>
        <textarea
          id="chat"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder="e.g. Georgi is sick till 6 January"
          className="input flex-1 resize-none"
        />
        <button className="btn btn-primary self-end" disabled={pending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

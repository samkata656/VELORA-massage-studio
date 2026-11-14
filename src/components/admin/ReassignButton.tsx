"use client";

import { useState, useTransition } from "react";
import { reassignAction } from "@/app/admin/actions";

export function ReassignButton({ allocationId, label = "Auto-reassign" }: { allocationId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button
        className="btn btn-ghost btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reassignAction(allocationId);
            setMsg(r.ok ? `Moved to ${r.name}` : (r.error ?? "Failed"));
          })
        }
      >
        {label}
      </button>
    </span>
  );
}

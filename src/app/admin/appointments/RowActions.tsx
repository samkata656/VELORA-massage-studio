"use client";

import { useTransition } from "react";
import { adminCancelAction, adminDeleteAction, adminStatusAction } from "../actions";

export function RowActions({ id, code, status }: { id: string; code: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status !== "CANCELLED" && (
        <select
          aria-label="Status"
          className="input !min-h-8 !w-auto !py-0.5 !text-xs"
          value={status}
          disabled={pending}
          onChange={(e) => start(() => adminStatusAction(id, e.target.value as "BOOKED" | "COMPLETED" | "NO_SHOW"))}
        >
          <option value="BOOKED">Booked</option>
          <option value="COMPLETED">Completed</option>
          <option value="NO_SHOW">No-show</option>
        </select>
      )}
      {status === "BOOKED" && (
        <button
          className="btn btn-ghost btn-sm !min-h-8"
          disabled={pending}
          onClick={() => confirm(`Cancel ${code}? The client keeps a record of it.`) && start(() => adminCancelAction(code))}
        >
          Cancel
        </button>
      )}
      <button
        className="btn btn-danger btn-sm !min-h-8"
        disabled={pending}
        onClick={() => confirm(`Delete ${code} permanently? This cannot be undone.`) && start(() => adminDeleteAction(id))}
      >
        Delete
      </button>
    </div>
  );
}

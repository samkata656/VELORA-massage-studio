"use client";

import { useFormStatus } from "react-dom";

/** Submit button that asks for confirmation before submitting its form. */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

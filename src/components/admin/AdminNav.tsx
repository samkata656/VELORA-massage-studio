"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schedule", label: "Day schedule" },
  { href: "/admin/rota", label: "Work rota & AI" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/therapists", label: "Therapists" },
  { href: "/admin/procedures", label: "Procedures & prices" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Admin" className="hidden flex-col gap-0.5 lg:mt-8 lg:flex">
        {items.map((i) => {
          const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-espresso text-linen" : "text-muted hover:bg-cream hover:text-espresso"}`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
      <details className="relative lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border border-line px-4 text-sm [&::-webkit-details-marker]:hidden">Menu</summary>
        <nav aria-label="Admin mobile" className="absolute right-0 z-30 mt-2 flex w-60 flex-col rounded-2xl border border-line bg-linen p-2 shadow-soft">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="rounded-xl px-3 py-3 text-sm hover:bg-cream">
              {i.label}
            </Link>
          ))}
          <Link href="/bg" className="rounded-xl px-3 py-3 text-sm text-muted hover:bg-cream">
            View site
          </Link>
        </nav>
      </details>
    </>
  );
}

import Link from "next/link";
import { addDays, mondayOf } from "@/lib/time";

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl md:text-[2.75rem]">{title}</h1>
        {lead && <p className="mt-1.5 max-w-2xl text-sm text-muted">{lead}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-2xl">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function WeekNav({ monday, basePath, today }: { monday: string; basePath: string; today: string }) {
  const fmt = (k: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));
  return (
    <div className="flex items-center gap-1">
      <Link href={`${basePath}?week=${addDays(monday, -7)}`} className="btn btn-ghost btn-sm" aria-label="Previous week">
        ←
      </Link>
      <span className="min-w-40 text-center text-sm tabular-nums">
        {fmt(monday)} – {fmt(addDays(monday, 6))}
      </span>
      <Link href={`${basePath}?week=${addDays(monday, 7)}`} className="btn btn-ghost btn-sm" aria-label="Next week">
        →
      </Link>
      {monday !== mondayOf(today) && (
        <Link href={basePath} className="btn btn-ghost btn-sm">
          This week
        </Link>
      )}
    </div>
  );
}

export const eur = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

export const shortDay = (k: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));

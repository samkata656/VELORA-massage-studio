import type { Metadata } from "next";
import Link from "next/link";
import "../globals.css";
import { display, sans } from "../fonts";
import { requireAdmin } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { logoutAction } from "@/app/[locale]/(auth)/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin · VELORA", template: "%s · VELORA Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} antialiased`}>
      <body className="min-h-dvh bg-cream">
        <div className="lg:grid lg:min-h-dvh lg:grid-cols-[240px_1fr]">
          <aside className="border-b border-line bg-linen lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 px-4 py-4 lg:flex-col lg:items-stretch lg:px-5 lg:py-6">
              <Link href="/admin" className="flex items-center gap-2.5">
                <LogoMark className="h-8 w-8" />
                <span>
                  <span className="block font-display text-xl leading-none tracking-[0.24em]">VELORA</span>
                  <span className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">Studio admin</span>
                </span>
              </Link>
              <AdminNav />
              <div className="hidden space-y-2 border-t border-line pt-4 text-sm lg:mt-auto lg:block">
                <p className="truncate text-muted">{user.email}</p>
                <div className="flex gap-3">
                  <Link href="/bg" className="text-muted hover:text-espresso">
                    View site
                  </Link>
                  <form action={logoutAction}>
                    <input type="hidden" name="locale" value="bg" />
                    <button className="text-muted hover:text-espresso">Sign out</button>
                  </form>
                </div>
              </div>
            </div>
          </aside>
          <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { display, sans } from "../fonts";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : "bg");
  return {
    title: { default: t.meta.title, template: "%s · VELORA" },
    description: t.meta.description,
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
    openGraph: { images: ["/photos/lobby.png"], siteName: "VELORA" },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-espresso focus:px-4 focus:py-2 focus:text-linen">
          Skip to content
        </a>
        <SiteHeader locale={locale} t={t} user={user} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={locale} t={t} />
      </body>
    </html>
  );
}

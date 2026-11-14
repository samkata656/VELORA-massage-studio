"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";

export function LocaleSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const target: Locale = locale === "bg" ? "en" : "bg";
  const rest = pathname.split("/").slice(2).join("/");
  const qs = search.toString();
  const href = `/${target}${rest ? `/${rest}` : ""}${qs ? `?${qs}` : ""}`;
  return (
    <Link
      href={href}
      hrefLang={target}
      lang={target}
      onClick={() => {
        document.cookie = `velora_locale=${target}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted transition-colors hover:text-espresso"
    >
      {label}
    </Link>
  );
}

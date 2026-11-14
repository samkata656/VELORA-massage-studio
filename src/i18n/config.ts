export const locales = ["bg", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "bg";

export const isLocale = (v: string | undefined | null): v is Locale => !!v && (locales as readonly string[]).includes(v);

/** Picks the BG or EN variant of a bilingual DB field pair. */
export function pick<T extends Record<string, unknown>>(obj: T, field: string, locale: Locale): string {
  const key = `${field}${locale === "bg" ? "Bg" : "En"}`;
  return String(obj[key] ?? "");
}

export function formatPrice(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(key: string, locale: Locale, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}

export function formatDateTime(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sofia",
  }).format(d);
}

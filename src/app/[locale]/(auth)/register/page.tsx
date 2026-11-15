import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";
import { turnstileSiteKey } from "@/lib/turnstile";

export async function generateMetadata({ params }: PageProps<"/[locale]/register">): Promise<Metadata> {
  return { title: getDictionary((await params).locale as Locale).auth.register };
}

export default async function RegisterPage({ params, searchParams }: PageProps<"/[locale]/register">) {
  const locale = (await params).locale as Locale;
  const next = (await searchParams).next;
  const t = getDictionary(locale);
  if (await getCurrentUser()) redirect(`/${locale}/account`);
  return (
    <AuthShell title={t.auth.registerTitle} lead={t.auth.registerLead}>
      <AuthForm mode="register" locale={locale} t={t} next={typeof next === "string" ? next : undefined} turnstileSiteKey={turnstileSiteKey()} />
    </AuthShell>
  );
}

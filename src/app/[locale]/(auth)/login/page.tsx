import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  return { title: getDictionary((await params).locale as Locale).auth.login };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const locale = (await params).locale as Locale;
  const next = (await searchParams).next;
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : `/${locale}/account`);
  return (
    <AuthShell title={t.auth.loginTitle} lead={t.auth.loginLead}>
      <AuthForm mode="login" locale={locale} t={t} next={typeof next === "string" ? next : undefined} />
    </AuthShell>
  );
}

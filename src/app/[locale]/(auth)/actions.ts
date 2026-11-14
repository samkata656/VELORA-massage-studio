"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { createLimiter, safeNext } from "@/lib/rate-limit";

export interface AuthState {
  error?: string;
  fields?: Record<string, string>;
}

// Failed logins: 10 per email and 30 per IP address every 15 minutes.
const byEmail = createLimiter({ max: 10, windowMs: 15 * 60_000 });
const byIp = createLimiter({ max: 30, windowMs: 15 * 60_000 });
const clientIp = async () => ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = isLocale(String(form.get("locale"))) ? (String(form.get("locale")) as "bg" | "en") : "bg";
  const t = getDictionary(locale);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (!byEmail.allowed(email) || !byIp.allowed(ip)) return { error: t.auth.tooMany, fields: { email } };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    byEmail.hit(email);
    byIp.hit(ip);
    return { error: t.auth.invalid, fields: { email } };
  }
  byEmail.reset(email);
  await createSession(user.id);
  redirect(safeNext(form.get("next"), user.role === "ADMIN" ? "/admin" : `/${locale}/account`));
}

const RegisterSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().transform((s) => s.toLowerCase()),
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/),
  password: z.string().min(8),
});

export async function registerAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = isLocale(String(form.get("locale"))) ? (String(form.get("locale")) as "bg" | "en") : "bg";
  const t = getDictionary(locale);
  const raw = Object.fromEntries(["name", "email", "phone", "password"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = RegisterSchema.safeParse(raw);
  const fields = { name: raw.name, email: raw.email, phone: raw.phone };
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = String(issue.path[0]);
    const msg = key === "email" ? t.errors.email : key === "phone" ? t.errors.phone : key === "password" ? t.auth.passwordHint : t.errors.required;
    return { error: msg, fields };
  }
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: t.auth.exists, fields };
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      locale,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });
  // Guest bookings are NOT attached by email: addresses are not verified, so anyone could
  // register with someone else's email and see or cancel their bookings.
  await createSession(user.id);
  redirect(safeNext(form.get("next"), `/${locale}/account`));
}

export async function logoutAction(form: FormData) {
  await destroySession();
  const locale = String(form.get("locale") ?? "bg");
  redirect(`/${isLocale(locale) ? locale : "bg"}`);
}

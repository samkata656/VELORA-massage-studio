"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { loginAction, registerAction, type AuthState } from "./actions";

export function AuthForm({ mode, locale, t, next }: { mode: "login" | "register"; locale: Locale; t: Dictionary; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? loginAction : registerAction, {});
  const f = state.fields ?? {};
  const switchHref = `/${locale}/${mode === "login" ? "register" : "login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form action={action} className="space-y-5" noValidate={false}>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "register" && (
        <div className="field">
          <label htmlFor="name">{t.auth.name}</label>
          <input id="name" name="name" className="input" autoComplete="name" required minLength={2} defaultValue={f.name} />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">{t.auth.email}</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required defaultValue={f.email} />
      </div>
      {mode === "register" && (
        <div className="field">
          <label htmlFor="phone">{t.auth.phone}</label>
          <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" required defaultValue={f.phone} />
          <span className="hint">{t.booking.phoneHint}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="password">{t.auth.password}</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 8 : undefined}
        />
        {mode === "register" && <span className="hint">{t.auth.passwordHint}</span>}
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button className="btn btn-primary w-full" disabled={pending}>
        {mode === "login" ? t.auth.login : t.auth.register}
      </button>

      <div className="flex flex-col items-center gap-3 pt-2 text-sm text-muted">
        <p>
          {mode === "login" ? t.auth.noAccount : t.auth.haveAccount}{" "}
          <Link href={switchHref} className="font-medium text-bronze-deep underline-offset-4 hover:underline">
            {mode === "login" ? t.auth.register : t.auth.login}
          </Link>
        </p>
        <Link href={`/${locale}/book`} className="underline-offset-4 hover:underline">
          {t.auth.continueGuest}
        </Link>
      </div>
    </form>
  );
}

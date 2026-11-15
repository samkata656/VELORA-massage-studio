"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n";
import { formatPrice, type Locale } from "@/i18n/config";
import { DateStrip, TimeGrid } from "@/components/SlotPicker";
import { Turnstile } from "@/components/Turnstile";
import { fetchSlotsAction, submitBookingAction } from "./actions";

export interface WizardProcedure {
  id: string;
  slug: string;
  name: string;
  summary: string;
  therapistsRequired: number;
  variants: { id: string; durationMin: number; priceCents: number }[];
}
export interface WizardTherapist {
  id: string;
  name: string;
  title: string;
  procedureIds: string[];
}

interface Props {
  locale: Locale;
  t: Dictionary;
  procedures: WizardProcedure[];
  therapists: WizardTherapist[] | null;
  user: { name: string; email: string; phone: string | null } | null;
  initialSlug?: string;
  dates: string[];
  turnstileSiteKey: string | null;
}

const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function BookingWizard({ locale, t, procedures, therapists, user, initialSlug, dates, turnstileSiteKey }: Props) {
  const initial = procedures.find((p) => p.slug === initialSlug) ?? null;
  const [step, setStep] = useState(initial && initial.variants.length === 1 ? 1 : 0);
  const [procedureId, setProcedureId] = useState<string | null>(initial?.id ?? null);
  const [variantId, setVariantId] = useState<string | null>(initial?.variants.length === 1 ? initial.variants[0].id : null);
  const [dateKey, setDateKey] = useState<string>(dates[0]);
  const [therapistId, setTherapistId] = useState<string>("");
  const [start, setStart] = useState<number | null>(null);
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; token: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [botToken, setBotToken] = useState<string | null>(null);
  const [botReset, setBotReset] = useState(0);
  const tb = t.booking;

  const procedure = procedures.find((p) => p.id === procedureId) ?? null;
  const variant = procedure?.variants.find((v) => v.id === variantId) ?? null;
  const qualified = therapists && procedure ? therapists.filter((x) => x.procedureIds.includes(procedure.id)) : [];
  const therapistName = therapists?.find((x) => x.id === therapistId)?.name;
  const dateLabel = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${dateKey}T00:00:00Z`),
  );

  const steps = [tb.stepTreatment, tb.stepDate, tb.stepDetails];

  function submit() {
    if (!variant || start === null) return;
    setError(null);
    setFieldError(null);
    startTransition(async () => {
      const res = await submitBookingAction({
        variantId: variant.id,
        dateKey,
        start,
        therapistId: therapistId || null,
        name: form.name,
        email: form.email,
        phone: form.phone,
        notes: form.notes || null,
        locale,
        turnstileToken: botToken,
      });
      if (!res.ok) setBotReset((n) => n + 1); // the token was spent; get a fresh one for the retry
      if (res.ok) {
        setDone({ code: res.code, token: res.token });
        setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res.error === "SLOT_TAKEN") {
        setError(tb.slotTaken);
        setStart(null);
        setStep(1);
      } else if (res.error === "BOT_CHECK") {
        setError(t.errors.botCheck);
      } else if (res.error === "VALIDATION") {
        setFieldError(res.field ?? null);
        setError(res.field === "email" ? t.errors.email : res.field === "phone" ? t.errors.phone : t.errors.required);
      } else setError(t.errors.generic);
    });
  }

  if (step === 3 && done && variant && procedure) {
    return (
      <div className="card fade-up mx-auto max-w-xl p-8 text-center md:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive-soft text-olive">
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-6 text-4xl">{tb.confirmedTitle}</h2>
        <p className="mt-3 text-muted">{tb.confirmedText}</p>
        <dl className="mt-8 space-y-2 rounded-2xl bg-cream p-5 text-left text-sm">
          <Row k={tb.code} v={<span className="font-medium tracking-wider">{done.code}</span>} />
          <Row k={tb.stepTreatment} v={`${procedure.name} · ${variant.durationMin} ${t.treatments.minutes}`} />
          <Row k={tb.stepDate} v={`${dateLabel}, ${fmtTime(start!)}`} />
          <Row k="€" v={formatPrice(variant.priceCents, locale)} />
        </dl>
        <p className="mt-5 text-xs text-muted">{tb.cancelPolicy}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/${locale}/booking/${done.code}?t=${done.token}`} className="btn btn-ghost">
            {tb.manage}
          </Link>
          <Link href={user ? `/${locale}/account` : `/${locale}`} className="btn btn-primary">
            {user ? t.nav.account : t.nav.home}
          </Link>
        </div>
        {!user && <p className="mt-6 text-xs text-muted">{tb.addToAccount}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <ol className="mb-10 flex flex-wrap gap-2" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={`chip ${i === step ? "!border-espresso !bg-espresso !text-linen" : i < step ? "!text-espresso" : ""}`}>
              <span className="tabular-nums">{i + 1}</span> {s}
            </li>
          ))}
        </ol>

        {error && (
          <p role="alert" className="mb-6 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {step === 0 && (
          <section className="space-y-8">
            <h2 className="text-3xl">{tb.chooseTreatment}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {procedures.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={procedureId === p.id}
                  onClick={() => {
                    setProcedureId(p.id);
                    setVariantId(p.variants.length === 1 ? p.variants[0].id : null);
                    setTherapistId("");
                    setStart(null);
                  }}
                  className="choice p-5 text-left"
                >
                  <span className="block font-display text-xl leading-snug">{p.name}</span>
                  <span className="mt-1 block text-sm opacity-75">
                    {p.variants.map((v) => v.durationMin).join(" / ")} {t.treatments.minutes} · {formatPrice(Math.min(...p.variants.map((v) => v.priceCents)), locale)}+
                  </span>
                </button>
              ))}
            </div>
            {procedure && procedure.variants.length > 1 && (
              <fieldset>
                <legend className="label mb-3">{tb.chooseDuration}</legend>
                <div className="flex flex-wrap gap-2">
                  {procedure.variants.map((v) => (
                    <button key={v.id} type="button" aria-pressed={variantId === v.id} onClick={() => setVariantId(v.id)} className="choice px-5 py-3">
                      {v.durationMin} {t.treatments.minutes} · {formatPrice(v.priceCents, locale)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {procedure && procedure.therapistsRequired > 1 && <p className="text-sm text-muted">{tb.couplesNote}</p>}
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" disabled={!variant} onClick={() => setStep(1)}>
                {tb.continue}
              </button>
            </div>
          </section>
        )}

        {step === 1 && variant && procedure && (
          <section className="space-y-8">
            <h2 className="text-3xl">{tb.stepDate}</h2>
            <DateStrip dates={dates} value={dateKey} onChange={(k) => setDateKey(k)} locale={locale} label={tb.chooseDate} />

            <div className="field max-w-sm">
              <label htmlFor="therapist">{tb.chooseTherapist}</label>
              {therapists ? (
                <select id="therapist" className="input" value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
                  <option value="">{tb.anyTherapist}</option>
                  {qualified.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} — {x.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="hint">
                  {tb.therapistLocked}{" "}
                  <Link href={`/${locale}/login?next=/${locale}/book?procedure=${procedure.slug}`} className="text-bronze-deep underline underline-offset-4">
                    {t.nav.login}
                  </Link>
                </p>
              )}
            </div>

            <TimeGrid
              deps={[variant.id, dateKey, therapistId]}
              load={async () => {
                const res = await fetchSlotsAction({ variantId: variant.id, dateKey, therapistId: therapistId || null });
                return "slots" in res ? res.slots : res;
              }}
              value={start}
              onChange={setStart}
              label={tb.chooseTime}
              emptyText={tb.noSlots}
              loadingText={tb.loading}
            />

            <div className="flex justify-between">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
                {tb.back}
              </button>
              <button type="button" className="btn btn-primary" disabled={start === null} onClick={() => setStep(2)}>
                {tb.continue}
              </button>
            </div>
          </section>
        )}

        {step === 2 && variant && procedure && start !== null && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <h2 className="text-3xl">{tb.stepDetails}</h2>
            {!user && (
              <p className="text-sm text-muted">
                {tb.guestNote}{" "}
                <Link href={`/${locale}/login?next=/${locale}/book?procedure=${procedure.slug}`} className="text-bronze-deep underline underline-offset-4">
                  {tb.signInFor}
                </Link>
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="name" label={tb.name} invalid={fieldError === "name"}>
                <input id="name" className="input" autoComplete="name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={fieldError === "name"} />
              </Field>
              <Field id="phone" label={tb.phone} hint={tb.phoneHint} invalid={fieldError === "phone"}>
                <input id="phone" type="tel" className="input" autoComplete="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={fieldError === "phone"} />
              </Field>
            </div>
            <Field id="email" label={tb.email} invalid={fieldError === "email"}>
              <input id="email" type="email" className="input" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={fieldError === "email"} />
            </Field>
            <Field id="notes" label={tb.notes} hint={tb.notesHint}>
              <textarea id="notes" className="input min-h-24" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} action="booking" locale={locale} onToken={setBotToken} resetKey={botReset} />}
            <p className="text-xs text-muted">{tb.cancelPolicy}</p>
            <div className="flex justify-between">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                {tb.back}
              </button>
              <button className="btn btn-accent" disabled={pending || (!!turnstileSiteKey && !botToken)}>
                {pending ? tb.confirming : tb.confirm}
              </button>
            </div>
          </form>
        )}
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="card p-6">
          <p className="eyebrow">{tb.summary}</p>
          {procedure ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="sr-only">{tb.stepTreatment}</dt>
                <dd className="font-display text-2xl leading-snug">{procedure.name}</dd>
                <dd className="mt-1 text-muted">{procedure.summary}</dd>
              </div>
              {variant && <Row k={tb.chooseDuration} v={`${variant.durationMin} ${t.treatments.minutes}`} />}
              {step >= 1 && <Row k={tb.stepDate} v={`${dateLabel}${start !== null ? `, ${fmtTime(start)}` : ""}`} />}
              {therapistName && <Row k={tb.chooseTherapist} v={therapistName} />}
              {variant && (
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-muted">€</dt>
                  <dd className="font-display text-2xl">{formatPrice(variant.priceCents, locale)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">{tb.chooseTreatment}</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function Field({ id, label, hint, invalid, children }: { id: string; label: string; hint?: string; invalid?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !invalid && <span className="hint">{hint}</span>}
    </div>
  );
}

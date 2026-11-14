import { useEffect, useRef, useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";

export interface SlotOption {
  start: number;
  label: string;
}

const DATES_STEP = 14;

const localeTag = (l: Locale) => (l === "bg" ? "bg-BG" : "en-GB");

export function DateStrip({
  dates,
  value,
  onChange,
  locale,
  label,
}: {
  dates: string[];
  value: string | null;
  onChange: (k: string) => void;
  locale: Locale;
  label: string;
}) {
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(localeTag(locale), { ...o, timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));
  const selectedIdx = value ? dates.indexOf(value) : -1;
  const [shown, setShown] = useState(() => Math.max(DATES_STEP, selectedIdx + 1));
  const visible = dates.slice(0, shown);
  return (
    // min-w-0: a fieldset is min-content wide by default and would stretch the page
    <fieldset className="min-w-0">
      <legend className="label mb-3">{label}</legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-2">
        {visible.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className="choice flex flex-col items-center px-2 py-2.5"
          >
            <span className="text-[0.7rem] uppercase tracking-wider opacity-70">{fmt(k, { weekday: "short" })}</span>
            <span className="font-display text-2xl leading-tight">{fmt(k, { day: "numeric" })}</span>
            <span className="text-[0.7rem] opacity-70">{fmt(k, { month: "short" })}</span>
          </button>
        ))}
      </div>
      {(shown < dates.length || shown > DATES_STEP) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {shown < dates.length && (
            <button type="button" onClick={() => setShown((n) => n + DATES_STEP)} className="btn btn-ghost btn-sm">
              {locale === "bg" ? "Още дати" : "More dates"}
            </button>
          )}
          {shown > DATES_STEP && (
            <button
              type="button"
              onClick={() => setShown(DATES_STEP)}
              className="btn btn-ghost btn-sm"
            >
              {locale === "bg" ? "Скрий" : "Show less"}
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}

export function TimeGrid({
  load,
  deps,
  value,
  onChange,
  label,
  emptyText,
  loadingText,
}: {
  load: () => Promise<SlotOption[] | { error: string }>;
  deps: unknown[];
  value: number | null;
  onChange: (start: number | null) => void;
  label: string;
  emptyText: string;
  loadingText: string;
}) {
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [pending, startTransition] = useTransition();
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    startTransition(async () => {
      const res = await load();
      if (id !== reqId.current) return;
      const list = Array.isArray(res) ? res : [];
      setSlots(list);
      if (value !== null && !list.some((s) => s.start === value)) onChange(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <fieldset aria-busy={pending}>
      <legend className="label mb-3">{label}</legend>
      {pending && !slots ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-sand/60" />
          ))}
          <span className="sr-only">{loadingText}</span>
        </div>
      ) : slots && slots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <div className={`grid grid-cols-4 gap-2 transition-opacity sm:grid-cols-6 ${pending ? "opacity-50" : ""}`}>
          {slots?.map((s) => (
            <button
              key={s.start}
              type="button"
              aria-pressed={value === s.start}
              onClick={() => onChange(s.start)}
              className="choice min-h-11 px-2 text-sm tabular-nums"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}

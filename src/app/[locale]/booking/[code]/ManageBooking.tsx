"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { DateStrip, TimeGrid } from "@/components/SlotPicker";
import { cancelBookingAction, fetchSlotsAction, rescheduleBookingAction } from "../../book/actions";

export function ManageBooking({
  locale,
  t,
  code,
  token,
  variantId,
  dates,
}: {
  locale: Locale;
  t: Dictionary;
  code: string;
  token?: string;
  variantId: string;
  dates: string[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule">("idle");
  const [dateKey, setDateKey] = useState(dates[0]);
  const [start, setStart] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const errorText = (e?: string) => (e === "TOO_LATE" ? t.manage.tooLate : e === "SLOT_TAKEN" ? t.booking.slotTaken : t.errors.generic);

  return (
    <div className="space-y-6">
      {message && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.kind === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-ghost" onClick={() => setMode("reschedule")}>
            {t.manage.reschedule}
          </button>
          <button className="btn btn-danger" onClick={() => setMode("cancel")}>
            {t.manage.cancel}
          </button>
        </div>
      )}

      {mode === "cancel" && (
        <div className="rounded-2xl border border-[#e3c2b6] bg-danger-soft/50 p-5">
          <p className="text-sm">{t.booking.cancelPolicy}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="btn btn-danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await cancelBookingAction(code, token);
                  if (res.ok) {
                    setMessage({ kind: "ok", text: t.manage.cancelled });
                    setMode("idle");
                    router.refresh();
                  } else setMessage({ kind: "error", text: errorText(res.error) });
                })
              }
            >
              {t.manage.cancelConfirm}
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("idle")}>
              {t.manage.keep}
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="space-y-6">
          <h2 className="text-2xl">{t.manage.rescheduleTitle}</h2>
          <DateStrip dates={dates} value={dateKey} onChange={setDateKey} locale={locale} label={t.booking.chooseDate} />
          <TimeGrid
            deps={[dateKey]}
            load={async () => {
              const res = await fetchSlotsAction({ variantId, dateKey, rescheduleCode: code });
              return "slots" in res ? res.slots : res;
            }}
            value={start}
            onChange={setStart}
            label={t.booking.chooseTime}
            emptyText={t.booking.noSlots}
            loadingText={t.booking.loading}
          />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-ghost" onClick={() => setMode("idle")}>
              {t.booking.back}
            </button>
            <button
              className="btn btn-primary"
              disabled={start === null || pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await rescheduleBookingAction(code, token, dateKey, start!);
                  if (res.ok) {
                    setMessage({ kind: "ok", text: t.manage.rescheduled });
                    setMode("idle");
                    router.refresh();
                  } else setMessage({ kind: "error", text: errorText(res.error) });
                })
              }
            >
              {t.manage.reschedule}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

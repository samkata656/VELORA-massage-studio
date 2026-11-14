import type { Metadata } from "next";
import { db } from "@/lib/db";
import { TARGET_THERAPISTS_PER_DAY } from "@/lib/config";
import { ensureRotaAhead, weekView, type RotaPreview } from "@/lib/services/rota";
import { schedulerConnected } from "@/lib/services/scheduler-chat";
import { weekStats } from "@/lib/services/stats";
import { describeViolation, describeWarning } from "@/lib/scheduling/describe";
import type { RotaWarning } from "@/lib/scheduling/rota";
import { mondayOf, todayKey, utcDateToKey } from "@/lib/time";
import { PageHeader, Panel, WeekNav, shortDay } from "@/components/admin/ui";
import { WeekStatsTable } from "@/components/admin/WeekStatsTable";
import { RotaGrid } from "./RotaGrid";
import { SchedulerChat, type ChatMessage } from "./SchedulerChat";
import { ManualChange } from "./ManualChange";
import { deleteAbsenceAction } from "../actions";

export const metadata: Metadata = { title: "Work rota" };

const absenceNames: Record<string, string> = { SICK: "Sick leave", PAID_LEAVE: "Paid leave", UNPAID: "Unpaid leave", OTHER: "Absence" };

export default async function RotaPage({ searchParams }: PageProps<"/admin/rota">) {
  await ensureRotaAhead();
  const today = todayKey();
  const sp = await searchParams;
  const monday = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? mondayOf(sp.week) : mondayOf(today);

  const [view, stats, rawMessages, allTherapists] = await Promise.all([
    weekView(monday),
    weekStats(monday),
    db.schedulerMessage.findMany({ orderBy: { createdAt: "asc" }, take: 60 }),
    db.therapist.findMany({ select: { id: true, name: true } }),
  ]);
  const name = (id: string) => allTherapists.find((t) => t.id === id)?.name ?? "Therapist";
  const short = (id: string) => name(id).split(" ")[0];

  const cells: Record<string, { working: boolean; absence: string | null }> = {};
  for (const t of view.therapists)
    for (const d of view.days)
      cells[`${t.id}|${d}`] = { working: !!view.shifts.get(t.id)?.has(d), absence: view.typeByDay.get(`${t.id}|${d}`) ?? null };

  // "Maria (5): Wed 18 Nov, Wed 25 Nov, …" — one line per therapist instead of one long list.
  const byTherapist = (list: { therapistId: string; date: string }[]) => {
    const groups = new Map<string, string[]>();
    for (const a of [...list].sort((x, y) => x.date.localeCompare(y.date)))
      groups.set(a.therapistId, [...(groups.get(a.therapistId) ?? []), shortDay(a.date)]);
    return [...groups].map(([id, days]) => `${short(id)} (${days.length}): ${days.join(", ")}`);
  };
  const groupWarnings = (warnings: RotaWarning[]) => {
    const thin = warnings.flatMap((w) => (w.type === "UNDERSTAFFED" ? [shortDay(w.date)] : []));
    const rest = [...new Set(warnings.filter((w) => w.type !== "UNDERSTAFFED").map((w) => describeWarning(w, name)))];
    return thin.length ? [...rest, `Fewer than ${TARGET_THERAPISTS_PER_DAY} therapists on ${thin.length} day(s): ${thin.join(", ")}`] : rest;
  };

  const pendingProposal = [...rawMessages].reverse().find((m) => m.status === "PROPOSED");
  const pv = pendingProposal?.preview as unknown as RotaPreview | undefined;
  const preview = pv
    ? { added: pv.added.map((a) => `${a.therapistId}|${a.date}`), removed: pv.removed.map((a) => `${a.therapistId}|${a.date}`) }
    : null;

  const messages: ChatMessage[] = rawMessages.map((m) => {
    const p = m.preview as unknown as RotaPreview | null;
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      summary: p
        ? {
            absences: p.absences.map((a) => `${a.therapistName}: ${absenceNames[a.type].toLowerCase()} ${shortDay(a.from)} – ${shortDay(a.to)}`),
            added: byTherapist(p.added),
            removed: byTherapist(p.removed),
            warnings: groupWarnings(p.warnings),
            issues: p.issues,
          }
        : undefined,
    };
  });

  const futureAbsences = view.absenceRows.filter((a) => utcDateToKey(a.toDate) >= today);

  return (
    <>
      <PageHeader title="Work rota" lead="Shifts are 10:00–19:00. The rota is generated 8 weeks ahead; use the AI assistant or click days to adjust it." />

      <div className="grid gap-6 2xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel title="Week" action={<WeekNav monday={monday} basePath="/admin/rota" today={today} />}>
            <RotaGrid
              days={view.days}
              today={today}
              therapists={view.therapists.map((t) => ({ id: t.id, name: t.name }))}
              cells={cells}
              coverage={Object.fromEntries(view.coverage)}
              target={TARGET_THERAPISTS_PER_DAY}
              preview={preview}
            />
            {view.violations.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                {view.violations.map((v, i) => (
                  <li key={i}>⚠ {describeViolation(v, name)}</li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Shifts & expected revenue this week">
            <WeekStatsTable stats={stats} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="AI scheduling assistant">
            <SchedulerChat messages={messages} connected={schedulerConnected()} />
          </Panel>

          <Panel title="Manual change">
            <ManualChange therapists={view.therapists.map((t) => ({ id: t.id, name: t.name }))} today={today} />
          </Panel>

          <Panel title="Upcoming absences">
            {futureAbsences.length === 0 ? (
              <p className="text-sm text-muted">No absences recorded.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {futureAbsences.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      <strong className="font-medium">{name(a.therapistId)}</strong> · {absenceNames[a.type]} · {shortDay(utcDateToKey(a.fromDate))} – {shortDay(utcDateToKey(a.toDate))}
                      {a.note && <span className="text-muted"> — {a.note}</span>}
                    </span>
                    <form action={deleteAbsenceAction.bind(null, a.id)}>
                      <button className="text-xs text-danger hover:underline">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">Removing an absence does not add shifts back automatically — click the days in the grid or ask the assistant.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}

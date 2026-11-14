import type { RotaWarning, RuleViolation } from "./rota";

const day = (k: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));

export function describeWarning(w: RotaWarning, name: (id: string) => string): string {
  switch (w.type) {
    case "UNDERSTAFFED":
      return `${day(w.date)}: only ${w.count} of ${w.target} therapists available.`;
    case "BELOW_MINIMUM":
      return `${day(w.date)}: only ${w.count} therapist(s) — below the minimum of 2 (couples massage impossible).`;
    case "EXTRA_SHORTFALL":
      return `${name(w.therapistId)}: ${w.granted} of ${w.requested} extra shift(s) could be added (max 5 days in a row, 2 consecutive days off per week).`;
    case "BOOKED_DAY_REMOVED":
      return `${name(w.therapistId)} has bookings on ${day(w.date)} but is no longer working — reassign them after applying.`;
    case "FORCED_ON_IMPOSSIBLE":
      return `${name(w.therapistId)} cannot work on ${day(w.date)} without breaking the rota rules.`;
    case "RULE_CONFLICT":
      return `${name(w.therapistId)}: week of ${day(w.weekStart)} cannot fully satisfy the rules because of past shifts.`;
  }
}

export function describeViolation(v: RuleViolation, name: (id: string) => string): string {
  switch (v.type) {
    case "CONSECUTIVE":
      return `${name(v.therapistId)} would work ${v.run} days in a row (${day(v.from)} – ${day(v.to)}); the maximum is 5.`;
    case "NO_WEEKLY_REST":
      return `${name(v.therapistId)} would not have 2 consecutive days off in the week of ${day(v.weekStart)}.`;
    case "WORKS_WHILE_ABSENT":
      return `${name(v.therapistId)} is marked absent on ${day(v.date)}.`;
  }
}

import {
  MAX_CONSECUTIVE_WORK_DAYS,
  MIN_THERAPISTS_PER_DAY,
  TARGET_THERAPISTS_PER_DAY,
} from "../config";
import { addDays, type DateKey, mondayOf, rangeKeys } from "../time";

/**
 * Rota rules (interpretation agreed for VELORA):
 *  1. Nobody works more than 5 days in a row (also across week boundaries).
 *  2. Every calendar week (Mon–Sun) contains at least 2 consecutive days off.
 * Absences (sick, leave) are days off. Coverage target = 3 therapists/day (one per room),
 * hard minimum = 2 (couples massage needs two).
 */

export type DaySet = Set<DateKey>;
export type TherapistDays = Map<string, DaySet>;

export interface ExtraShiftRequest {
  therapistId: string;
  count: number;
  from: DateKey;
  to: DateKey;
}

export interface RotaInput {
  therapistIds: string[];
  /** Mondays of the weeks to (re)generate, ascending. */
  weekStarts: DateKey[];
  /** All currently stored shifts (inside and outside the range). */
  existing: TherapistDays;
  absences: TherapistDays;
  forcedOff?: TherapistDays;
  forcedOn?: TherapistDays;
  extraShifts?: ExtraShiftRequest[];
  /** Days before this key are in the past and stay as they are. */
  lockedBefore?: DateKey;
  /** Days on which a therapist already has booked appointments. */
  bookedDays?: TherapistDays;
  targetPerDay?: (key: DateKey) => number;
}

export type RotaWarning =
  | { type: "UNDERSTAFFED"; date: DateKey; count: number; target: number }
  | { type: "BELOW_MINIMUM"; date: DateKey; count: number }
  | { type: "EXTRA_SHORTFALL"; therapistId: string; requested: number; granted: number }
  | { type: "BOOKED_DAY_REMOVED"; therapistId: string; date: DateKey }
  | { type: "FORCED_ON_IMPOSSIBLE"; therapistId: string; date: DateKey }
  | { type: "RULE_CONFLICT"; therapistId: string; weekStart: DateKey };

export interface RotaResult {
  /** Work days per therapist for the generated weeks only. */
  shifts: TherapistDays;
  warnings: RotaWarning[];
}

const has = (m: TherapistDays | undefined, id: string, k: DateKey) => !!m?.get(id)?.has(k);
const bit = (mask: number, d: number) => (mask >> d) & 1;
const popcount = (mask: number) => {
  let c = 0;
  for (let d = 0; d < 7; d++) c += bit(mask, d);
  return c;
};

function maxRun(mask: number): number {
  let best = 0;
  let run = 0;
  for (let d = 0; d < 7; d++) {
    run = bit(mask, d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
const leadRun = (mask: number) => {
  let r = 0;
  while (r < 7 && bit(mask, r)) r++;
  return r;
};
const trailRun = (mask: number) => {
  let r = 0;
  while (r < 7 && bit(mask, 6 - r)) r++;
  return r;
};
function hasOffPair(mask: number): boolean {
  for (let d = 0; d < 6; d++) if (!bit(mask, d) && !bit(mask, d + 1)) return true;
  return false;
}
/** Number of separate off-blocks; fragmented weeks are less pleasant. */
function offBlocks(mask: number): number {
  let blocks = 0;
  for (let d = 0; d < 7; d++) if (!bit(mask, d) && (d === 0 || bit(mask, d - 1))) blocks++;
  return blocks;
}

function maskFromSet(days: DaySet | undefined, monday: DateKey): number {
  let m = 0;
  for (let d = 0; d < 7; d++) if (days?.has(addDays(monday, d))) m |= 1 << d;
  return m;
}

/** Consecutive work days ending the day before `key`, looking at most 7 days back. */
function runBefore(lookup: (k: DateKey) => boolean, key: DateKey): number {
  let r = 0;
  for (let k = addDays(key, -1); r < 7 && lookup(k); k = addDays(k, -1)) r++;
  return r;
}
function runFrom(lookup: (k: DateKey) => boolean, key: DateKey): number {
  let r = 0;
  for (let k = key; r < 7 && lookup(k); k = addDays(k, 1)) r++;
  return r;
}

interface WeekCtx {
  monday: DateKey;
  days: DateKey[];
  target: number[];
  candidates: Map<string, number[]>;
  desired: Map<string, number>;
  /** Explicit "extra shifts" requests: at least this many days (published days + extras). */
  minDays: Map<string, number>;
  existingMask: Map<string, number>;
  prevMask: Map<string, number>;
  booked: Map<string, number>;
}

function weekCost(ctx: WeekCtx, patterns: Map<string, number>): number {
  let cost = 0;
  for (let d = 0; d < 7; d++) {
    let cov = 0;
    for (const p of patterns.values()) cov += bit(p, d);
    const target = ctx.target[d];
    if (cov < MIN_THERAPISTS_PER_DAY) cost += 1000 * (MIN_THERAPISTS_PER_DAY - cov);
    if (cov < target) cost += 100 * (target - cov) ** 2;
    if (cov > target) cost += 40 * (cov - target); // only 3 rooms: a 4th therapist is idle
  }
  for (const [id, p] of patterns) cost += therapistCost(ctx, id, p);
  return cost;
}

function therapistCost(ctx: WeekCtx, id: string, p: number): number {
  let cost = 25 * (popcount(p) - (ctx.desired.get(id) ?? 0)) ** 2;
  // An admin's explicit request outweighs the mild overstaffing penalty.
  cost += 60 * Math.max(0, (ctx.minDays.get(id) ?? 0) - popcount(p));
  const ex = ctx.existingMask.get(id) ?? 0;
  if (ex) cost += 6 * popcount(p ^ ex); // stay close to what is already published
  const prev = ctx.prevMask.get(id);
  if (prev !== undefined) cost += 1 * popcount(p ^ prev); // week-to-week continuity
  cost += 3 * Math.max(0, offBlocks(p) - 1);
  const booked = ctx.booked.get(id) ?? 0;
  cost += 400 * popcount(booked & ~p);
  return cost;
}

function solve(input: RotaInput, extras: Map<string, Map<DateKey, number>>): RotaResult {
  const { therapistIds, weekStarts } = input;
  const target = input.targetPerDay ?? (() => TARGET_THERAPISTS_PER_DAY);
  const result: TherapistDays = new Map(therapistIds.map((id) => [id, new Set<DateKey>()]));
  const warnings: RotaWarning[] = [];
  const generated = new Set(weekStarts);
  const lastPattern = new Map<string, number>();

  // A day counts as "working" if solved already (generated weeks) or stored (others).
  const worksOn = (id: string, k: DateKey) =>
    generated.has(mondayOf(k)) ? result.get(id)!.has(k) : has(input.existing, id, k);

  for (const monday of weekStarts) {
    const days = rangeKeys(monday, addDays(monday, 6));
    const ctx: WeekCtx = {
      monday,
      days,
      target: days.map(target),
      candidates: new Map(),
      desired: new Map(),
      minDays: new Map(),
      existingMask: new Map(),
      prevMask: new Map(),
      booked: new Map(),
    };
    const nextMonday = addDays(monday, 7);
    const capacity = new Map<string, number>();

    for (const id of therapistIds) {
      let offMask = 0;
      let onMask = 0;
      let lockMask = 0;
      for (let d = 0; d < 7; d++) {
        const k = days[d];
        if (has(input.absences, id, k) || has(input.forcedOff, id, k)) offMask |= 1 << d;
        if (has(input.forcedOn, id, k)) onMask |= 1 << d;
        if (input.lockedBefore && k < input.lockedBefore) lockMask |= 1 << d;
      }
      const existingMask = maskFromSet(input.existing.get(id), monday);
      const prevRun = runBefore((k) => worksOn(id, k), monday);
      const nextLead = generated.has(nextMonday) ? 0 : runFrom((k) => has(input.existing, id, k), nextMonday);

      const valid = (p: number, strict: boolean) => {
        if ((p & lockMask) !== (existingMask & lockMask)) return false;
        if (p & offMask & ~lockMask) return false;
        if (!strict) return true;
        if (!hasOffPair(p)) return false;
        if (maxRun(p) > MAX_CONSECUTIVE_WORK_DAYS) return false;
        if (prevRun + leadRun(p) > MAX_CONSECUTIVE_WORK_DAYS) return false;
        if (trailRun(p) + nextLead > MAX_CONSECUTIVE_WORK_DAYS) return false;
        return true;
      };

      const all = Array.from({ length: 128 }, (_, p) => p);
      let cands = all.filter((p) => valid(p, true) && (p & onMask) === onMask);
      if (cands.length === 0) {
        cands = all.filter((p) => valid(p, true));
        for (let d = 0; d < 7; d++)
          if (bit(onMask, d)) warnings.push({ type: "FORCED_ON_IMPOSSIBLE", therapistId: id, date: days[d] });
      }
      if (cands.length === 0) {
        cands = all.filter((p) => valid(p, false));
        warnings.push({ type: "RULE_CONFLICT", therapistId: id, weekStart: monday });
      }
      ctx.candidates.set(id, cands);
      ctx.existingMask.set(id, existingMask);
      if (lastPattern.has(id)) ctx.prevMask.set(id, lastPattern.get(id)!);
      ctx.booked.set(id, maskFromSet(input.bookedDays?.get(id), monday));
      capacity.set(id, Math.min(MAX_CONSECUTIVE_WORK_DAYS, 7 - popcount(offMask)));
    }

    // Fair share of the week's required shifts, proportional to availability, plus extras.
    const totalTarget = ctx.target.reduce((a, b) => a + b, 0);
    const totalCap = [...capacity.values()].reduce((a, b) => a + b, 0) || 1;
    for (const id of therapistIds) {
      const share = (totalTarget * capacity.get(id)!) / totalCap;
      const extra = extras.get(id)?.get(monday) ?? 0;
      ctx.desired.set(id, Math.min(capacity.get(id)!, share + extra));
      if (extra > 0) ctx.minDays.set(id, Math.min(capacity.get(id)!, popcount(ctx.existingMask.get(id)!) + extra));
    }

    // Initial patterns: existing if allowed, otherwise a staggered default, then coordinate descent.
    const patterns = new Map<string, number>();
    therapistIds.forEach((id, i) => {
      const cands = ctx.candidates.get(id)!;
      const ex = ctx.existingMask.get(id)!;
      const prev = ctx.prevMask.get(id);
      const offStart = (i * 1) % 6;
      const staggered = 0b1111111 & ~((1 << offStart) | (1 << (offStart + 1)));
      const pick = [ex, prev, staggered].find((p) => p !== undefined && p !== 0 && cands.includes(p));
      patterns.set(id, pick ?? cands[0]);
    });

    optimiseWeek(ctx, therapistIds, patterns);

    for (const id of therapistIds) {
      const p = patterns.get(id)!;
      lastPattern.set(id, p);
      for (let d = 0; d < 7; d++) {
        if (bit(p, d)) result.get(id)!.add(days[d]);
        else if (bit(ctx.booked.get(id)!, d)) warnings.push({ type: "BOOKED_DAY_REMOVED", therapistId: id, date: days[d] });
      }
    }
    for (let d = 0; d < 7; d++) {
      if (input.lockedBefore && days[d] < input.lockedBefore) continue;
      let cov = 0;
      for (const p of patterns.values()) cov += bit(p, d);
      if (cov < MIN_THERAPISTS_PER_DAY) warnings.push({ type: "BELOW_MINIMUM", date: days[d], count: cov });
      else if (cov < ctx.target[d]) warnings.push({ type: "UNDERSTAFFED", date: days[d], count: cov, target: ctx.target[d] });
    }
  }
  return { shifts: result, warnings };
}

/**
 * Local search over each therapist's week pattern. Single-therapist moves first; when those
 * stall, try changing two therapists together (e.g. moving a spare Sunday shift to a short
 * Thursday often needs a second person to cover the day the first one gives up).
 */
function optimiseWeek(ctx: WeekCtx, ids: string[], patterns: Map<string, number>) {
  let cost = weekCost(ctx, patterns);
  for (let round = 0; round < 20; round++) {
    for (let pass = 0; pass < 40; pass++) {
      let changed = false;
      for (const id of ids) {
        const before = patterns.get(id)!;
        let best = before;
        for (const p of ctx.candidates.get(id)!) {
          if (p === best) continue;
          patterns.set(id, p);
          const c = weekCost(ctx, patterns);
          if (c < cost) {
            cost = c;
            best = p;
          }
        }
        patterns.set(id, best);
        if (best !== before) changed = true;
      }
      if (!changed) break;
    }

    let improved = false;
    for (let i = 0; i < ids.length && !improved; i++) {
      for (let j = i + 1; j < ids.length && !improved; j++) {
        const [a, b] = [ids[i], ids[j]];
        const [a0, b0] = [patterns.get(a)!, patterns.get(b)!];
        let best: [number, number] | null = null;
        for (const pa of ctx.candidates.get(a)!) {
          patterns.set(a, pa);
          for (const pb of ctx.candidates.get(b)!) {
            patterns.set(b, pb);
            const c = weekCost(ctx, patterns);
            if (c < cost) {
              cost = c;
              best = [pa, pb];
            }
          }
        }
        patterns.set(a, best ? best[0] : a0);
        patterns.set(b, best ? best[1] : b0);
        if (best) improved = true;
      }
    }
    if (!improved) break;
  }
}

/** Spread requested extra shifts over the weeks they fall into (max 2 per week each). */
function distributeExtras(input: RotaInput): Map<string, Map<DateKey, number>> {
  const out = new Map<string, Map<DateKey, number>>();
  for (const req of input.extraShifts ?? []) {
    const weeks = input.weekStarts.filter((m) => addDays(m, 6) >= req.from && m <= req.to);
    const perWeek = out.get(req.therapistId) ?? new Map<DateKey, number>();
    let left = req.count;
    while (left > 0 && weeks.length) {
      let placed = false;
      for (const w of weeks) {
        if (left === 0) break;
        if ((perWeek.get(w) ?? 0) < 2) {
          perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
          left--;
          placed = true;
        }
      }
      if (!placed) break;
    }
    out.set(req.therapistId, perWeek);
  }
  return out;
}

export function generateRota(input: RotaInput): RotaResult {
  const extras = distributeExtras(input);
  const res = solve(input, extras);
  if (input.extraShifts?.length) {
    const baseline = solve(input, new Map());
    for (const req of input.extraShifts) {
      const inRange = (s: DaySet | undefined) => [...(s ?? [])].filter((k) => k >= req.from && k <= req.to).length;
      const granted = Math.max(0, inRange(res.shifts.get(req.therapistId)) - inRange(baseline.shifts.get(req.therapistId)));
      if (granted < req.count)
        res.warnings.push({ type: "EXTRA_SHORTFALL", therapistId: req.therapistId, requested: req.count, granted });
    }
  }
  return res;
}

export type RuleViolation =
  | { type: "CONSECUTIVE"; therapistId: string; from: DateKey; to: DateKey; run: number }
  | { type: "NO_WEEKLY_REST"; therapistId: string; weekStart: DateKey }
  | { type: "WORKS_WHILE_ABSENT"; therapistId: string; date: DateKey };

/**
 * Validates stored/edited shifts between `from` and `to` (inclusive).
 * Weeks are checked only when fully inside the known range.
 */
export function validateRota(
  shifts: TherapistDays,
  absences: TherapistDays,
  from: DateKey,
  to: DateKey,
): RuleViolation[] {
  const out: RuleViolation[] = [];
  for (const [id, days] of shifts) {
    let run = 0;
    let runStart = from;
    for (const k of rangeKeys(from, to)) {
      if (days.has(k)) {
        if (run === 0) runStart = k;
        run++;
        if (has(absences, id, k)) out.push({ type: "WORKS_WHILE_ABSENT", therapistId: id, date: k });
      } else {
        if (run > MAX_CONSECUTIVE_WORK_DAYS) out.push({ type: "CONSECUTIVE", therapistId: id, from: runStart, to: addDays(k, -1), run });
        run = 0;
      }
    }
    if (run > MAX_CONSECUTIVE_WORK_DAYS) out.push({ type: "CONSECUTIVE", therapistId: id, from: runStart, to, run });

    for (let m = mondayOf(from) < from ? addDays(mondayOf(from), 7) : from; addDays(m, 6) <= to; m = addDays(m, 7)) {
      if (!hasOffPair(maskFromSet(days, m))) out.push({ type: "NO_WEEKLY_REST", therapistId: id, weekStart: m });
    }
  }
  return out;
}

export function coverageByDay(shifts: TherapistDays, keys: DateKey[]): Map<DateKey, number> {
  const cov = new Map(keys.map((k) => [k, 0]));
  for (const days of shifts.values()) for (const k of keys) if (days.has(k)) cov.set(k, cov.get(k)! + 1);
  return cov;
}

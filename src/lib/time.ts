import { TZDate } from "@date-fns/tz";
import { STUDIO_TZ } from "./config";

/** Date keys are "YYYY-MM-DD" strings for a studio-local calendar day. */
export type DateKey = string;

export function keyToUtcDate(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function utcDateToKey(d: Date): DateKey {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = keyToUtcDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcDateToKey(d);
}

/** 0 = Monday … 6 = Sunday */
export function weekday(key: DateKey): number {
  return (keyToUtcDate(key).getUTCDay() + 6) % 7;
}

export function mondayOf(key: DateKey): DateKey {
  return addDays(key, -weekday(key));
}

export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((keyToUtcDate(b).getTime() - keyToUtcDate(a).getTime()) / 86_400_000);
}

export function rangeKeys(from: DateKey, toInclusive: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= toInclusive; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Studio-local date + minutes → absolute instant. */
export function localToInstant(key: DateKey, minutes: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, STUDIO_TZ).getTime());
}

/** Absolute instant → studio-local date key. */
export function instantToKey(instant: Date): DateKey {
  const t = new TZDate(instant.getTime(), STUDIO_TZ);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Absolute instant → studio-local minutes after midnight. */
export function instantToMinutes(instant: Date): number {
  const t = new TZDate(instant.getTime(), STUDIO_TZ);
  return t.getHours() * 60 + t.getMinutes();
}

export function todayKey(now = new Date()): DateKey {
  return instantToKey(now);
}

export function fmtMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "Week 46" (ISO-8601 week number). */
export function isoWeekLabel(key: DateKey): string {
  const thursday = keyToUtcDate(addDays(key, 3 - weekday(key)));
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return `Week ${Math.ceil(((thursday.getTime() - jan1) / 86_400_000 + 1) / 7)}`;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

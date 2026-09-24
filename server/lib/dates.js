import { env } from "../env.js";

const DAY_MS = 86_400_000;

// All calendar maths uses YYYY-MM-DD strings interpreted as UTC midnight, so server timezone never leaks in.
export const toUtc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

export function todayIn(timeZone = env.APP_TIMEZONE, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Wall-clock date ("YYYY-MM-DD") and time ("HH:MM") in `timeZone` → the matching instant. */
export function zonedDateTime(date, time, timeZone = env.APP_TIMEZONE) {
  const guess = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +time.slice(0, 2), +time.slice(3, 5));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (shown - guess));
}

export function* eachDate(start, end) {
  for (let t = toUtc(start); t <= toUtc(end); t += DAY_MS) yield fromUtc(t);
}

export const daysBetweenInclusive = (start, end) => Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1;
export const weekday = (iso) => new Date(toUtc(iso)).getUTCDay();
export const addDays = (iso, n) => fromUtc(toUtc(iso) + n * DAY_MS);

export function monthRange(month) {
  // month: "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const start = fromUtc(Date.UTC(y, m - 1, 1));
  const end = fromUtc(Date.UTC(y, m, 0));
  return { start, end };
}

export const yearRange = (year) => ({ start: `${year}-01-01`, end: `${year}-12-31` });
export const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;

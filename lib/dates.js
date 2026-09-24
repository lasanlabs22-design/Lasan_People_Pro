import { TZ } from "./format";

// YYYY-MM-DD strings treated as UTC midnight so the viewer's timezone never shifts a day.
const toUtc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

export function todayIso(timeZone = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export const addDays = (iso, n) => fromUtc(toUtc(iso) + n * 86_400_000);

export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export const monthLabel = (month, opts = { month: "long", year: "numeric" }) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

/** Calendar cells for a month, Monday-first, padded with nulls. */
export function monthCells(month) {
  const first = `${month}-01`;
  const lead = (new Date(toUtc(first)).getUTCDay() + 6) % 7;
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array(lead).fill(null);
  for (let d = 0; d < count; d++) cells.push(addDays(first, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const weekday = (iso) => new Date(toUtc(iso)).getUTCDay();

export function* eachDate(start, end) {
  for (let t = toUtc(start); t <= toUtc(end); t += 86_400_000) yield fromUtc(t);
}

/** A past day with a check-in but no check-out — the employee forgot to punch out. */
export const missedCheckOut = (record, today = todayIso()) => Boolean(record && !record.checkOutAt && record.date < today);

export const isMonth =(s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isYear = (s) => typeof s === "string" && /^\d{4}$/.test(s);
export const isIsoDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;

/**
 * Expand leave requests into { date: [leave, ...] } for calendar rendering.
 * Weekends and mandatory holidays are skipped unless the type counts calendar days,
 * matching how the API deducts the balance.
 */
export function leavesByDate(leaves, { weekendDays = [0, 6], holidays = [], statuses = ["approved", "pending"] } = {}) {
  const offDays = new Set(holidays.filter((h) => !h.isOptional).map((h) => h.date));
  const map = {};
  for (const l of leaves) {
    if (!statuses.includes(l.status)) continue;
    for (const d of eachDate(l.startDate, l.endDate)) {
      if (!l.leaveType.countsCalendarDays && (weekendDays.includes(weekday(d)) || offDays.has(d))) continue;
      (map[d] ??= []).push(l);
    }
  }
  return map;
}

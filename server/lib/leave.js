import { and, eq, gte, lte, inArray, asc } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { eachDate, daysBetweenInclusive, weekday, yearRange } from "./dates.js";
import { getSetting } from "./settings.js";

const { leaveTypes, leaveRequests, leaveAllocations, holidays, attendance } = schema;

export const isEligible = (type, gender) => type.eligibleGender === "any" || type.eligibleGender === gender;

export async function holidaySet(start, end) {
  const rows = await db
    .select({ date: holidays.date })
    .from(holidays)
    .where(and(gte(holidays.date, start), lte(holidays.date, end), eq(holidays.isOptional, false)));
  return new Set(rows.map((r) => r.date));
}

/** A weekly off day or a mandatory holiday. */
export async function isOffDay(date) {
  const weekend = await getSetting("weekendDays");
  return weekend.includes(weekday(date)) || (await holidaySet(date, date)).has(date);
}

/** Approved full-day leave that actually applies on `date` (types that skip off-days don't apply on one). */
export async function fullDayLeaveOn(userId, date) {
  const rows = await db
    .select({ name: leaveTypes.name, countsCalendarDays: leaveTypes.countsCalendarDays })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
    .where(
      and(
        eq(leaveRequests.userId, userId),
        eq(leaveRequests.status, "approved"),
        eq(leaveRequests.halfDay, "none"),
        lte(leaveRequests.startDate, date),
        gte(leaveRequests.endDate, date),
      ),
    )
    .limit(1);
  const [leave] = rows;
  if (!leave) return null;
  if (!leave.countsCalendarDays && (await isOffDay(date))) return null;
  return { name: leave.name };
}

/** Dates in [start, end] on which the employee punched in — they worked, so they can't also be on full-day leave. */
export async function punchedDates(userId, start, end) {
  const rows = await db
    .select({ date: attendance.date })
    .from(attendance)
    .where(and(eq(attendance.userId, userId), gte(attendance.date, start), lte(attendance.date, end)))
    .orderBy(asc(attendance.date));
  return rows.map((r) => r.date);
}

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).replace("Sept", "Sep");

/** Plain-language list for messages: "24 Sep", "24 Sep and 25 Sep", "24 Sep, 25 Sep and 1 more". */
export function listDates(dates) {
  const shown = dates.slice(0, 2).map(shortDate);
  if (dates.length > 2) return `${shown.join(", ")} and ${dates.length - 2} more`;
  return shown.join(" and ");
}

/** Number of leave days a request consumes. */
export async function countLeaveDays(type, start, end, halfDay = "none") {
  if (halfDay !== "none") return 0.5;
  if (type.countsCalendarDays) return daysBetweenInclusive(start, end);

  const weekend = new Set(await getSetting("weekendDays"));
  const hols = await holidaySet(start, end);
  let n = 0;
  for (const d of eachDate(start, end)) if (!weekend.has(weekday(d)) && !hols.has(d)) n++;
  return n;
}

/** Per-type balance for one employee in one calendar year. */
export async function leaveBalances(user, year) {
  const { start, end } = yearRange(year);
  const [types, allocations, requests] = await Promise.all([
    db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true)).orderBy(asc(leaveTypes.sortOrder)),
    db
      .select()
      .from(leaveAllocations)
      .where(and(eq(leaveAllocations.userId, user.id), eq(leaveAllocations.year, year))),
    db
      .select({ leaveTypeId: leaveRequests.leaveTypeId, status: leaveRequests.status, days: leaveRequests.days })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, user.id),
          gte(leaveRequests.startDate, start),
          lte(leaveRequests.startDate, end),
          inArray(leaveRequests.status, ["pending", "approved"]),
        ),
      ),
  ]);

  const override = new Map(allocations.map((a) => [a.leaveTypeId, a.days]));
  return types
    .filter((t) => isEligible(t, user.gender))
    .map((t) => {
      const quota = override.get(t.id) ?? t.annualQuota;
      let used = 0;
      let pending = 0;
      for (const r of requests) {
        if (r.leaveTypeId !== t.id) continue;
        if (r.status === "approved") used += r.days;
        else pending += r.days;
      }
      return {
        leaveTypeId: t.id,
        code: t.code,
        name: t.name,
        color: t.color,
        countsCalendarDays: t.countsCalendarDays,
        allowHalfDay: t.allowHalfDay,
        quota,
        used,
        pending,
        available: Math.max(quota - used - pending, 0),
        overridden: override.has(t.id),
      };
    });
}

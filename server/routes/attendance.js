import { Hono } from "hono";
import { z } from "zod";
import { and, asc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { evaluateGeofence, formatDistance } from "../lib/geo.js";
import { monthRange, todayIn, weekday, zonedDateTime } from "../lib/dates.js";
import { badRequest, conflict, notFound, ApiError } from "../lib/errors.js";
import { isoDate, monthQuery, optionalText, uuidParam } from "../lib/validators.js";
import { audit } from "../lib/audit.js";
import { env } from "../env.js";
import { getSetting } from "../lib/settings.js";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const { attendance, officeLocations, users, leaveRequests, leaveTypes, holidays } = schema;

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(100_000).optional(),
  note: optionalText(300),
});

const activeOffices = () =>
  db
    .select({
      id: officeLocations.id,
      name: officeLocations.name,
      latitude: officeLocations.latitude,
      longitude: officeLocations.longitude,
      radiusMeters: officeLocations.radiusMeters,
    })
    .from(officeLocations)
    .where(eq(officeLocations.isActive, true));

/**
 * Applies the org's geofence policy to a submitted position.
 * Returns the columns to persist; throws when the policy forbids the punch.
 */
async function resolvePosition(input) {
  const mode = await getSetting("geofenceMode");
  if (mode === "off") return { source: "remote", lat: null, lng: null, accuracy: null, officeId: null, distance: null };

  if (input.latitude === undefined || input.longitude === undefined) {
    throw badRequest("Location is required. Allow location access in your browser and try again.");
  }

  const offices = await activeOffices();
  const pos = { latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy ?? 0 };
  const fence = evaluateGeofence(offices, pos);

  if (mode === "enforce" && offices.length > 0 && !fence.inside) {
    throw new ApiError(
      403,
      `You're ${formatDistance(fence.distance)} from ${fence.office.name}. Move within ${formatDistance(fence.office.radiusMeters)} to punch.`,
      "outside_geofence",
    );
  }

  return {
    source: fence.inside ? "geo" : "remote",
    lat: pos.latitude,
    lng: pos.longitude,
    accuracy: input.accuracy ?? null,
    officeId: fence.inside ? fence.office.id : null,
    distance: fence.distance,
  };
}

export const attendanceRoutes = new Hono();

attendanceRoutes.get("/today", async (c) => {
  const user = c.get("user");
  const date = todayIn();
  const [[record], geofenceMode, offices] = await Promise.all([
    db.select().from(attendance).where(and(eq(attendance.userId, user.id), eq(attendance.date, date))),
    getSetting("geofenceMode"),
    activeOffices(),
  ]);
  return c.json({ date, record: record ?? null, geofenceMode, offices });
});

attendanceRoutes.post("/check-in", validate("json", positionSchema), async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");
  const date = todayIn();
  const pos = await resolvePosition(input);

  const [record] = await db
    .insert(attendance)
    .values({
      userId: user.id,
      date,
      source: pos.source,
      checkInAt: new Date(),
      checkInLat: pos.lat,
      checkInLng: pos.lng,
      checkInAccuracy: pos.accuracy,
      checkInOfficeId: pos.officeId,
      checkInDistance: pos.distance,
      note: input.note ?? null,
    })
    .onConflictDoNothing({ target: [attendance.userId, attendance.date] })
    .returning();
  if (!record) throw conflict("You have already checked in today");
  return c.json({ record }, 201);
});

attendanceRoutes.post("/check-out", validate("json", positionSchema), async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");
  const date = todayIn();
  const pos = await resolvePosition(input);

  const [record] = await db
    .update(attendance)
    .set({
      checkOutAt: new Date(),
      checkOutLat: pos.lat,
      checkOutLng: pos.lng,
      checkOutAccuracy: pos.accuracy,
      checkOutOfficeId: pos.officeId,
      checkOutDistance: pos.distance,
      ...(input.note ? { note: input.note } : {}),
    })
    .where(and(eq(attendance.userId, user.id), eq(attendance.date, date), isNull(attendance.checkOutAt)))
    .returning();
  if (!record) {
    const [existing] = await db.select().from(attendance).where(and(eq(attendance.userId, user.id), eq(attendance.date, date)));
    throw conflict(existing ? "You have already checked out today" : "Check in first");
  }
  return c.json({ record });
});

export async function attendanceForMonth(userId, month) {
  const { start, end } = monthRange(month);
  return db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, userId), gte(attendance.date, start), lte(attendance.date, end)))
    .orderBy(asc(attendance.date));
}

attendanceRoutes.get("/mine", validate("query", z.object({ month: monthQuery.optional() })), async (c) => {
  const month = c.req.valid("query").month ?? todayIn().slice(0, 7);
  return c.json({ month, records: await attendanceForMonth(c.get("user").id, month) });
});

/* ------------------------------ Admin ------------------------------ */

export const adminAttendanceRoutes = new Hono();
adminAttendanceRoutes.use("*", requireRole("admin"));

/**
 * Who was expected in on `date`, and what happened.
 * The roll is everyone (non-admin) who had joined by then and wasn't yet revoked — plus anyone who punched or
 * was on leave that day, so history never loses a record. On weekly-off days and mandatory holidays nobody is
 * expected, so a missing punch reads "off" rather than "absent".
 */
export async function rollCall(date) {
  const [people, punches, leaves, dayHolidays, weekendDays] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        employeeCode: users.employeeCode,
        designation: users.designation,
        dateOfJoining: users.dateOfJoining,
        status: users.status,
        revokedAt: users.revokedAt,
      })
      .from(users)
      .where(ne(users.role, "admin"))
      .orderBy(asc(users.name)),
    db.select().from(attendance).where(eq(attendance.date, date)),
    db
      .select({
        userId: leaveRequests.userId,
        halfDay: leaveRequests.halfDay,
        type: leaveTypes.name,
        color: leaveTypes.color,
        countsCalendarDays: leaveTypes.countsCalendarDays,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(and(eq(leaveRequests.status, "approved"), lte(leaveRequests.startDate, date), gte(leaveRequests.endDate, date))),
    db.select({ name: holidays.name, isOptional: holidays.isOptional }).from(holidays).where(eq(holidays.date, date)),
    getSetting("weekendDays"),
  ]);

  const holiday = dayHolidays.find((h) => !h.isOptional);
  const dayOff = holiday ? { reason: "holiday", name: holiday.name } : weekendDays.includes(weekday(date)) ? { reason: "weekend" } : null;

  const punchBy = new Map(punches.map((p) => [p.userId, p]));
  // Leave that skips off-days (everything but calendar-day types like maternity) doesn't apply on one.
  const leaveBy = new Map(leaves.filter((l) => !dayOff || l.countsCalendarDays).map((l) => [l.userId, l]));

  const rows = [];
  for (const { revokedAt, dateOfJoining, status: access, ...p } of people) {
    const record = punchBy.get(p.id) ?? null;
    const leave = leaveBy.get(p.id) ?? null;
    const joined = !dateOfJoining || dateOfJoining <= date;
    const stillEmployed = access === "active" || (revokedAt && todayIn(env.APP_TIMEZONE, revokedAt) > date);
    if (!record && !leave && !(joined && stillEmployed)) continue;
    const status = record ? "present" : leave ? "leave" : dayOff ? "off" : "absent";
    rows.push({ ...p, revoked: access === "revoked", record, leave, status });
  }

  const tally = (s) => rows.filter((r) => r.status === s).length;
  const summary = { total: rows.length, present: tally("present"), onLeave: tally("leave"), off: tally("off"), absent: tally("absent") };
  return { date, dayOff, summary, rows };
}

adminAttendanceRoutes.get("/", validate("query", z.object({ date: isoDate.optional() })), async (c) => {
  const today = todayIn();
  const date = c.req.valid("query").date ?? today;
  if (date > today) throw badRequest("The roll-call only covers today and earlier", { date: "Can't be in the future" });
  return c.json(await rollCall(date));
});

// Fill in a check-out the employee forgot, for a past day. Today stays theirs to punch.
adminAttendanceRoutes.post(
  "/:id/check-out",
  validate("param", uuidParam),
  validate("json", z.object({ time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 18:30") })),
  async (c) => {
    const { id } = c.req.valid("param");
    const { time } = c.req.valid("json");
    const [record] = await db.select().from(attendance).where(eq(attendance.id, id));
    if (!record) throw notFound("Attendance record");
    if (record.checkOutAt) throw conflict("This day already has a check-out");
    if (record.date >= todayIn()) throw badRequest("The employee can still check out themselves today");

    const checkOutAt = zonedDateTime(record.date, time);
    if (checkOutAt <= record.checkInAt) {
      throw badRequest(`Check-out must be after the ${fmtClock(record.checkInAt)} check-in`, { time: "Must be after check-in" });
    }

    const [updated] = await db
      .update(attendance)
      .set({ checkOutAt })
      .where(and(eq(attendance.id, id), isNull(attendance.checkOutAt)))
      .returning();
    if (!updated) throw conflict("This day already has a check-out");
    await audit(c.get("user").id, "attendance.check_out_set", "attendance", id, { userId: record.userId, date: record.date, time });
    return c.json({ record: updated });
  },
);

const fmtClock = (ts) =>
  new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: env.APP_TIMEZONE });

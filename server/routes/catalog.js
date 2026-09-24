import { Hono } from "hono";
import { z } from "zod";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { isEligible } from "../lib/leave.js";
import { todayIn, yearRange } from "../lib/dates.js";
import { conflict, notFound } from "../lib/errors.js";
import { isoDate, optionalText, uuidParam, yearQuery } from "../lib/validators.js";
import { getSettings, putSettings } from "../lib/settings.js";
import { audit } from "../lib/audit.js";
import { env } from "../env.js";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const { leaveTypes, holidays, officeLocations } = schema;

/* ---------------------------- Leave types ---------------------------- */

export const leaveTypeRoutes = new Hono();

leaveTypeRoutes.get("/", async (c) => {
  const user = c.get("user");
  let rows = await db.select().from(leaveTypes).orderBy(asc(leaveTypes.sortOrder));
  if (user.role !== "admin") rows = rows.filter((t) => t.isActive && isEligible(t, user.gender));
  return c.json({ leaveTypes: rows });
});

const leaveTypeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z_]{2,24}$/, "2–24 letters/underscores"),
  name: z.string().trim().min(2).max(60),
  description: optionalText(500),
  annualQuota: z.coerce.number().min(0).max(366),
  eligibleGender: z.enum(["any", "male", "female"]).default("any"),
  countsCalendarDays: z.boolean().default(false),
  allowHalfDay: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex colour like #22c55e").default("#6366f1"),
  sortOrder: z.coerce.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

leaveTypeRoutes.post("/", requireRole("admin"), validate("json", leaveTypeSchema), async (c) => {
  const [row] = await db.insert(leaveTypes).values(c.req.valid("json")).returning();
  await audit(c.get("user").id, "leave_type.created", "leave_type", row.id);
  return c.json({ leaveType: row }, 201);
});

leaveTypeRoutes.patch(
  "/:id",
  requireRole("admin"),
  validate("param", uuidParam),
  validate("json", leaveTypeSchema.partial()),
  async (c) => {
    const { id } = c.req.valid("param");
    const [row] = await db.update(leaveTypes).set(c.req.valid("json")).where(eq(leaveTypes.id, id)).returning();
    if (!row) throw notFound("Leave type");
    await audit(c.get("user").id, "leave_type.updated", "leave_type", id, c.req.valid("json"));
    return c.json({ leaveType: row });
  },
);

/* ------------------------------ Holidays ------------------------------ */

export const holidayRoutes = new Hono();

holidayRoutes.get("/", validate("query", z.object({ year: yearQuery.optional() })), async (c) => {
  const year = c.req.valid("query").year ?? Number(todayIn().slice(0, 4));
  const { start, end } = yearRange(year);
  const rows = await db
    .select()
    .from(holidays)
    .where(and(gte(holidays.date, start), lte(holidays.date, end)))
    .orderBy(asc(holidays.date));
  return c.json({ year, holidays: rows });
});

const holidaySchema = z.object({
  date: isoDate,
  name: z.string().trim().min(2, "Name the holiday").max(120),
  isOptional: z.boolean().default(false),
});

holidayRoutes.post("/", requireRole("admin"), validate("json", holidaySchema), async (c) => {
  const data = c.req.valid("json");
  const [existing] = await db.select({ id: holidays.id }).from(holidays).where(eq(holidays.date, data.date));
  if (existing) throw conflict("There is already a holiday on that date");
  const [row] = await db.insert(holidays).values({ ...data, createdBy: c.get("user").id }).returning();
  await audit(c.get("user").id, "holiday.created", "holiday", row.id, data);
  return c.json({ holiday: row }, 201);
});

holidayRoutes.patch(
  "/:id",
  requireRole("admin"),
  validate("param", uuidParam),
  validate("json", holidaySchema.partial()),
  async (c) => {
    const { id } = c.req.valid("param");
    const [row] = await db.update(holidays).set(c.req.valid("json")).where(eq(holidays.id, id)).returning();
    if (!row) throw notFound("Holiday");
    await audit(c.get("user").id, "holiday.updated", "holiday", id);
    return c.json({ holiday: row });
  },
);

holidayRoutes.delete("/:id", requireRole("admin"), validate("param", uuidParam), async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db.delete(holidays).where(eq(holidays.id, id)).returning();
  if (!row) throw notFound("Holiday");
  await audit(c.get("user").id, "holiday.deleted", "holiday", id, { date: row.date, name: row.name });
  return c.json({ ok: true });
});

/* ------------------------- Offices & settings ------------------------- */

// What any signed-in user needs to render calendars and the punch card.
export const configRoutes = new Hono();
configRoutes.get("/", async (c) => {
  const { companyName, weekendDays, geofenceMode } = await getSettings();
  return c.json({ companyName, weekendDays, geofenceMode, timezone: env.APP_TIMEZONE, today: todayIn() });
});

export const orgRoutes = new Hono();
orgRoutes.use("*", requireRole("admin"));

const officeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: optionalText(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(20, "At least 20 m").max(5000, "At most 5 km"),
  isActive: z.boolean().default(true),
});

orgRoutes.get("/offices", async (c) => {
  return c.json({ offices: await db.select().from(officeLocations).orderBy(asc(officeLocations.name)) });
});

orgRoutes.post("/offices", validate("json", officeSchema), async (c) => {
  const [row] = await db.insert(officeLocations).values(c.req.valid("json")).returning();
  await audit(c.get("user").id, "office.created", "office", row.id);
  return c.json({ office: row }, 201);
});

orgRoutes.patch("/offices/:id", validate("param", uuidParam), validate("json", officeSchema.partial()), async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db.update(officeLocations).set(c.req.valid("json")).where(eq(officeLocations.id, id)).returning();
  if (!row) throw notFound("Office");
  await audit(c.get("user").id, "office.updated", "office", id);
  return c.json({ office: row });
});

orgRoutes.delete("/offices/:id", validate("param", uuidParam), async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db.delete(officeLocations).where(eq(officeLocations.id, id)).returning();
  if (!row) throw notFound("Office");
  await audit(c.get("user").id, "office.deleted", "office", id);
  return c.json({ ok: true });
});

orgRoutes.get("/settings", async (c) => c.json({ settings: await getSettings() }));

orgRoutes.put(
  "/settings",
  validate(
    "json",
    z.object({
      geofenceMode: z.enum(["enforce", "record", "off"]).optional(),
      weekendDays: z.array(z.number().int().min(0).max(6)).max(6).optional(),
      companyName: z.string().trim().min(1).max(80).optional(),
    }),
  ),
  async (c) => {
    const settings = await putSettings(c.req.valid("json"));
    await audit(c.get("user").id, "settings.updated", "settings", null, c.req.valid("json"));
    return c.json({ settings });
  },
);

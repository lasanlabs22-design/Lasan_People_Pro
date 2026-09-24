import { Hono } from "hono";
import { z } from "zod";
import { and, asc, avg, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { generateTempPassword, hashPassword, publicUser } from "../lib/auth.js";
import { leaveBalances } from "../lib/leave.js";
import { todayIn, yearRange } from "../lib/dates.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { isoDate, monthQuery, optionalText, password, uuidParam, yearQuery } from "../lib/validators.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { leaveQuery } from "./leaves.js";
import { attendanceForMonth } from "./attendance.js";
import { loadProfile } from "./me.js";

const { users, profiles, ratings, leaveRequests, leaveAllocations, leaveTypes } = schema;

export const employeeRoutes = new Hono();
employeeRoutes.use("*", requireRole("admin"));

async function findUser(id) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw notFound("Employee");
  return user;
}

employeeRoutes.get(
  "/",
  validate("query", z.object({ q: z.string().trim().max(100).optional(), status: z.enum(["active", "revoked", "all"]).default("all") })),
  async (c) => {
    const { q, status } = c.req.valid("query");
    const where = [];
    if (status !== "all") where.push(eq(users.status, status));
    if (q) {
      const like = `%${q}%`;
      where.push(or(ilike(users.name, like), ilike(users.email, like), ilike(users.employeeCode, like), ilike(users.department, like)));
    }
    const ratingAgg = db
      .select({ userId: ratings.userId, avgScore: avg(ratings.score).as("avg_score"), ratingCount: count().as("rating_count") })
      .from(ratings)
      .groupBy(ratings.userId)
      .as("r");

    const rows = await db
      .select({ user: users, avatar: profiles.avatar, avgScore: ratingAgg.avgScore, ratingCount: ratingAgg.ratingCount })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(ratingAgg, eq(ratingAgg.userId, users.id))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(users.status), asc(users.name));

    return c.json({
      employees: rows.map((r) => ({
        ...publicUser(r.user),
        avatar: r.avatar ?? null,
        rating: r.avgScore ? Number(Number(r.avgScore).toFixed(1)) : null,
        ratingCount: Number(r.ratingCount ?? 0),
      })),
    });
  },
);

const employeeSchema = z.object({
  employeeCode: z.string().trim().regex(/^[A-Za-z0-9_-]{2,32}$/, "2–32 letters, numbers, - or _").toUpperCase(),
  name: z.string().trim().min(2, "Enter the full name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  gender: z.enum(["male", "female", "other"], "Select a gender"),
  designation: optionalText(120),
  department: optionalText(120),
  dateOfJoining: isoDate.or(z.literal("").transform(() => null)).nullish(),
  // No default here: .partial() keeps defaults, so an edit that doesn't mention the role would reset it.
  role: z.enum(["employee", "admin"]),
});

employeeRoutes.post(
  "/",
  validate(
    "json",
    employeeSchema.extend({
      role: employeeSchema.shape.role.default("employee"),
      password: password.optional().or(z.literal("").transform(() => undefined)),
    }),
  ),
  async (c) => {
    const { password: chosen, ...data } = c.req.valid("json");
    const tempPassword = chosen || generateTempPassword();
    const [user] = await db
      .insert(users)
      .values({ ...data, passwordHash: await hashPassword(tempPassword), mustChangePassword: true })
      .returning();
    await db.insert(profiles).values({ userId: user.id }).onConflictDoNothing();
    await audit(c.get("user").id, "employee.created", "user", user.id, { employeeCode: user.employeeCode });
    // The temp password is shown to the admin exactly once; only its hash is stored.
    return c.json({ employee: publicUser(user), tempPassword, workspace: c.get("tenant").slug }, 201);
  },
);

employeeRoutes.get(
  "/:id",
  validate("param", uuidParam),
  validate("query", z.object({ year: yearQuery.optional() })),
  async (c) => {
    const user = await findUser(c.req.valid("param").id);
    const year = c.req.valid("query").year ?? Number(todayIn().slice(0, 4));
    const [profile, balances, ratingRows] = await Promise.all([
      loadProfile(user.id),
      leaveBalances(user, year),
      db
        .select({
          id: ratings.id,
          score: ratings.score,
          period: ratings.period,
          comment: ratings.comment,
          createdAt: ratings.createdAt,
          ratedByName: sql`(select name from users u where u.id = ${ratings.ratedBy})`,
        })
        .from(ratings)
        .where(eq(ratings.userId, user.id))
        .orderBy(desc(ratings.createdAt)),
    ]);
    const avgScore = ratingRows.length ? ratingRows.reduce((s, r) => s + r.score, 0) / ratingRows.length : null;
    return c.json({
      employee: publicUser(user),
      profile,
      year,
      balances,
      ratings: ratingRows,
      rating: avgScore ? Number(avgScore.toFixed(1)) : null,
    });
  },
);

employeeRoutes.patch("/:id", validate("param", uuidParam), validate("json", employeeSchema.partial()), async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");
  if (id === c.get("user").id && patch.role && patch.role !== "admin") throw badRequest("You can't remove your own admin role");
  const [user] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  if (!user) throw notFound("Employee");
  await audit(c.get("user").id, "employee.updated", "user", id, patch);
  return c.json({ employee: publicUser(user) });
});

employeeRoutes.post("/:id/revoke", validate("param", uuidParam), async (c) => {
  const { id } = c.req.valid("param");
  if (id === c.get("user").id) throw badRequest("You can't revoke your own access");
  const user = await findUser(id);
  if (user.status === "revoked") throw conflict("Access is already revoked");
  const [updated] = await db
    .update(users)
    .set({ status: "revoked", revokedAt: new Date(), tokenVersion: user.tokenVersion + 1 })
    .where(eq(users.id, id))
    .returning();
  // Withdraw anything still awaiting a decision.
  await db
    .update(leaveRequests)
    .set({ status: "cancelled", reviewComment: "Auto-cancelled: access revoked" })
    .where(and(eq(leaveRequests.userId, id), eq(leaveRequests.status, "pending")));
  await audit(c.get("user").id, "employee.revoked", "user", id);
  return c.json({ employee: publicUser(updated) });
});

employeeRoutes.post("/:id/reinstate", validate("param", uuidParam), async (c) => {
  const { id } = c.req.valid("param");
  const user = await findUser(id);
  if (user.status === "active") throw conflict("Employee is already active");
  const [updated] = await db.update(users).set({ status: "active", revokedAt: null }).where(eq(users.id, id)).returning();
  await audit(c.get("user").id, "employee.reinstated", "user", id);
  return c.json({ employee: publicUser(updated) });
});

employeeRoutes.post("/:id/reset-password", validate("param", uuidParam), async (c) => {
  const { id } = c.req.valid("param");
  const user = await findUser(id);
  const tempPassword = generateTempPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true, tokenVersion: user.tokenVersion + 1 })
    .where(eq(users.id, id));
  await audit(c.get("user").id, "employee.password_reset", "user", id);
  return c.json({ tempPassword, workspace: c.get("tenant").slug });
});

employeeRoutes.get(
  "/:id/leaves",
  validate("param", uuidParam),
  validate("query", z.object({ year: yearQuery.optional() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const year = c.req.valid("query").year ?? Number(todayIn().slice(0, 4));
    const { start, end } = yearRange(year);
    const leaves = await leaveQuery()
      .where(and(eq(leaveRequests.userId, id), lte(leaveRequests.startDate, end), gte(leaveRequests.endDate, start)))
      .orderBy(desc(leaveRequests.startDate));
    return c.json({ year, leaves });
  },
);

employeeRoutes.get(
  "/:id/attendance",
  validate("param", uuidParam),
  validate("query", z.object({ month: monthQuery.optional() })),
  async (c) => {
    const month = c.req.valid("query").month ?? todayIn().slice(0, 7);
    return c.json({ month, records: await attendanceForMonth(c.req.valid("param").id, month) });
  },
);

employeeRoutes.post(
  "/:id/ratings",
  validate("param", uuidParam),
  validate(
    "json",
    z.object({
      score: z.coerce.number().int().min(1, "Pick 1–5 stars").max(5),
      period: z.string().trim().regex(/^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/, "Use YYYY, YYYY-MM or YYYY-Q1..Q4"),
      comment: optionalText(1000),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    await findUser(id);
    const [rating] = await db
      .insert(ratings)
      .values({ ...c.req.valid("json"), userId: id, ratedBy: c.get("user").id })
      .returning();
    await audit(c.get("user").id, "employee.rated", "user", id, { score: rating.score, period: rating.period });
    return c.json({ rating }, 201);
  },
);

employeeRoutes.delete("/:id/ratings/:ratingId", validate("param", uuidParam.extend({ ratingId: z.uuid() })), async (c) => {
  const { id, ratingId } = c.req.valid("param");
  const [row] = await db.delete(ratings).where(and(eq(ratings.id, ratingId), eq(ratings.userId, id))).returning();
  if (!row) throw notFound("Rating");
  return c.json({ ok: true });
});

// Override one leave type's quota for an employee for a year (pro-rata joiners, special grants).
employeeRoutes.put(
  "/:id/allocations",
  validate("param", uuidParam),
  validate(
    "json",
    z.object({
      leaveTypeId: z.uuid(),
      year: yearQuery,
      days: z.coerce.number().min(0).max(366).nullable(),
      note: optionalText(300),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const { leaveTypeId, year, days, note } = c.req.valid("json");
    const user = await findUser(id);
    const [type] = await db.select({ id: leaveTypes.id }).from(leaveTypes).where(eq(leaveTypes.id, leaveTypeId));
    if (!type) throw notFound("Leave type");

    const match = and(eq(leaveAllocations.userId, id), eq(leaveAllocations.leaveTypeId, leaveTypeId), eq(leaveAllocations.year, year));
    if (days === null) {
      await db.delete(leaveAllocations).where(match); // back to the default quota
    } else {
      await db
        .insert(leaveAllocations)
        .values({ userId: id, leaveTypeId, year, days, note })
        .onConflictDoUpdate({
          target: [leaveAllocations.userId, leaveAllocations.leaveTypeId, leaveAllocations.year],
          set: { days, note, updatedAt: new Date() },
        });
    }
    await audit(c.get("user").id, "employee.allocation_set", "user", id, { leaveTypeId, year, days });
    return c.json({ balances: await leaveBalances(user, year) });
  },
);

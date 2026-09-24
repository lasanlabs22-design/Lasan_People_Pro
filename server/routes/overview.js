import { Hono } from "hono";
import { and, asc, count, eq, gte, lte, ne } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { addDays, todayIn } from "../lib/dates.js";
import { requireRole } from "../middleware/auth.js";

const { users, attendance, leaveRequests, holidays } = schema;

export const overviewRoutes = new Hono();
overviewRoutes.use("*", requireRole("admin"));

overviewRoutes.get("/", async (c) => {
  const today = todayIn();
  const [[employees], [present], [onLeave], [pending], upcomingHolidays] = await Promise.all([
    db.select({ n: count() }).from(users).where(and(eq(users.status, "active"), ne(users.role, "admin"))),
    // Same population as the roll-call: active, non-admin staff.
    db
      .select({ n: count() })
      .from(attendance)
      .innerJoin(users, eq(users.id, attendance.userId))
      .where(and(eq(attendance.date, today), eq(users.status, "active"), ne(users.role, "admin"))),
    db
      .select({ n: count() })
      .from(leaveRequests)
      .innerJoin(users, eq(users.id, leaveRequests.userId))
      .where(
        and(
          eq(leaveRequests.status, "approved"),
          lte(leaveRequests.startDate, today),
          gte(leaveRequests.endDate, today),
          eq(users.status, "active"),
        ),
      ),
    db.select({ n: count() }).from(leaveRequests).where(eq(leaveRequests.status, "pending")),
    db
      .select()
      .from(holidays)
      .where(and(gte(holidays.date, today), lte(holidays.date, addDays(today, 90))))
      .orderBy(asc(holidays.date))
      .limit(5),
  ]);
  return c.json({
    date: today,
    stats: { employees: employees.n, present: present.n, onLeave: onLeave.n, pendingLeaves: pending.n },
    upcomingHolidays,
  });
});

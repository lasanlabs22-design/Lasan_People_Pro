import { Hono } from "hono";
import { and, asc, count, eq, gte, lte, ne } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { addDays, todayIn } from "../lib/dates.js";
import { requireRole } from "../middleware/auth.js";
import { rollCall } from "./attendance.js";

const { users, leaveRequests, holidays } = schema;

export const overviewRoutes = new Hono();
overviewRoutes.use("*", requireRole("admin"));

overviewRoutes.get("/", async (c) => {
  const today = todayIn();
  const [[employees], roll, [pending], upcomingHolidays] = await Promise.all([
    db.select({ n: count() }).from(users).where(and(eq(users.status, "active"), ne(users.role, "admin"))),
    // Same numbers as the Attendance page, so the two never disagree.
    rollCall(today),
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
    dayOff: roll.dayOff,
    stats: { employees: employees.n, present: roll.summary.present, onLeave: roll.summary.onLeave, pendingLeaves: pending.n },
    upcomingHolidays,
  });
});

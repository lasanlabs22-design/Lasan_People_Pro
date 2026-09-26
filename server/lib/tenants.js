import { randomUUID } from "node:crypto";
import { db, schema, withTenant } from "../db/client.js";
import { hashPassword } from "./auth.js";
import { todayIn } from "./dates.js";
import { audit } from "./audit.js";

// Defaults based on common Indian practice (see README "Leave policy"). Admins can edit these anytime.
const LEAVE_TYPES = [
  {
    code: "CASUAL",
    name: "Casual Leave",
    description: "Short personal errands and planned time off. Does not carry forward.",
    annualQuota: 12,
    color: "#6366f1",
    sortOrder: 1,
  },
  {
    code: "SICK",
    name: "Sick Leave",
    description: "Illness or medical appointments. A medical certificate may be requested for 3+ consecutive days.",
    annualQuota: 12,
    color: "#10b981",
    sortOrder: 2,
  },
  {
    code: "EMERGENCY",
    name: "Emergency Leave",
    description: "Unforeseen family or personal emergencies.",
    annualQuota: 5,
    color: "#f59e0b",
    sortOrder: 3,
  },
  {
    code: "MATERNITY",
    name: "Maternity Leave",
    description: "26 weeks (182 calendar days) for the first two children under the Maternity Benefit Act, 1961.",
    annualQuota: 182,
    eligibleGender: "female",
    countsCalendarDays: true,
    allowHalfDay: false,
    color: "#ec4899",
    sortOrder: 4,
  },
];

const FIXED_HOLIDAYS = [
  ["01-26", "Republic Day"],
  ["05-01", "Labour Day"],
  ["08-15", "Independence Day"],
  ["10-02", "Gandhi Jayanti"],
  ["12-25", "Christmas"],
];

// Names that would read as ours rather than a customer's.
const RESERVED_SLUGS = new Set(["admin", "api", "app", "www", "login", "signup", "support", "help", "status", "system"]);
export const isReservedSlug = (slug) => RESERVED_SLUGS.has(slug.toLowerCase());

/**
 * Creates a workspace with its first admin and default policy, all in one transaction.
 * The tenant id is chosen up front and placed in the context, which is what lets RLS accept the
 * tenant row and everything that hangs off it.
 * `createdBy` names the platform admin who set it up; their chosen password is then temporary,
 * so the new admin must replace it on first sign-in.
 */
export async function createTenant({ slug, companyName, admin, createdBy }) {
  const tenantId = randomUUID();
  const adminId = randomUUID();
  return withTenant({ tenantId, userId: adminId, role: "admin" }, async () => {
    const [tenant] = await db.insert(schema.tenants).values({ id: tenantId, slug: slug.toLowerCase(), name: companyName }).returning();

    const [user] = await db
      .insert(schema.users)
      .values({
        id: adminId,
        employeeCode: admin.employeeCode.toUpperCase(),
        email: admin.email.toLowerCase(),
        name: admin.name,
        gender: admin.gender ?? "other",
        role: "admin",
        designation: "Administrator",
        passwordHash: await hashPassword(admin.password),
        mustChangePassword: Boolean(createdBy),
      })
      .returning();
    await db.insert(schema.profiles).values({ userId: user.id });

    await db.insert(schema.leaveTypes).values(LEAVE_TYPES);
    const year = Number(todayIn().slice(0, 4));
    await db
      .insert(schema.holidays)
      .values(FIXED_HOLIDAYS.map(([md, name]) => ({ date: `${year}-${md}`, name, createdBy: user.id })));
    await db.insert(schema.settings).values({ key: "companyName", value: companyName });

    await audit(user.id, "tenant.created", "tenant", tenantId, { slug: tenant.slug, ...(createdBy ? { createdBy } : {}) });
    return { tenant, user };
  });
}

import { Hono } from "hono";
import { z } from "zod";
import { eq, or, sql } from "drizzle-orm";
import { db, findTenantBySlug, schema, setActor } from "../db/client.js";
import { signToken, verifyPassword, hashPassword, publicUser } from "../lib/auth.js";
import { badRequest, unauthorized, forbidden } from "../lib/errors.js";
import { password } from "../lib/validators.js";
import { audit } from "../lib/audit.js";
import { createTenant, isReservedSlug } from "../lib/tenants.js";
import { inTenant, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createLimiter, clientIp } from "../middleware/rate-limit.js";

const { users, profiles } = schema;
export const authRoutes = new Hono();

const publicTenant = (t) => ({ id: t.id, slug: t.slug, name: t.name });

export const workspaceSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "3–40 lowercase letters, numbers or hyphens");

// Failed sign-ins only. Keyed by account (not the typed text), so the ID and the
// email share one budget. The per-account cap is loose enough that someone else
// can't easily lock a person out, but still bounds guessing from many IPs.
const WINDOW = 15 * 60_000;
const perAccountIp = createLimiter({ windowMs: WINDOW, max: 10 });
const perAccount = createLimiter({ windowMs: WINDOW, max: 50 });
const perIp = createLimiter({ windowMs: WINDOW, max: 100 });
// New workspaces per visitor.
const signups = createLimiter({ windowMs: 60 * 60_000, max: 5 });

function checkLimits(c, keys) {
  try {
    for (const [limiter, key] of keys) limiter.check(key);
  } catch (err) {
    if (err.retryAfter) c.header("Retry-After", String(err.retryAfter));
    throw err;
  }
}

authRoutes.post(
  "/login",
  validate(
    "json",
    z.object({
      workspace: workspaceSlug,
      identifier: z.string().trim().min(1, "Required"),
      password: z.string().min(1, "Required"),
    }),
  ),
  async (c) => {
    const { workspace, identifier, password: plain } = c.req.valid("json");
    const ip = clientIp(c);
    checkLimits(c, [[perIp, ip]]);

    const tenant = await findTenantBySlug(workspace);
    if (!tenant) {
      perIp.hit(ip);
      throw badRequest("We couldn't find that workspace", { workspace: "Check the workspace name with your admin" });
    }
    if (tenant.status !== "active") throw forbidden("This workspace is suspended. Contact Lasan support.");

    let response;
    await inTenant(c, { tenantId: tenant.id }, async () => {
      const id = identifier.toLowerCase();
      // RLS limits this to the workspace's users, so an ID from another company never matches.
      const [user] = await db
        .select()
        .from(users)
        .where(or(eq(sql`lower(${users.email})`, id), eq(sql`lower(${users.employeeCode})`, id)));

      const account = `${tenant.id}:${user?.id ?? `unknown:${id}`}`;
      const keys = [
        [perAccountIp, `${account}|${ip}`],
        [perAccount, account],
        [perIp, ip],
      ];
      checkLimits(c, keys);

      // Same message for unknown user and wrong password so accounts can't be enumerated.
      if (!user || !(await verifyPassword(plain, user.passwordHash))) {
        for (const [limiter, key] of keys) limiter.hit(key);
        throw unauthorized("Invalid ID or password");
      }
      perAccountIp.reset(`${account}|${ip}`);
      if (user.status !== "active") throw forbidden("Your access has been revoked. Contact your administrator.");

      await setActor(user);
      const [updated] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).returning();
      await audit(user.id, "auth.login", "user", user.id);
      response = c.json({ token: await signToken(updated), user: publicUser(updated), tenant: publicTenant(tenant) });
    });
    return response;
  },
);

// Self-serve: a company creates its own workspace and becomes its first admin.
authRoutes.post(
  "/register",
  validate(
    "json",
    z.object({
      companyName: z.string().trim().min(2, "Enter your company name").max(80),
      workspace: workspaceSlug.refine((s) => !isReservedSlug(s), "That name is reserved, pick another"),
      name: z.string().trim().min(2, "Enter your full name").max(120),
      email: z.email("Enter a valid email").trim().toLowerCase(),
      employeeCode: z.string().trim().regex(/^[A-Za-z0-9_-]{2,32}$/, "2–32 letters, numbers, - or _").default("ADMIN"),
      password,
    }),
  ),
  async (c) => {
    const input = c.req.valid("json");
    const ip = clientIp(c);
    checkLimits(c, [[signups, ip]]);
    signups.hit(ip);

    const { tenant, user } = await createTenant({
      slug: input.workspace,
      companyName: input.companyName,
      admin: { name: input.name, email: input.email, employeeCode: input.employeeCode, password: input.password },
    });
    return c.json({ token: await signToken(user), user: publicUser(user), tenant: publicTenant(tenant) }, 201);
  },
);

// Public, so the sign-in page can greet the workspace by name.
authRoutes.get("/workspace/:slug", async (c) => {
  const parsed = workspaceSlug.safeParse(c.req.param("slug"));
  const tenant = parsed.success ? await findTenantBySlug(parsed.data) : null;
  return c.json({ workspace: tenant && tenant.status === "active" ? { slug: tenant.slug, name: tenant.name } : null });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const [profile] = await db
    .select({ avatar: profiles.avatar })
    .from(profiles)
    .where(eq(profiles.userId, user.id));
  return c.json({ user: { ...publicUser(user), avatar: profile?.avatar ?? null }, tenant: publicTenant(c.get("tenant")) });
});

authRoutes.post(
  "/change-password",
  requireAuth,
  validate("json", z.object({ currentPassword: z.string().min(1, "Required"), newPassword: password })),
  async (c) => {
    const user = c.get("user");
    const { currentPassword, newPassword } = c.req.valid("json");
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw badRequest("Current password is incorrect", { currentPassword: "Current password is incorrect" });
    }
    if (currentPassword === newPassword) {
      throw badRequest("Choose a password you haven't used here", { newPassword: "Must differ from the current password" });
    }

    const [updated] = await db
      .update(users)
      .set({
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        tokenVersion: user.tokenVersion + 1,
      })
      .where(eq(users.id, user.id))
      .returning();
    await audit(user.id, "auth.password_changed", "user", user.id);
    // Old tokens are now invalid; hand back a fresh one.
    return c.json({ token: await signToken(updated), user: publicUser(updated), tenant: publicTenant(c.get("tenant")) });
  },
);

authRoutes.post("/logout-all", requireAuth, async (c) => {
  // Signs out every device by rotating the token version.
  const user = c.get("user");
  await db.update(users).set({ tokenVersion: user.tokenVersion + 1 }).where(eq(users.id, user.id));
  return c.json({ ok: true });
});

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
import { addressBlock, createLimiter, clientIp } from "../middleware/rate-limit.js";

const { users, profiles } = schema;
export const authRoutes = new Hono();

const publicTenant = (t) => ({ id: t.id, slug: t.slug, name: t.name });

export const workspaceSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "3–40 lowercase letters, numbers or hyphens");

// Failed sign-ins only. Keyed by account (not the typed text), so the ID and the
// email share one budget. The per-account cap bounds guessing from many addresses;
// an address that has signed in to the account before is exempt from it, so a
// stranger hammering the account can't lock its owner out.
const WINDOW = 15 * 60_000;
const perAccountIp = createLimiter({ name: "login:account-ip", windowMs: WINDOW, max: 10 });
const perAccount = createLimiter({ name: "login:account", windowMs: WINDOW, max: 50 });
const perIp = createLimiter({ name: "login:ip", windowMs: WINDOW, max: 100 });
const trustedAddress = createLimiter({ name: "login:trusted", windowMs: 30 * 24 * 60 * 60_000, max: 1 });
// New workspaces per visitor.
const signups = createLimiter({ name: "signup:ip", windowMs: 60 * 60_000, max: 5 });

// Checked when no such account exists, so a miss costs the same bcrypt work as a wrong
// password and response time doesn't reveal which IDs and emails are real.
let dummyHash;
const hashToCompare = async (user) => user?.passwordHash ?? (dummyHash ??= await hashPassword("no-such-account"));

async function checkLimits(c, keys) {
  try {
    for (const [limiter, key] of keys) await limiter.check(key);
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
    const ip = addressBlock(clientIp(c));
    await checkLimits(c, [[perIp, ip]]);

    const tenant = await findTenantBySlug(workspace);
    if (!tenant) {
      await perIp.hit(ip);
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
      const here = `${account}|${ip}`;
      const trusted = user ? await trustedAddress.exceeded(here) : false;
      const keys = [
        [perAccountIp, here],
        [perAccount, account],
        [perIp, ip],
      ];
      await checkLimits(c, trusted ? keys.filter(([limiter]) => limiter !== perAccount) : keys);

      // Same message (and the same bcrypt work) for unknown user and wrong password,
      // so accounts can't be enumerated.
      const valid = await verifyPassword(plain, await hashToCompare(user));
      if (!user || !valid) {
        for (const [limiter, key] of keys) await limiter.hit(key);
        throw unauthorized("Invalid ID or password");
      }
      await perAccountIp.reset(here);
      await trustedAddress.hit(here);
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
    const ip = addressBlock(clientIp(c));
    await checkLimits(c, [[signups, ip]]);
    await signups.hit(ip);

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

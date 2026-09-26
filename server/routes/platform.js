import { Hono } from "hono";
import { z } from "zod";
import { createMiddleware } from "hono/factory";
import { platform } from "../db/client.js";
import { hashPassword, signPlatformToken, verifyPassword, verifyPlatformToken } from "../lib/auth.js";
import { ApiError, badRequest, forbidden, notFound, unauthorized } from "../lib/errors.js";
import { createTenant, isReservedSlug } from "../lib/tenants.js";
import { password, uuidParam } from "../lib/validators.js";
import { validate } from "../middleware/validate.js";
import { addressBlock, clientIp, createLimiter } from "../middleware/rate-limit.js";
import { workspaceSlug } from "./auth.js";

/*
 * The platform console: Lasan staff create and manage customer workspaces here, and manage their
 * own team. Platform admins belong to no workspace, so nothing here runs in a tenant context
 * except createTenant, which opens the new workspace's own.
 */

const ROLES = ["admin", "staff"];

const publicAdmin = (a) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  role: a.role,
  mustChangePassword: a.must_change_password,
  lastLoginAt: a.last_login_at ?? null,
});

const WINDOW = 15 * 60_000;
const perIp = createLimiter({ name: "platform:ip", windowMs: WINDOW, max: 20 });
const perAccount = createLimiter({ name: "platform:account", windowMs: WINDOW, max: 10 });

let dummyHash;

export const platformAuthRoutes = new Hono();

platformAuthRoutes.post(
  "/login",
  validate("json", z.object({ email: z.string().trim().toLowerCase().min(1, "Required"), password: z.string().min(1, "Required") })),
  async (c) => {
    const { email, password: plain } = c.req.valid("json");
    const ip = addressBlock(clientIp(c));
    const account = email;
    for (const [limiter, key] of [[perIp, ip], [perAccount, account]]) {
      try {
        await limiter.check(key);
      } catch (err) {
        if (err.retryAfter) c.header("Retry-After", String(err.retryAfter));
        throw err;
      }
    }

    const admin = await platform.adminByEmail(email);
    // Same bcrypt work whether or not the account exists, so emails can't be probed by timing.
    const valid = await verifyPassword(plain, admin?.password_hash ?? (dummyHash ??= await hashPassword("no-such-account")));
    if (!admin || !valid || !admin.is_active) {
      await Promise.all([perIp.hit(ip), perAccount.hit(account)]);
      throw unauthorized("Invalid email or password");
    }
    await perAccount.reset(account);
    await platform.signedIn(admin.id);
    return c.json({ token: await signPlatformToken(admin), admin: publicAdmin(admin) });
  },
);

// "Forgot password" from the sign-in page: asks one particular admin for a temporary password.
// The answer is the same whether or not the details match, so it can't reveal who has an account.
const resetRequests = createLimiter({ name: "platform:reset-request", windowMs: 60 * 60_000, max: 10 });

platformAuthRoutes.post(
  "/password-requests",
  validate(
    "json",
    z.object({
      email: z.email("Enter your email").trim().toLowerCase(),
      adminEmail: z.email("Enter the admin's email").trim().toLowerCase(),
    }),
  ),
  async (c) => {
    const { email, adminEmail } = c.req.valid("json");
    const ip = addressBlock(clientIp(c));
    try {
      await resetRequests.check(ip);
    } catch (err) {
      if (err.retryAfter) c.header("Retry-After", String(err.retryAfter));
      throw err;
    }
    await resetRequests.hit(ip);
    await platform.requestPasswordReset(email, adminEmail);
    return c.json({ ok: true });
  },
);

// Reachable while a temporary password is still in place; everything else waits for a new one.
const PASSWORD_CHANGE_ALLOWED = new Set(["/platform/me", "/platform/password"]);

/** Bearer platform token → the platform admin, re-checked so deactivation and resets apply at once. */
const requirePlatformAdmin = createMiddleware(async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const payload = header.startsWith("Bearer ") ? await verifyPlatformToken(header.slice(7)) : null;
  if (!payload) throw unauthorized("Session expired, please sign in again");
  const admin = await platform.adminById(payload.sub);
  if (!admin || admin.token_version !== payload.tv) throw unauthorized("Session expired, please sign in again");
  if (!admin.is_active) throw forbidden("This platform account is disabled");
  if (admin.must_change_password && !PASSWORD_CHANGE_ALLOWED.has(c.req.path)) {
    throw new ApiError(403, "Set your own password before continuing", "password_change_required");
  }
  c.set("platformAdmin", admin);
  await next();
});

export const platformRoutes = new Hono();
platformRoutes.use("*", requirePlatformAdmin);

const requireAdminRole = createMiddleware(async (c, next) => {
  if (c.get("platformAdmin").role !== "admin") throw forbidden("Only Lasan admins can manage the team");
  await next();
});

platformRoutes.get("/me", async (c) => {
  const me = c.get("platformAdmin");
  // Admins see how many people are waiting on them for a temporary password.
  const waiting = me.role === "admin" && !me.must_change_password ? (await platform.passwordRequestsFor(me.id)).length : 0;
  return c.json({ admin: { ...publicAdmin(me), passwordRequests: waiting } });
});

platformRoutes.post(
  "/password",
  validate("json", z.object({ currentPassword: z.string().min(1, "Required"), newPassword: password })),
  async (c) => {
    const admin = c.get("platformAdmin");
    const { currentPassword, newPassword } = c.req.valid("json");
    if (!(await verifyPassword(currentPassword, admin.password_hash))) {
      throw badRequest("Current password is incorrect", { currentPassword: "Current password is incorrect" });
    }
    if (currentPassword === newPassword) {
      throw badRequest("Choose a password you haven't used here", { newPassword: "Must differ from the current password" });
    }
    // Every other session ends; this one continues with a fresh token.
    const tokenVersion = await platform.setPassword(admin.id, await hashPassword(newPassword), false);
    return c.json({ token: await signPlatformToken({ ...admin, token_version: tokenVersion }) });
  },
);

/* ---------------------------------- Workspaces ---------------------------------- */

const newWorkspaceSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name").max(80),
  workspace: workspaceSlug.refine((s) => !isReservedSlug(s), "That name is reserved, pick another"),
  name: z.string().trim().min(2, "Enter the full name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  employeeCode: z.string().trim().regex(/^[A-Za-z0-9_-]{2,32}$/, "2–32 letters, numbers, - or _").default("ADMIN"),
  password,
});

platformRoutes.get("/workspaces", async (c) => {
  const rows = await platform.workspaces();
  return c.json({
    workspaces: rows.map((w) => ({
      id: w.id,
      slug: w.slug,
      name: w.name,
      status: w.status,
      createdAt: w.created_at,
      people: w.people,
      admins: w.admins,
      lastLoginAt: w.last_login_at,
    })),
  });
});

platformRoutes.post("/workspaces", validate("json", newWorkspaceSchema), async (c) => {
  const input = c.req.valid("json");
  const { tenant, user } = await createTenant({
    slug: input.workspace,
    companyName: input.companyName,
    admin: { name: input.name, email: input.email, employeeCode: input.employeeCode, password: input.password },
    createdBy: c.get("platformAdmin").email,
  });
  return c.json(
    {
      workspace: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      admin: { name: user.name, email: user.email, employeeCode: user.employeeCode },
    },
    201,
  );
});

for (const [path, status] of [["suspend", "suspended"], ["activate", "active"]]) {
  platformRoutes.post(`/workspaces/:id/${path}`, validate("param", uuidParam), async (c) => {
    if (!(await platform.setWorkspaceStatus(c.req.valid("param").id, status))) throw notFound("Workspace");
    return c.json({ ok: true, status });
  });
}

/* ------------------------------ Team (admins only) ------------------------------ */

// Staff never see the team: not its members, not the admins, not the password requests.
for (const path of ["/team", "/team/*", "/password-requests", "/password-requests/*"]) platformRoutes.use(path, requireAdminRole);

platformRoutes.get("/team", async (c) => {
  const rows = await platform.team();
  return c.json({
    team: rows.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      active: a.is_active,
      mustChangePassword: a.must_change_password,
      lastLoginAt: a.last_login_at,
      createdAt: a.created_at,
      createdBy: a.created_by_name,
    })),
  });
});

platformRoutes.post(
  "/team",
  validate(
    "json",
    z.object({
      name: z.string().trim().min(2, "Enter their full name").max(120),
      email: z.email("Enter a valid email").trim().toLowerCase(),
      role: z.enum(ROLES, "Choose Admin or Staff").default("staff"),
      password,
    }),
  ),
  async (c) => {
    const { name, email, role, password: plain } = c.req.valid("json");
    const id = await platform.createAdmin({ email, name, role, passwordHash: await hashPassword(plain), createdBy: c.get("platformAdmin").id });
    return c.json({ member: { id, name, email, role } }, 201);
  },
);

// Someone else's account only: your own password is changed with /password, and demoting or
// deactivating yourself could leave nobody able to manage the team.
const colleague = (c) => {
  const { id } = c.req.valid("param");
  if (id === c.get("platformAdmin").id) throw badRequest("You can't do this to your own account");
  return id;
};

// A temporary password for a colleague; also answers any request they made for one.
platformRoutes.post("/team/:id/reset-password", validate("param", uuidParam), validate("json", z.object({ password })), async (c) => {
  const id = colleague(c);
  const tv = await platform.setPassword(id, await hashPassword(c.req.valid("json").password), true);
  if (tv == null) throw notFound("Team member");
  await platform.closePasswordRequest(id, c.get("platformAdmin").id);
  return c.json({ ok: true });
});

platformRoutes.post("/team/:id/role", validate("param", uuidParam), validate("json", z.object({ role: z.enum(ROLES) })), async (c) => {
  if (!(await platform.setRole(colleague(c), c.req.valid("json").role))) throw notFound("Team member");
  return c.json({ ok: true });
});

for (const [path, active] of [["deactivate", false], ["activate", true]]) {
  platformRoutes.post(`/team/:id/${path}`, validate("param", uuidParam), async (c) => {
    if (!(await platform.setActive(colleague(c), active))) throw notFound("Team member");
    return c.json({ ok: true, active });
  });
}

// Requests addressed to me, from people who forgot their password.
platformRoutes.get("/password-requests", async (c) => {
  const rows = await platform.passwordRequestsFor(c.get("platformAdmin").id);
  return c.json({
    requests: rows.map((r) => ({ id: r.id, requesterId: r.requester_id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at })),
  });
});

platformRoutes.post("/password-requests/:id/dismiss", validate("param", uuidParam), async (c) => {
  const mine = await platform.passwordRequestsFor(c.get("platformAdmin").id);
  const request = mine.find((r) => r.id === c.req.valid("param").id);
  if (!request) throw notFound("Request");
  await platform.closePasswordRequest(request.requester_id, c.get("platformAdmin").id);
  return c.json({ ok: true });
});

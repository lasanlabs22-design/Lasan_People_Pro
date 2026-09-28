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

// Failed sign-ins only, keyed like the workspace sign-in (routes/auth.js): a tight budget per
// account from one address, a looser one per account overall that an address the account has
// signed in from before is exempt from, so someone who knows a Lasan email can't lock its owner out.
const WINDOW = 15 * 60_000;
const perIp = createLimiter({ name: "platform:ip", windowMs: WINDOW, max: 20 });
const perAccountIp = createLimiter({ name: "platform:account-ip", windowMs: WINDOW, max: 10 });
const perAccount = createLimiter({ name: "platform:account", windowMs: WINDOW, max: 30 });
const trustedAddress = createLimiter({ name: "platform:trusted", windowMs: 30 * 24 * 60 * 60_000, max: 1 });

let dummyHash;

/** Records a console action in the audit trail, as the signed-in platform admin. */
const record = (c, action, target = {}) => {
  const me = c.get("platformAdmin");
  return platform.audit({ actorId: me?.id, actorEmail: me?.email, action, ip: clientIp(c), ...target });
};

export const platformAuthRoutes = new Hono();

platformAuthRoutes.post(
  "/login",
  validate("json", z.object({ email: z.string().trim().toLowerCase().min(1, "Required"), password: z.string().min(1, "Required") })),
  async (c) => {
    const { email, password: plain } = c.req.valid("json");
    const ip = addressBlock(clientIp(c));
    const here = `${email}|${ip}`;
    const trusted = await trustedAddress.exceeded(here);
    const keys = [
      [perIp, ip],
      [perAccountIp, here],
      [perAccount, email],
    ];
    for (const [limiter, key] of trusted ? keys.filter(([l]) => l !== perAccount) : keys) {
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
      await Promise.all(keys.map(([limiter, key]) => limiter.hit(key)));
      // Only real accounts are logged, so guessing at made-up emails can't flood the trail.
      if (admin) await platform.audit({ actorId: admin.id, actorEmail: admin.email, action: "auth.login_failed", ip: clientIp(c) });
      throw unauthorized("Invalid email or password");
    }
    await perAccountIp.reset(here);
    await trustedAddress.hit(here);
    await platform.signedIn(admin.id);
    await platform.audit({ actorId: admin.id, actorEmail: admin.email, action: "auth.login", ip: clientIp(c) });
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
    await record(c, "auth.password_changed");
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
  await record(c, "workspace.created", { targetType: "workspace", targetId: tenant.id, targetLabel: `${tenant.name} (${tenant.slug})` });
  return c.json(
    {
      workspace: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      admin: { name: user.name, email: user.email, employeeCode: user.employeeCode },
    },
    201,
  );
});

// Suspending locks a whole company out, so it's an admin's call; staff set workspaces up.
for (const [path, status] of [["suspend", "suspended"], ["activate", "active"]]) {
  platformRoutes.post(`/workspaces/:id/${path}`, requireAdminRole, validate("param", uuidParam), async (c) => {
    const { id } = c.req.valid("param");
    if (!(await platform.setWorkspaceStatus(id, status))) throw notFound("Workspace");
    const workspace = (await platform.workspaces()).find((w) => w.id === id);
    await record(c, status === "active" ? "workspace.reactivated" : "workspace.suspended", {
      targetType: "workspace",
      targetId: id,
      targetLabel: workspace && `${workspace.name} (${workspace.slug})`,
    });
    return c.json({ ok: true, status });
  });
}

/* ------------------------------ Team (admins only) ------------------------------ */

// Staff never see the team: not its members, not the admins, not the password requests, not the audit trail.
for (const path of ["/team", "/team/*", "/password-requests", "/password-requests/*", "/audit"]) platformRoutes.use(path, requireAdminRole);

platformRoutes.get("/audit", validate("query", z.object({ limit: z.coerce.number().int().min(1).max(500).default(200) })), async (c) => {
  const rows = await platform.auditLog(c.req.valid("query").limit);
  return c.json({
    entries: rows.map((r) => ({
      id: r.id,
      at: r.created_at,
      actorEmail: r.actor_email,
      actorName: r.actor_name,
      action: r.action,
      targetType: r.target_type,
      targetLabel: r.target_label,
      ip: r.ip,
      meta: r.meta,
    })),
  });
});

/** A team member's email, for the audit trail. */
const memberLabel = async (id) => (await platform.adminById(id))?.email ?? null;

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
    await record(c, "team.added", { targetType: "platform_admin", targetId: id, targetLabel: email, meta: { role } });
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
  await record(c, "team.password_reset", { targetType: "platform_admin", targetId: id, targetLabel: await memberLabel(id) });
  return c.json({ ok: true });
});

platformRoutes.post("/team/:id/role", validate("param", uuidParam), validate("json", z.object({ role: z.enum(ROLES) })), async (c) => {
  const id = colleague(c);
  const { role } = c.req.valid("json");
  if (!(await platform.setRole(id, role))) throw notFound("Team member");
  await record(c, "team.role_changed", { targetType: "platform_admin", targetId: id, targetLabel: await memberLabel(id), meta: { role } });
  return c.json({ ok: true });
});

for (const [path, active] of [["deactivate", false], ["activate", true]]) {
  platformRoutes.post(`/team/:id/${path}`, validate("param", uuidParam), async (c) => {
    const id = colleague(c);
    if (!(await platform.setActive(id, active))) throw notFound("Team member");
    await record(c, active ? "team.activated" : "team.deactivated", { targetType: "platform_admin", targetId: id, targetLabel: await memberLabel(id) });
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
  await record(c, "team.password_request_dismissed", { targetType: "platform_admin", targetId: request.requester_id, targetLabel: request.email });
  return c.json({ ok: true });
});

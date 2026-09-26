import { Hono } from "hono";
import { z } from "zod";
import { createMiddleware } from "hono/factory";
import { platform } from "../db/client.js";
import { hashPassword, signPlatformToken, verifyPassword, verifyPlatformToken } from "../lib/auth.js";
import { forbidden, notFound, unauthorized } from "../lib/errors.js";
import { createTenant } from "../lib/tenants.js";
import { uuidParam } from "../lib/validators.js";
import { validate } from "../middleware/validate.js";
import { addressBlock, clientIp, createLimiter } from "../middleware/rate-limit.js";
import { newWorkspaceSchema } from "./auth.js";

/*
 * The platform console: Lasan staff create and manage customer workspaces here. Platform admins
 * belong to no workspace, so nothing here runs in a tenant context except createTenant, which
 * opens the new workspace's own.
 */

const publicAdmin = (a) => ({ id: a.id, email: a.email, name: a.name, lastLoginAt: a.last_login_at ?? null });

const WINDOW = 15 * 60_000;
const perIp = createLimiter({ name: "platform:ip", windowMs: WINDOW, max: 20 });
const perAccount = createLimiter({ name: "platform:account", windowMs: WINDOW, max: 10 });

let dummyHash;

export const platformAuthRoutes = new Hono();

platformAuthRoutes.post(
  "/login",
  validate("json", z.object({ email: z.string().trim().toLowerCase().min(1, "Required"), password: z.string().min(1, "Required") })),
  async (c) => {
    const { email, password } = c.req.valid("json");
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
    const valid = await verifyPassword(password, admin?.password_hash ?? (dummyHash ??= await hashPassword("no-such-account")));
    if (!admin || !valid || !admin.is_active) {
      await Promise.all([perIp.hit(ip), perAccount.hit(account)]);
      throw unauthorized("Invalid email or password");
    }
    await perAccount.reset(account);
    await platform.signedIn(admin.id);
    return c.json({ token: await signPlatformToken(admin), admin: publicAdmin(admin) });
  },
);

/** Bearer platform token → the platform admin, re-checked so deactivation and resets apply at once. */
const requirePlatformAdmin = createMiddleware(async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const payload = header.startsWith("Bearer ") ? await verifyPlatformToken(header.slice(7)) : null;
  if (!payload) throw unauthorized("Session expired, please sign in again");
  const admin = await platform.adminById(payload.sub);
  if (!admin || admin.token_version !== payload.tv) throw unauthorized("Session expired, please sign in again");
  if (!admin.is_active) throw forbidden("This platform account is disabled");
  c.set("platformAdmin", admin);
  await next();
});

export const platformRoutes = new Hono();
platformRoutes.use("*", requirePlatformAdmin);

platformRoutes.get("/me", (c) => c.json({ admin: publicAdmin(c.get("platformAdmin")) }));

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

import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db, schema, setActor, withTenant } from "../db/client.js";
import { verifyToken } from "../lib/auth.js";
import { forbidden, unauthorized, ApiError } from "../lib/errors.js";

// Routes a user may hit while still holding a first-login / reset password.
const PASSWORD_CHANGE_ALLOWED = new Set(["/auth/me", "/auth/change-password"]);

const ROLLBACK = Symbol("rollback");

/**
 * Runs `fn` in a tenant-scoped transaction. When a downstream handler failed, Hono has already
 * turned the error into a response (and set c.error), so roll back quietly instead of committing
 * half a request.
 */
export async function inTenant(c, ctx, fn) {
  try {
    await withTenant(ctx, async () => {
      await fn();
      if (c.error) throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
}

/**
 * Verifies the bearer token, opens the tenant context named in it, then re-loads the user under
 * RLS so revocation and password changes take effect immediately (token version must match).
 * A token for a user of another tenant simply finds no row.
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw unauthorized();

  const payload = await verifyToken(token);
  if (!payload) throw unauthorized("Session expired, please sign in again");

  await inTenant(c, { tenantId: payload.tid }, async () => {
    const [[user], [tenant]] = await Promise.all([
      db.select().from(schema.users).where(eq(schema.users.id, payload.sub)),
      db.select().from(schema.tenants).where(eq(schema.tenants.id, payload.tid)),
    ]);
    if (!user || !tenant || user.tokenVersion !== payload.tv) throw unauthorized("Session expired, please sign in again");
    if (tenant.status !== "active") throw forbidden("This workspace is suspended. Contact Lasan support.");
    if (user.status !== "active") throw forbidden("Your access has been revoked. Contact your administrator.");

    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(c.req.path)) {
      throw new ApiError(403, "You must change your password before continuing", "password_change_required");
    }

    // From here on Postgres knows who is acting and whether they're an admin.
    await setActor(user);
    c.set("user", user);
    c.set("tenant", tenant);
    await next();
  });
});

export const requireRole = (...roles) =>
  createMiddleware(async (c, next) => {
    if (!roles.includes(c.get("user")?.role)) throw forbidden();
    await next();
  });

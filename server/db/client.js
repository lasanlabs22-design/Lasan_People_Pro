import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { sql as dsql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../env.js";
import * as schema from "./schema.js";

function sslOption() {
  if (env.DATABASE_SSL === "require") return "require";
  if (env.DATABASE_SSL === "disable") return false;
  // Default: TLS for anything that isn't local or Railway's private network.
  const host = new URL(env.DATABASE_URL).hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".railway.internal") ? false : "require";
}

// One pool per process; survives dev hot reloads.
function root() {
  if (!globalThis.__lasanDb) {
    const pool = postgres(env.DATABASE_URL, {
      ssl: sslOption(),
      max: env.DATABASE_POOL_MAX,
      idle_timeout: 20,
      // Keep `date` columns as plain YYYY-MM-DD strings instead of JS Dates shifted by timezone.
      types: { date: { to: 1082, from: [1082], serialize: (v) => v, parse: (v) => v } },
    });
    globalThis.__lasanDb = { pool, db: drizzle(pool, { schema }) };
  }
  return globalThis.__lasanDb;
}

const context = new AsyncLocalStorage();

/**
 * Runs `fn` inside one transaction whose settings tell Postgres which tenant (and, once known,
 * which user and role) is acting. Row-level security reads these, so every query made through
 * `db` in `fn` only sees that tenant. set_config(..., true) is transaction-local: nothing leaks
 * to the next request that reuses the pooled connection.
 */
export function withTenant({ tenantId, userId = null, role = null }, fn) {
  if (!tenantId) throw new Error("withTenant needs a tenantId");
  return root().db.transaction(async (tx) => {
    await tx.execute(
      dsql`select set_config('app.tenant_id', ${tenantId}, true), set_config('app.user_id', ${userId ?? ""}, true), set_config('app.role', ${role ?? ""}, true)`,
    );
    return context.run({ tx, tenantId }, fn);
  });
}

/** Records who is acting once they're authenticated. The role comes from their database row. */
export async function setActor(user) {
  const ctx = context.getStore();
  if (!ctx) throw new Error("setActor called outside withTenant");
  await ctx.tx.execute(dsql`select set_config('app.user_id', ${user.id}, true), set_config('app.role', ${user.role}, true)`);
}

export const currentTenantId = () => context.getStore()?.tenantId ?? null;

/**
 * The request's transaction. Using it outside withTenant throws instead of silently running
 * unscoped (which RLS would answer with zero rows anyway).
 */
export const db = new Proxy(
  {},
  {
    get(_, prop) {
      const ctx = context.getStore();
      if (!ctx) throw new Error("Database access outside a tenant context");
      const value = ctx.tx[prop];
      return typeof value === "function" ? value.bind(ctx.tx) : value;
    },
  },
);

/** Workspace lookup for sign-in, before any tenant context exists. */
export async function findTenantBySlug(slug) {
  const rows = await root().pool`select id, slug, name, status from app.tenant_by_slug(${slug})`;
  return rows[0] ?? null;
}

/**
 * Sign-in throttling (see db/migrations/0003). Runs on the pool, outside any request
 * transaction, so a failed sign-in's rollback can't also erase the attempt it just counted.
 */
export const rateLimits = {
  async peek(key) {
    const [row] = await root().pool`select count, retry_after from app.rate_limit_peek(${key})`;
    return { count: row?.count ?? 0, retryAfter: row?.retry_after ?? 0 };
  },
  hit: (key, windowSeconds) => root().pool`select app.rate_limit_hit(${key}, ${windowSeconds})`,
  reset: (key) => root().pool`select app.rate_limit_reset(${key})`,
};

/**
 * Platform (super) admins and the cross-workspace view they manage (see db/migrations/0005).
 * They sit outside every tenant, so these run on the pool through definer functions.
 */
export const platform = {
  async adminByEmail(email) {
    const [row] = await root().pool`select * from app.platform_admin_by_email(${email})`;
    return row ?? null;
  },
  async adminById(id) {
    const [row] = await root().pool`select * from app.platform_admin_by_id(${id})`;
    return row ?? null;
  },
  signedIn: (id) => root().pool`select app.platform_admin_signed_in(${id})`,
  workspaces: () => root().pool`select * from app.platform_workspaces()`,
  async setWorkspaceStatus(id, status) {
    const [row] = await root().pool`select app.platform_set_workspace_status(${id}, ${status}) as ok`;
    return row.ok;
  },
};

export async function closeDb() {
  await globalThis.__lasanDb?.pool.end({ timeout: 5 });
  globalThis.__lasanDb = undefined;
}

export { schema };

/**
 * Tenant-isolation checks against the real database. Creates two throwaway workspaces, tries to
 * cross between them through the API and through raw SQL as the app role, then deletes them.
 *
 *   npm run test:rls
 */
import "./lib/load-env.js";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { getApp } from "../server/app.js";
import { closeDb } from "../server/db/client.js";
import { sslFor } from "./lib/ssl.js";

const app = getApp();
const suffix = randomBytes(3).toString("hex");
const A = { slug: `rls-a-${suffix}`, company: "RLS Test A" };
const B = { slug: `rls-b-${suffix}`, company: "RLS Test B" };
const PASSWORD = "Passw0rd!";

const appSql = postgres(process.env.DATABASE_URL, { ssl: sslFor(process.env.DATABASE_URL), max: 2, onnotice: () => {} });
const ownerSql = postgres(process.env.DATABASE_ADMIN_URL, { ssl: sslFor(process.env.DATABASE_ADMIN_URL), max: 1, onnotice: () => {} });

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

async function call(path, { method = "GET", body, token } = {}) {
  const res = await app.request(path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

/** Raw SQL as lasan_pro_app with a given context, rolled back afterwards. */
async function asApp(ctx, fn) {
  let result;
  await appSql
    .begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${ctx.tenantId ?? ""}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true), set_config('app.role', ${ctx.role ?? ""}, true)`;
      result = await fn(tx);
      throw Object.assign(new Error("rollback"), { rollback: true });
    })
    .catch((err) => {
      if (!err.rollback) throw err;
    });
  return result;
}

async function expectPgError(code, fn) {
  try {
    await fn();
  } catch (err) {
    assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
    return;
  }
  assert.fail(`expected SQLSTATE ${code}, but the statement succeeded`);
}

try {
  console.log("Setting up two workspaces…");
  const regA = await call("/auth/register", {
    method: "POST",
    body: { companyName: A.company, workspace: A.slug, name: "Admin A", email: "admin@a.test", password: PASSWORD },
  });
  assert.equal(regA.status, 201, JSON.stringify(regA.body));
  const regB = await call("/auth/register", {
    method: "POST",
    body: { companyName: B.company, workspace: B.slug, name: "Admin B", email: "admin@b.test", password: PASSWORD },
  });
  assert.equal(regB.status, 201, JSON.stringify(regB.body));
  A.token = regA.body.token;
  A.id = regA.body.tenant.id;
  B.token = regB.body.token;
  B.id = regB.body.tenant.id;

  // Same employee ID in both companies: allowed, because uniqueness is per workspace.
  const empA = await call("/admin/employees", {
    method: "POST",
    token: A.token,
    body: { employeeCode: "LS001", name: "Asha A", email: "asha@shared.test", gender: "female", password: PASSWORD },
  });
  const empB = await call("/admin/employees", {
    method: "POST",
    token: B.token,
    body: { employeeCode: "LS001", name: "Bala B", email: "asha@shared.test", gender: "male", password: PASSWORD },
  });

  console.log("API");
  await check("same employee ID and email can exist in two workspaces", () => {
    assert.equal(empA.status, 201, JSON.stringify(empA.body));
    assert.equal(empB.status, 201, JSON.stringify(empB.body));
  });
  A.empId = empA.body.employee.id;
  B.empId = empB.body.employee.id;

  await check("login resolves the person inside the chosen workspace", async () => {
    const a = await call("/auth/login", { method: "POST", body: { workspace: A.slug, identifier: "LS001", password: PASSWORD } });
    const b = await call("/auth/login", { method: "POST", body: { workspace: B.slug, identifier: "LS001", password: PASSWORD } });
    assert.equal(a.body.user.id, A.empId);
    assert.equal(b.body.user.id, B.empId);
    A.empToken = a.body.token;
  });

  await check("admin B's employee list has no one from A", async () => {
    const { body } = await call("/admin/employees", { token: B.token });
    const ids = body.employees.map((e) => e.id);
    assert.ok(!ids.includes(A.empId) && ids.includes(B.empId));
  });

  await check("admin B can't open, reset or revoke A's employee", async () => {
    assert.equal((await call(`/admin/employees/${A.empId}`, { token: B.token })).status, 404);
    assert.equal((await call(`/admin/employees/${A.empId}/reset-password`, { method: "POST", token: B.token })).status, 404);
    assert.equal((await call(`/admin/employees/${A.empId}/revoke`, { method: "POST", token: B.token })).status, 404);
  });

  await check("admin B can't record leave for A's employee", async () => {
    const types = await call("/leave-types", { token: B.token });
    const res = await call("/admin/leaves/record", {
      method: "POST",
      token: B.token,
      body: { userId: A.empId, leaveTypeId: types.body.leaveTypes[0].id, startDate: "2026-01-05", endDate: "2026-01-05", reason: "cross-tenant" },
    });
    assert.equal(res.status, 404);
  });

  await check("each workspace has its own leave policy and holidays", async () => {
    const [ta, tb] = await Promise.all([call("/leave-types", { token: A.token }), call("/leave-types", { token: B.token })]);
    const idsA = new Set(ta.body.leaveTypes.map((t) => t.id));
    assert.ok(tb.body.leaveTypes.every((t) => !idsA.has(t.id)));
  });

  await check("an employee can't use admin routes", async () => {
    assert.equal((await call("/admin/employees", { token: A.empToken })).status, 403);
  });

  console.log("Database (as lasan_pro_app)");
  await check("the app role can't bypass RLS", async () => {
    const [r] = await appSql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    assert.deepEqual([r.rolsuper, r.rolbypassrls], [false, false]);
  });

  await check("with no tenant context, every table reads as empty", async () => {
    const rows = await asApp({}, (tx) => tx`select (select count(*) from users) u, (select count(*) from tenants) t, (select count(*) from leave_types) l`);
    assert.deepEqual([Number(rows[0].u), Number(rows[0].t), Number(rows[0].l)], [0, 0, 0]);
  });

  await check("tenant B context can't see A's rows even by id", async () => {
    const rows = await asApp({ tenantId: B.id, role: "admin" }, (tx) => tx`select id from users where id = ${A.empId}`);
    assert.equal(rows.length, 0);
  });

  await check("writing a row tagged with another tenant is refused", async () => {
    await asApp({ tenantId: B.id, role: "admin" }, (tx) =>
      expectPgError("42501", () => tx`insert into holidays (tenant_id, date, name) values (${A.id}, '2026-03-03', 'sneaky')`),
    );
  });

  await check("linking to another tenant's user fails the foreign key", async () => {
    await asApp({ tenantId: B.id, role: "admin" }, async (tx) => {
      const [type] = await tx`select id from leave_types limit 1`;
      await expectPgError("23503", () =>
        tx`insert into leave_requests (user_id, leave_type_id, start_date, end_date, days, reason) values (${A.empId}, ${type.id}, '2026-03-03', '2026-03-03', 1, 'x')`,
      );
    });
  });

  await check("an employee can't promote themselves", async () => {
    await asApp({ tenantId: A.id, userId: A.empId, role: "employee" }, (tx) =>
      expectPgError("42501", () => tx`update users set role = 'admin' where id = ${A.empId}`),
    );
  });

  await check("an employee can't approve their own leave", async () => {
    await asApp({ tenantId: A.id, userId: A.empId, role: "employee" }, async (tx) => {
      const [type] = await tx`select id from leave_types limit 1`;
      await expectPgError("42501", () =>
        tx`insert into leave_requests (user_id, leave_type_id, start_date, end_date, days, reason, status) values (${A.empId}, ${type.id}, '2026-03-03', '2026-03-03', 1, 'x', 'approved')`,
      );
    });
  });

  await check("an employee sees only their own profile and attendance", async () => {
    const rows = await asApp({ tenantId: A.id, userId: A.empId, role: "employee" }, (tx) => tx`select user_id from profiles`);
    assert.deepEqual(rows.map((r) => r.user_id), [A.empId]);
  });

  await check("an employee can't edit company settings", async () => {
    await asApp({ tenantId: A.id, userId: A.empId, role: "employee" }, (tx) =>
      expectPgError("42501", () => tx`insert into holidays (date, name) values ('2026-03-04', 'self-declared')`),
    );
  });

  await check("the audit log can't be rewritten", async () => {
    await asApp({ tenantId: A.id, role: "admin" }, (tx) => expectPgError("42501", () => tx`delete from audit_logs`));
  });
} finally {
  await ownerSql`delete from tenants where slug in (${A.slug}, ${B.slug})`;
  await Promise.all([appSql.end(), ownerSql.end(), closeDb()]);
  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}. Test workspaces removed.`);
}

/**
 * Behaviour checks for the API against the real database: one throwaway workspace, exercised
 * through the same Hono app the pages use, then deleted. Complements test-rls.js (isolation).
 *
 *   npm run test:app
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
const W = { slug: `app-${suffix}`, company: "App Test" };
const PASSWORD = "Passw0rd!";
// A made-up visitor address per run, so rate limits from earlier runs don't interfere.
const IP = `198.51.100.${Number.parseInt(suffix.slice(0, 2), 16)}`;

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

async function call(path, { method = "GET", body, token, headers = {} } = {}) {
  const res = await app.request(path, {
    method,
    headers: {
      "x-forwarded-for": IP,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const ok = (res, status = 200) => assert.equal(res.status, status, JSON.stringify(res.body));

/** Creates an employee (or admin) and signs them in with a password of their own. */
async function person(code, extra = {}) {
  const created = await call("/admin/employees", {
    method: "POST",
    token: W.token,
    body: { employeeCode: code, name: `Person ${code}`, email: `${code.toLowerCase()}@app.test`, gender: "female", password: PASSWORD, ...extra },
  });
  ok(created, 201);
  const login = await call("/auth/login", { method: "POST", body: { workspace: W.slug, identifier: code, password: PASSWORD } });
  ok(login);
  const changed = await call("/auth/change-password", {
    method: "POST",
    token: login.body.token,
    body: { currentPassword: PASSWORD, newPassword: `${PASSWORD}2` },
  });
  ok(changed);
  return { id: created.body.employee.id, token: changed.body.token };
}


try {
  const reg = await call("/auth/register", {
    method: "POST",
    body: { companyName: W.company, workspace: W.slug, name: "Admin", email: "admin@app.test", password: PASSWORD },
  });
  ok(reg, 201);
  W.token = reg.body.token;
  W.adminId = reg.body.user.id;

  console.log("Employees");
  await check("editing an admin without a role keeps them admin", async () => {
    const other = await person("ADM2", { role: "admin" });
    ok(await call(`/admin/employees/${other.id}`, { method: "PATCH", token: W.token, body: { designation: "Ops lead" } }));
    const { body } = await call(`/admin/employees/${other.id}`, { token: W.token });
    assert.equal(body.employee.role, "admin");
  });

  await check("an admin can edit their own details", async () => {
    ok(await call(`/admin/employees/${W.adminId}`, { method: "PATCH", token: W.token, body: { email: "boss@app.test" } }));
  });

  await check("a new employee still defaults to the employee role", async () => {
    const created = await call("/admin/employees", {
      method: "POST",
      token: W.token,
      body: { employeeCode: "DEF1", name: "Default Role", email: "def1@app.test", gender: "male" },
    });
    ok(created, 201);
    assert.equal(created.body.employee.role, "employee");
  });
} finally {
  await ownerSql`delete from tenants where slug = ${W.slug}`;
  await Promise.all([ownerSql.end(), closeDb()]);
  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}. Test workspace removed.`);
}


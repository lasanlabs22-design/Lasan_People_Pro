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
import { addDays, todayIn, weekday } from "../server/lib/dates.js";
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
const today = todayIn();

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

  console.log("Roll-call");
  // A Sunday at least a week back, and the Wednesday after it (still in the past).
  const pastSunday = addDays(today, -((weekday(today) + 7) % 7) - 7);
  const pastWednesday = addDays(pastSunday, 3);
  const veteran = await person("OLD1", { dateOfJoining: "2020-01-01" });
  const newcomer = await person("NEW1", { dateOfJoining: today });
  const rollOn = async (date) => {
    const res = await call(`/admin/attendance?date=${date}`, { token: W.token });
    ok(res);
    return { ...res.body, row: (id) => res.body.rows.find((r) => r.id === id) };
  };

  await check("a weekly off day reads Off, not absent", async () => {
    const roll = await rollOn(pastSunday);
    assert.equal(roll.dayOff?.reason, "weekend");
    assert.equal(roll.row(veteran.id).status, "off");
    assert.equal(roll.summary.absent, 0);
  });

  await check("a mandatory holiday reads Off", async () => {
    const republicDay = `${today.slice(0, 4)}-01-26`;
    if (republicDay > today) return;
    const roll = await rollOn(republicDay);
    assert.deepEqual(roll.dayOff, { reason: "holiday", name: "Republic Day" });
  });

  await check("someone who hadn't joined yet isn't on the roll", async () => {
    const roll = await rollOn(pastWednesday);
    assert.equal(roll.row(newcomer.id), undefined);
    assert.equal(roll.row(veteran.id).status, "absent");
  });

  await check("the roll-call refuses future dates", async () => {
    assert.equal((await call(`/admin/attendance?date=${addDays(today, 1)}`, { token: W.token })).status, 400);
  });

  await check("a revoked person stays on days before the revoke, marked revoked", async () => {
    ok(await call(`/admin/employees/${veteran.id}/revoke`, { method: "POST", token: W.token }));
    assert.equal((await rollOn(pastWednesday)).row(veteran.id).revoked, true);
    assert.equal((await rollOn(today)).row(veteran.id), undefined);
  });
} finally {
  await ownerSql`delete from tenants where slug = ${W.slug}`;
  await Promise.all([ownerSql.end(), closeDb()]);
  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}. Test workspace removed.`);
}


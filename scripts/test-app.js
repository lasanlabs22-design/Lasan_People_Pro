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

  console.log("Leave vs attendance");
  const types = (await call("/leave-types", { token: W.token })).body.leaveTypes;
  const casual = types.find((t) => t.code === "CASUAL").id;
  const worker = await person("WRK1", { dateOfJoining: "2020-01-01" });
  const here = { latitude: 13.6, longitude: 79.5, accuracy: 10 };
  const leave = (who, start, halfDay = "none", end = start) => ({ userId: who.id, leaveTypeId: casual, startDate: start, endDate: end, halfDay, reason: "test leave" });

  await check("full-day leave can't be recorded on a day they checked in", async () => {
    ok(await call("/attendance/check-in", { method: "POST", token: worker.token, body: here }), 201);
    const res = await call("/admin/leaves/record", { method: "POST", token: W.token, body: leave(worker, today) });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /Already checked in/);
  });

  await check("a half day on a worked day is still allowed", async () => {
    ok(await call("/admin/leaves/record", { method: "POST", token: W.token, body: leave(worker, today, "second_half") }), 201);
  });

  await check("approving full-day leave for a day they've since worked is refused", async () => {
    const other = await person("WRK2");
    const applied = await call("/leaves", { method: "POST", token: other.token, body: { ...leave(other, today), userId: undefined } });
    ok(applied, 201);
    ok(await call("/attendance/check-in", { method: "POST", token: other.token, body: here }), 201);
    assert.equal((await call(`/admin/leaves/${applied.body.leave.id}/approve`, { method: "POST", token: W.token, body: {} })).status, 409);
  });

  await check("check-in is refused on approved leave until the leave is cancelled", async () => {
    const onLeave = await person("WRK3");
    const recorded = await call("/admin/leaves/record", { method: "POST", token: W.token, body: leave(onLeave, today) });
    ok(recorded, 201);
    assert.equal((await call("/attendance/today", { token: onLeave.token })).body.leave?.name, "Casual Leave");
    assert.equal((await call("/attendance/check-in", { method: "POST", token: onLeave.token, body: here })).status, 409);
    ok(await call(`/leaves/${recorded.body.leave.id}/cancel`, { method: "POST", token: onLeave.token }));
    ok(await call("/attendance/check-in", { method: "POST", token: onLeave.token, body: here }), 201);
  });

  await check("the leave preview flags an overlap before submitting", async () => {
    // A Wednesday about five weeks out, so both requests cover working days.
    const start = addDays(pastWednesday, 35);
    ok(await call("/leaves", { method: "POST", token: worker.token, body: { ...leave(worker, start, "none", addDays(start, 1)), userId: undefined } }), 201);
    const res = await call("/leaves/preview", { method: "POST", token: worker.token, body: { ...leave(worker, addDays(start, 1)), userId: undefined } });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /Overlaps your pending Casual Leave/);
  });

  console.log("Profile");
  await check("date of birth must be real and at least 14 years ago", async () => {
    const save = (dateOfBirth) => call("/me/profile", { method: "PUT", token: worker.token, body: { dateOfBirth } });
    for (const bad of [addDays(today, 1), "1900-05-05", addDays(today, -365 * 5)]) assert.equal((await save(bad)).status, 400, bad);
    ok(await save("1995-04-12"));
    ok(await save(""));
  });

  console.log("Sign-in security");
  const login = (identifier, password, ip) =>
    call("/auth/login", { method: "POST", body: { workspace: W.slug, identifier, password }, headers: ip ? { "x-forwarded-for": ip } : {} });
  // Addresses unique to this run, so earlier runs' counters don't interfere.
  const net = (n) => `203.0.${Number.parseInt(suffix.slice(2, 4), 16)}.${n}`;

  await check("a forged X-Forwarded-For can't dodge the per-address limit", async () => {
    const target = await person("SEC1");
    let last;
    // The caller rotates the first entry; the proxy-added last entry stays the same.
    for (let i = 0; i < 11; i++) last = await login("SEC1", "wrong-password", `10.9.8.${i}, ${net(1)}`);
    assert.equal(last.status, 429, JSON.stringify(last.body));
    void target;
  });

  await check("an unknown ID takes as long to reject as a wrong password", async () => {
    await person("SEC2");
    const time = async (id) => {
      const t = performance.now();
      await login(id, "wrong-password", net(2));
      return performance.now() - t;
    };
    const [unknown, wrong] = [await time("NOBODY"), await time("SEC2")];
    // bcrypt at cost 12 is tens of milliseconds; a skipped check would answer in a few.
    assert.ok(unknown > wrong * 0.5, `unknown ${unknown.toFixed(0)}ms vs wrong password ${wrong.toFixed(0)}ms`);
  });

  await check("an attacker can't lock the owner out from their usual address", async () => {
    await person("SEC3");
    ok(await login("SEC3", `${PASSWORD}2`, net(3)));
    // 50 failures from 50 different addresses exhaust the account-wide budget…
    for (let i = 0; i < 50; i++) await login("SEC3", "wrong-password", `192.0.2.${i}, 100.64.${Number.parseInt(suffix.slice(4, 6), 16)}.${i}`);
    assert.equal((await login("SEC3", `${PASSWORD}2`, net(4))).status, 429);
    // …but the owner's usual address still gets in.
    ok(await login("SEC3", `${PASSWORD}2`, net(3)));
  });

  await check("sign-in attempts are counted in the database, not process memory", async () => {
    const [row] = await ownerSql`select count(*)::int as n from app.rate_limits where key like 'login:%'`;
    assert.ok(row.n > 0);
  });

  console.log("Maintenance");
  await check("the owner can delete someone who reviewed leave (cascade isn't blocked by guards)", async () => {
    // The workspace admin recorded (reviewed) leave above; removing them nulls reviewer_id on those rows.
    await ownerSql`delete from users where id = ${W.adminId}`;
    const [row] = await ownerSql`select count(*)::int as n from leave_requests where tenant_id = (select id from tenants where slug = ${W.slug}) and reviewer_id is null`;
    assert.ok(row.n > 0);
  });
} finally {
  await ownerSql`delete from tenants where slug = ${W.slug}`;
  await Promise.all([ownerSql.end(), closeDb()]);
  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}. Test workspace removed.`);
}


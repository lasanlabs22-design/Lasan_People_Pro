/**
 * Behaviour checks for the API against the real database: one throwaway workspace, exercised
 * through the same Hono app the pages use, then deleted. Complements test-rls.js (isolation).
 *
 *   npm run test:app
 */
import "./lib/load-env.js";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { getApp } from "../server/app.js";
import { closeDb } from "../server/db/client.js";
import { createTenant } from "../server/lib/tenants.js";
import { addDays, todayIn, weekday } from "../server/lib/dates.js";
import { sslFor } from "./lib/ssl.js";

const app = getApp();
const suffix = randomBytes(3).toString("hex");
const W = { slug: `app-${suffix}`, company: "App Test" };
const P = { email: `platform-${suffix}@app.test`, password: "Platf0rmPass", slug: `plat-${suffix}` };
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
  // Made the way the platform console makes workspaces, then signed in to normally.
  await createTenant({ slug: W.slug, companyName: W.company, admin: { name: "Admin", email: "admin@app.test", employeeCode: "ADMIN", password: PASSWORD } });
  const reg = await call("/auth/login", { method: "POST", body: { workspace: W.slug, identifier: "ADMIN", password: PASSWORD } });
  ok(reg);
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

  console.log("Photo punch");
  // A 1×1 JPEG; the API checks the format and size, not what's in the picture.
  const PHOTO =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  const snapper = await person("PIC1");
  const peer = await person("PIC2");

  await check("an admin can turn photo punch on and off per person", async () => {
    const on = await call(`/admin/employees/${snapper.id}/photo-punch`, { method: "PUT", token: W.token, body: { enabled: true } });
    ok(on);
    assert.equal(on.body.employee.photoPunch, true);
    assert.equal((await call("/attendance/today", { token: snapper.token })).body.photoRequired, true);
    assert.equal((await call("/attendance/today", { token: peer.token })).body.photoRequired, false);
    assert.equal((await call(`/admin/employees/${snapper.id}/photo-punch`, { method: "PUT", token: snapper.token, body: { enabled: false } })).status, 403);
  });

  await check("with photo punch on, punching without a photo is refused", async () => {
    const res = await call("/attendance/check-in", { method: "POST", token: snapper.token, body: here });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "photo_required");
    assert.equal((await call("/attendance/check-in", { method: "POST", token: snapper.token, body: { ...here, photo: "data:text/plain;base64,aGk=" } })).status, 400);
  });

  let punchId;
  await check("check-in and check-out store their photos", async () => {
    const inRes = await call("/attendance/check-in", { method: "POST", token: snapper.token, body: { ...here, photo: PHOTO } });
    ok(inRes, 201);
    punchId = inRes.body.record.id;
    assert.equal((await call("/attendance/check-out", { method: "POST", token: snapper.token, body: here })).status, 400);
    ok(await call("/attendance/check-out", { method: "POST", token: snapper.token, body: { ...here, photo: PHOTO } }));
    assert.deepEqual((await call("/attendance/today", { token: snapper.token })).body.record.photos, ["in", "out"]);
    const roll = await call(`/admin/attendance?date=${today}`, { token: W.token });
    assert.deepEqual(roll.body.rows.find((r) => r.id === snapper.id).record.photos, ["in", "out"]);
  });

  await check("a punch photo is visible to its owner and admins only", async () => {
    const own = await call(`/attendance/${punchId}/photos/in`, { token: snapper.token });
    ok(own);
    assert.equal(own.body.photo, PHOTO);
    ok(await call(`/attendance/${punchId}/photos/out`, { token: W.token }));
    assert.equal((await call(`/attendance/${punchId}/photos/in`, { token: peer.token })).status, 404);
  });

  await check("people without photo punch still punch with location only", async () => {
    ok(await call("/attendance/check-in", { method: "POST", token: peer.token, body: here }), 201);
    ok(await call(`/admin/employees/${snapper.id}/photo-punch`, { method: "PUT", token: W.token, body: { enabled: false } }));
    assert.equal((await call("/attendance/today", { token: snapper.token })).body.photoRequired, false);
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
  // Addresses unique to this run, each in its own /24 (limits count whole blocks).
  const net = (n) => `203.${n}.${Number.parseInt(suffix.slice(2, 4), 16)}.1`;

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
    for (let i = 0; i < 50; i++) await login("SEC3", "wrong-password", `192.0.2.${i}, 100.${64 + i}.${Number.parseInt(suffix.slice(4, 6), 16)}.1`);
    assert.equal((await login("SEC3", `${PASSWORD}2`, net(4))).status, 429);
    // …but the owner's usual address still gets in.
    ok(await login("SEC3", `${PASSWORD}2`, net(3)));
  });

  await check("sign-in attempts are counted in the database, not process memory", async () => {
    const [row] = await ownerSql`select count(*)::int as n from app.rate_limits where key like 'login:%'`;
    assert.ok(row.n > 0);
  });

  await check("neighbouring addresses in one /24 share a per-address budget", async () => {
    await person("SEC4");
    let last;
    for (let i = 0; i < 11; i++) last = await login("SEC4", "wrong-password", `198.18.${Number.parseInt(suffix.slice(0, 2), 16)}.${i}`);
    assert.equal(last.status, 429, JSON.stringify(last.body));
  });

  console.log("Platform console");
  await ownerSql`insert into app.platform_admins (email, name, role, password_hash) values (${P.email}, 'Platform Tester', 'admin', ${await bcrypt.hash(P.password, 4)})`;
  const platformLogin = (password) => call("/platform/login", { method: "POST", body: { email: P.email, password } });

  await check("there is no self-serve way to create a workspace", async () => {
    const res = await call("/auth/register", {
      method: "POST",
      body: { companyName: "Nope", workspace: `nope-${suffix}`, name: "Nope", email: "nope@app.test", password: PASSWORD },
    });
    assert.notEqual(res.status, 201);
    const [row] = await ownerSql`select count(*)::int as n from tenants where slug = ${`nope-${suffix}`}`;
    assert.equal(row.n, 0);
  });

  await check("platform sign-in checks the password", async () => {
    assert.equal((await platformLogin("wrong-password1")).status, 401);
    const res = await platformLogin(P.password);
    ok(res);
    P.token = res.body.token;
  });

  await check("platform and workspace tokens don't open each other's doors", async () => {
    assert.equal((await call("/platform/me", { token: W.token })).status, 401);
    assert.equal((await call("/platform/workspaces", { token: W.token })).status, 401);
    assert.equal((await call("/auth/me", { token: P.token })).status, 401);
    assert.equal((await call("/admin/employees", { token: P.token })).status, 401);
  });

  const newWorkspace = {
    companyName: "Platform Made Co",
    workspace: P.slug,
    name: "First Admin",
    employeeCode: "boss1",
    email: "boss@plat.test",
    password: "Handed0ver",
  };

  await check("a platform admin creates a workspace whose admin must set their own password", async () => {
    const res = await call("/platform/workspaces", { method: "POST", token: P.token, body: newWorkspace });
    ok(res, 201);
    assert.equal(res.body.admin.employeeCode, "BOSS1");
    const login = await call("/auth/login", { method: "POST", body: { workspace: P.slug, identifier: "BOSS1", password: newWorkspace.password } });
    ok(login);
    assert.equal(login.body.user.role, "admin");
    assert.equal(login.body.user.mustChangePassword, true);
    const [row] = await ownerSql`select meta from audit_logs where action = 'tenant.created' and entity_id = ${res.body.workspace.id}`;
    assert.equal(row.meta.createdBy, P.email);
  });

  await check("a taken workspace name is reported on its field", async () => {
    const res = await call("/platform/workspaces", { method: "POST", token: P.token, body: { ...newWorkspace, email: "other@plat.test" } });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.fields.workspace);
  });

  await check("the console lists every workspace with its head count", async () => {
    const { body } = await call("/platform/workspaces", { token: P.token });
    const made = body.workspaces.find((w) => w.slug === P.slug);
    assert.deepEqual([made.people, made.admins, made.status], [1, 1, "active"]);
    assert.ok(body.workspaces.some((w) => w.slug === W.slug));
  });

  await check("suspending a workspace blocks sign-in until it's reactivated", async () => {
    const { body } = await call("/platform/workspaces", { token: P.token });
    const id = body.workspaces.find((w) => w.slug === P.slug).id;
    const signIn = () => call("/auth/login", { method: "POST", body: { workspace: P.slug, identifier: "BOSS1", password: newWorkspace.password } });
    ok(await call(`/platform/workspaces/${id}/suspend`, { method: "POST", token: P.token }));
    assert.equal((await signIn()).status, 403);
    ok(await call(`/platform/workspaces/${id}/activate`, { method: "POST", token: P.token }));
    ok(await signIn());
  });

  const colleague = { name: "New Colleague", email: `colleague-${suffix}@app.test`, password: "Temp0rary1" };
  const colleagueLogin = (password) => call("/platform/login", { method: "POST", body: { email: colleague.email, password } });

  await check("a staff member adds a colleague, who must set their own password first", async () => {
    const added = await call("/platform/team", { method: "POST", token: P.token, body: colleague });
    ok(added, 201);
    colleague.id = added.body.member.id;
    assert.equal((await call("/platform/team", { method: "POST", token: P.token, body: colleague })).status, 409);

    const login = await colleagueLogin(colleague.password);
    ok(login);
    assert.equal(login.body.admin.mustChangePassword, true);
    const blocked = await call("/platform/workspaces", { token: login.body.token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, "password_change_required");

    const changed = await call("/platform/password", {
      method: "POST",
      token: login.body.token,
      body: { currentPassword: colleague.password, newPassword: "MyOwnPass9" },
    });
    ok(changed);
    assert.equal((await call("/platform/me", { token: login.body.token })).status, 401, "the old token is retired");
    ok(await call("/platform/workspaces", { token: changed.body.token }));
    colleague.password = "MyOwnPass9";
    colleague.token = changed.body.token;
  });

  await check("the team list shows who added whom", async () => {
    const { body } = await call("/platform/team", { token: P.token });
    const row = body.team.find((m) => m.email === colleague.email);
    assert.equal(row.createdBy, "Platform Tester");
    assert.equal(row.mustChangePassword, false);
  });

  await check("resetting a colleague's password signs them out and makes it temporary again", async () => {
    ok(await call(`/platform/team/${colleague.id}/reset-password`, { method: "POST", token: P.token, body: { password: "Reset0Pass" } }));
    assert.equal((await call("/platform/me", { token: colleague.token })).status, 401);
    const login = await colleagueLogin("Reset0Pass");
    ok(login);
    assert.equal(login.body.admin.mustChangePassword, true);
  });

  await check("staff can't see the team, its admins or password requests", async () => {
    const login = await colleagueLogin("Reset0Pass");
    const token = (await call("/platform/password", { method: "POST", token: login.body.token, body: { currentPassword: "Reset0Pass", newPassword: "Staff0Pass" } })).body.token;
    colleague.token = token;
    const me = await call("/platform/me", { token });
    assert.equal(me.body.admin.role, "staff");
    ok(await call("/platform/workspaces", { token }));
    for (const path of ["/platform/team", "/platform/password-requests"]) assert.equal((await call(path, { token })).status, 403, path);
    const add = await call("/platform/team", { method: "POST", token, body: { name: "Sneaky", email: "sneaky@app.test", password: "Sneaky123" } });
    assert.equal(add.status, 403);
    assert.equal((await call(`/platform/team/${me.body.admin.id}/role`, { method: "POST", token, body: { role: "admin" } })).status, 403);
  });

  await check("an admin who forgot their password asks another admin, who can answer it", async () => {
    const forgetful = { email: `forgot-${suffix}@app.test` };
    const made = await call("/platform/team", {
      method: "POST",
      token: P.token,
      body: { name: "Forgetful Admin", email: forgetful.email, role: "admin", password: "Forgot0Pass" },
    });
    ok(made, 201);
    forgetful.id = made.body.member.id;
    // An address block of its own per run, so the request limit doesn't carry over between runs.
    const from = `198.19.${Number.parseInt(suffix.slice(2, 4), 16)}.1`;
    const ask = (email, adminEmail) =>
      call("/platform/password-requests", { method: "POST", body: { email, adminEmail }, headers: { "x-forwarded-for": from } });
    // Same answer when the details don't match anyone, so the form can't find accounts.
    ok(await ask("nobody@app.test", P.email));
    ok(await ask(forgetful.email, "nobody@app.test"));
    ok(await ask(forgetful.email, colleague.email)); // asking someone who isn't an admin
    ok(await ask(colleague.email, P.email)); // staff don't use this; they ask an admin directly
    assert.equal((await call("/platform/password-requests", { token: P.token })).body.requests.length, 0);

    ok(await ask(forgetful.email, P.email));
    ok(await ask(forgetful.email, P.email)); // asking twice keeps one request
    const { body } = await call("/platform/password-requests", { token: P.token });
    assert.deepEqual(body.requests.map((r) => r.email), [forgetful.email]);
    assert.equal((await call("/platform/me", { token: P.token })).body.admin.passwordRequests, 1);

    ok(await call(`/platform/team/${forgetful.id}/reset-password`, { method: "POST", token: P.token, body: { password: "Answer0Pass" } }));
    assert.equal((await call("/platform/password-requests", { token: P.token })).body.requests.length, 0, "answered requests close");
    const signIn = await call("/platform/login", { method: "POST", body: { email: forgetful.email, password: "Answer0Pass" } });
    ok(signIn);
    assert.equal(signIn.body.admin.mustChangePassword, true);

    ok(await ask(forgetful.email, P.email));
    const [open] = (await call("/platform/password-requests", { token: P.token })).body.requests;
    ok(await call(`/platform/password-requests/${open.id}/dismiss`, { method: "POST", token: P.token }));
    assert.equal((await call("/platform/password-requests", { token: P.token })).body.requests.length, 0);
  });

  await check("admins add admins, change roles, but can't demote themselves", async () => {
    const added = await call("/platform/team", {
      method: "POST",
      token: P.token,
      body: { name: "Second Admin", email: `admin2-${suffix}@app.test`, role: "admin", password: "Second0Pass" },
    });
    ok(added, 201);
    const { body } = await call("/platform/me", { token: P.token });
    assert.equal((await call(`/platform/team/${body.admin.id}/role`, { method: "POST", token: P.token, body: { role: "staff" } })).status, 400);
    ok(await call(`/platform/team/${added.body.member.id}/role`, { method: "POST", token: P.token, body: { role: "staff" } }));
    const team = (await call("/platform/team", { token: P.token })).body.team;
    assert.equal(team.find((m) => m.id === added.body.member.id).role, "staff");
  });

  await check("the console can never be left without an active admin", async () => {
    const { body } = await call("/platform/me", { token: P.token });
    // Pretend every other admin is gone, inside a transaction that's rolled back.
    await ownerSql
      .begin(async (tx) => {
        await tx`update app.platform_admins set is_active = false where id <> ${body.admin.id} and role = 'admin'`;
        await assert.rejects(tx.savepoint((sp) => sp`select app.platform_admin_set_role(${body.admin.id}, 'staff')`), /at least one active admin/);
        await assert.rejects(tx.savepoint((sp) => sp`select app.platform_admin_set_active(${body.admin.id}, false)`), /at least one active admin/);
        throw Object.assign(new Error("rollback"), { rollback: true });
      })
      .catch((err) => {
        if (!err.rollback) throw err;
      });
  });

  await check("admins can deactivate a colleague but not themselves", async () => {
    const { body } = await call("/platform/me", { token: P.token });
    assert.equal((await call(`/platform/team/${body.admin.id}/deactivate`, { method: "POST", token: P.token })).status, 400);
    ok(await call(`/platform/team/${colleague.id}/deactivate`, { method: "POST", token: P.token }));
    assert.equal((await colleagueLogin("Staff0Pass")).status, 401);
    ok(await call(`/platform/team/${colleague.id}/activate`, { method: "POST", token: P.token }));
    ok(await colleagueLogin("Staff0Pass"));
  });

  await check("changing your own password needs the current one", async () => {
    const res = await call("/platform/password", { method: "POST", token: P.token, body: { currentPassword: "nope", newPassword: "Another1Pass" } });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.currentPassword);
  });

  await check("disabling a platform admin ends their session", async () => {
    await ownerSql`update app.platform_admins set is_active = false, token_version = token_version + 1 where email = ${P.email}`;
    assert.equal((await call("/platform/me", { token: P.token })).status, 401);
    assert.equal((await platformLogin(P.password)).status, 401);
  });

  console.log("Maintenance");
  await check("the owner can delete someone who reviewed leave (cascade isn't blocked by guards)", async () => {
    // The workspace admin recorded (reviewed) leave above; removing them nulls reviewer_id on those rows.
    await ownerSql`delete from users where id = ${W.adminId}`;
    const [row] = await ownerSql`select count(*)::int as n from leave_requests where tenant_id = (select id from tenants where slug = ${W.slug}) and reviewer_id is null`;
    assert.ok(row.n > 0);
  });
} finally {
  await ownerSql`delete from tenants where slug in (${W.slug}, ${P.slug})`;
  await ownerSql`delete from app.platform_admins where email in (${P.email}, ${`colleague-${suffix}@app.test`}, ${`admin2-${suffix}@app.test`}, ${`forgot-${suffix}@app.test`})`;
  await Promise.all([ownerSql.end(), closeDb()]);
  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}. Test workspace removed.`);
}


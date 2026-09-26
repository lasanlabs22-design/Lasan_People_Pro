# Lasan People Pro — multi-tenant attendance & leave management

One Next.js 16 app that serves many companies ("workspaces") from one Postgres database. Postgres
row-level security keeps each workspace's data separate.

```
Browser ──► Next.js (pages, server actions, /api/*) ──in-process──► Hono API (server/) ──► Postgres
             cookie: httpOnly JWT {sub, tid}                         one transaction per request,
                                                                     SET app.tenant_id / user_id / role
```

- **Single deployable.** The Hono API from Lasan People v1 now lives in `server/` and runs inside the
  Next.js process. Pages and server actions call it in-process with no HTTP hop. It is also served at `/api/*`
  for other clients (e.g. a mobile app) using a `Bearer` token.
- **Tenant isolation lives in the database**, not just in application code. See [Multi-tenancy & RLS](#multi-tenancy--row-level-security).

**Contents:** [User manual](#user-manual) · [Multi-tenancy & RLS](#multi-tenancy--row-level-security) ·
[Features](#features) · [Leave policy](#default-leave-policy-india) · [Local setup](#local-setup) ·
[Deploying](#deploying) · [Project map](#project-map)

---

# User manual

Lasan People is where you check in and out of work, apply for leave, and see company holidays.
Admins also use it to manage employees, approve leave, and set company rules. It works in any modern
browser on a phone or a computer.

- [1. Getting started (everyone)](#1-getting-started-everyone)
- [2. Employee guide](#2-employee-guide)
- [3. Admin guide](#3-admin-guide)
- [4. Troubleshooting & FAQ](#4-troubleshooting--faq)

## 1. Getting started (everyone)

### Getting your company's workspace (first admin only)

Workspaces are set up by Lasan; there is no sign-up page. When your company joins, Lasan sends its first admin
a login with the **workspace name** (for example `acme-tools`), an **employee ID** and a **temporary password**.

1. Sign in with those details (see [Signing in](#signing-in)).
2. Replace the temporary password with your own.
3. You land on the **Overview**, with a note on what to set up first. Continue with the
   [first-time setup checklist](#31-first-time-setup-checklist).

### Signing in

1. Open the Lasan People web address your company gave you. If your admin sent you a link that ends with
   `?workspace=your-company`, the workspace is filled in for you.
2. In **Workspace**, enter your company's workspace name, for example `acme-tools`. This device remembers it
   for next time.
3. In **Employee ID or email**, enter your employee ID (for example `LS001`) or your work email.
4. Enter your password and select **Sign in**. The eye icon shows or hides what you type.

Employees go to their **Dashboard** and admins go to the **Overview**. The workspace you're signed in to is
shown at the top of the menu.

### First sign-in: set your own password

Your admin gives you a **temporary password**. The first time you sign in, you are asked to replace it:

1. In **Current / temporary password**, enter the password your admin gave you.
2. Enter a **New password** that has at least **8 characters, a letter and a number**. The three checks
   below the field turn green as you meet each rule.
3. Type it again in **Confirm new password** and select **Save password**.

You can change your password again at any time from **Profile → Change password**.

> **Forgot your password?** Ask your admin to reset it. You'll get a new temporary password and will set
> your own again the next time you sign in.

### Getting around

- **On a computer**, the menu is on the left. Your name, photo and the **Sign out** button are at the bottom of it.
- **On a phone**, employees have a tab bar at the bottom of the screen (Dashboard, Leaves, Attendance,
  Holidays, Profile). The **☰** button at the top opens the full menu, including **Sign out**.

### Signing out

Select the **Sign out** icon (arrow) next to your name. If your password is changed or reset, or your access
is revoked, you are signed out on every device straight away.

---

## 2. Employee guide

### 2.1 Dashboard

Your home screen shows:

- **Attendance card**: a live clock, today's check-in and check-out times, and how long you've worked.
- **Leave balance** for each leave type.
- **Recent requests** and their status.
- **Upcoming holidays**.
- An **Apply for leave** button at the top.

### 2.2 Checking in and out

1. Open the **Dashboard**.
2. Select **Check in**. If your company uses location check-in, your browser asks for permission to use
   your location. Select **Allow**.
3. At the end of the day, select **Check out**.

After you check out you'll see *"You're done for today."* You can check in and out **once per day**.

The badge in the top-right corner of the card shows where you are:

| Badge | Meaning |
| ----- | ------- |
| **At *Office name*** (green) | You're inside the office area |
| ***120 m* from *Office name*** (amber) | You're outside the office area |
| **Location not required** | Your company doesn't use location check-in |

Your location is checked **only when you select Check in or Check out**. It is not tracked at any other time.

Depending on your company's setting:

- **Enforce**: you can only check in while you're inside an office area.
- **Record only**: you can check in from anywhere, but check-ins outside the office are marked **Remote**.
- **Off**: location isn't used.

> Tip: GPS indoors can be off by a few metres. If a check-in is refused, move near a window or the entrance
> and try again. Small GPS errors (up to 50 m) are already allowed for.

### 2.3 Applying for leave

1. Select **Apply for leave** from the Dashboard or **My leaves**.
2. Choose a **Leave type**. Each option shows how many days you have left.
3. Choose the **From** and **To** dates.
4. For a single day, you can choose **Full day**, **First half** or **Second half** where the leave type
   allows half days.
5. Check the preview, for example *"This uses 3 days · 9 days will remain"*.
6. Enter a short **Reason** and select **Submit request**.

Things to know:

- **Weekends and company holidays are not counted.** A leave from Friday to Monday usually costs 2 days.
- **Maternity leave** is counted in calendar days, so weekends and holidays are included.
- You can't submit a request if you don't have enough balance, or if the dates overlap a request you
  already have.
- Some leave types are only shown to employees who are eligible for them. For example, maternity leave is
  only available to female employees.

### 2.4 Tracking, withdrawing and cancelling leave

Open **My leaves** to see:

- Your **balance** for each leave type (days left / annual quota).
- A **month calendar**. Approved leave is shown as a solid bar, pending leave as a dashed bar, and holidays
  in cyan. Use the arrows to move between months.
- **Requests** for the year with their status: `pending`, `approved`, `rejected` or `cancelled`. If your
  admin added a comment or a rejection reason, it appears under the request.

To change your plans:

- **Withdraw request**: for a request that hasn't been decided yet.
- **Cancel leave**: for an approved leave that hasn't started yet. The days go back to your balance.

### 2.5 Attendance history

**Attendance** shows every check-in for the month you pick:

- Totals: **Days present**, **Avg. day** and **Total hours**.
- A calendar where **green** means you checked in at the office, **amber** means remote, and **cyan** means a holiday.
- A **Log** listing each day's in and out times and hours worked.

### 2.6 Holidays

**Holidays** shows the company holiday calendar. Holidays marked **Optional** still count as working days,
so if you take one off you need to apply for leave.

### 2.7 Your profile

Open **Profile** to keep your details up to date:

- **Photo**: select **Upload photo** or **Change photo** and choose a PNG, JPG or WEBP image under 10 MB.
  It is cropped to a square automatically. Select **Remove** to delete it.
- **Personal details**: phone, date of birth, address.
- **Blood group**: useful in a medical emergency.
- **Emergency contact**: name, relationship and phone number.

Select **Save profile** when you're done. Your name, email, employee ID, designation and department can
only be changed by an admin.

---

## 3. Admin guide

Admins have these pages: **Overview**, **Employees**, **Leave requests**, **Attendance**, **Holidays** and
**Settings**. The number next to **Leave requests** is how many requests are waiting for you.

### 3.1 First-time setup checklist

1. **Settings → General**: enter the company name, choose the geofence mode and the weekly off days.
2. **Settings → Office locations**: add each office (see [3.7](#37-settings)).
3. **Settings → Leave policy**: check the leave types and yearly quotas.
4. **Holidays**: add this year's company holidays.
5. **Employees**: add your team and share each person's login.

### 3.2 Overview

The Overview shows today's numbers: **Active employees**, **Checked in today**, **On leave today** and
**Pending requests**. It also lists the leave requests waiting for you (oldest first), today's roll-call and
holidays in the next 90 days. Use **Add employee** at the top to add someone quickly.

### 3.3 Adding an employee

1. Go to **Employees** and select **Add employee**.
2. Fill in:
   - **Full name**
   - **Employee ID**: the ID the person signs in with, for example `LS001`
   - **Gender**: decides which leave types they can use (for example, maternity leave)
   - **Work email**
   - **Designation**, **Department** and **Date of joining** (optional)
   - **Access**: *Employee* or *Administrator*
   - **Temporary password**: leave it blank to generate one automatically
3. Select **Create & get login**.
4. A card shows the person's **workspace, login ID and temporary password**. **Copy login message** includes a
   sign-in link with the workspace already filled in. Send it to them now.
   **The password is shown only once.**

The employee is asked to set their own password when they first sign in.

### 3.4 Managing employees

On **Employees**, you can search by name, ID, email or team, and filter by **All**, **Active** or **Revoked**.
Select a row to open that employee's page.

At the top of an employee's page:

| Button | What it does |
| ------ | ------------ |
| **Edit** | Change name, ID, gender, email, designation, department or date of joining |
| **Reset password** | Creates a new temporary password (shown once) and signs the person out everywhere |
| **Revoke access** | Blocks sign-in straight away and cancels their pending leave requests. Use this when someone leaves |
| **Reinstate** | Gives a revoked employee access again |

The employee page has four tabs:

- **Leave calendar**: the whole year at a glance, with leave balances. Use **‹ ›** to change the year.
  Select **Adjust quota** under a balance to give this person a different number of days for that year, for
  example fewer days for someone who joined mid-year, or extra days as a special grant. Leave the field
  blank to go back to the company default.
- **Ratings**: give a **1–5 star** rating for a period (`2026`, `2026-09` or `2026-Q3`) with an optional
  comment. Earlier ratings are listed as history. The latest rating appears in the employee list.
- **Attendance**: the employee's check-ins by month. Green means inside the geofence and amber means remote or outside.
- **Profile**: the personal details and emergency contact the employee entered.

### 3.5 Reviewing leave requests

1. Open **Leave requests**. The **Pending** tab lists requests waiting for a decision.
2. Check the employee, leave type, dates, number of days and reason.
3. Select one of these:
   - **Approve**: you can add a comment, for example *"Enjoy your time off!"*.
   - **Reject**: you must enter a reason. The employee will see it.

Use the **Approved**, **Rejected** and **Cancelled** tabs to look at past decisions. Once a request has been
decided it can't be decided again, even if two admins try at the same time.

### 3.6 Attendance

**Attendance** shows the roll-call for one day: **Present**, **On leave** and **Not checked in**, plus each
person's check-in and check-out times, hours worked and location (**In office** with the distance, or
**Remote**). Use **‹ ›** or the date picker to see earlier days, and **Today** to come back. Select a person
to open their attendance history.

### 3.7 Settings

**General**

- **Company name**: also the name shown for your workspace. The workspace *name people sign in with* can't be changed.
- **Geofence for check-in**:
  - **Enforce**: check-in only works inside an office area.
  - **Record only**: check-in works anywhere, and check-ins outside an office are marked *Remote*.
  - **Off**: location isn't used. Good for fully remote teams.
- **Weekly off days**: the days that aren't counted when working out how many days a leave uses.

Select **Save settings** to apply the changes.

**Leave policy**

Each leave type has a colour, a name, a yearly quota in days, and an **Active** switch. Select **Save** on
each row you change. Changing a quota here changes it for everyone. To change it for one person, use
**Adjust quota** on their employee page instead.

**Office locations**

1. Select **Add office** and enter a **Name** (and an address if you like).
2. Stand inside the office and select **Use my current location** to fill in the latitude and longitude.
   You can also type them in.
3. Set the **Radius** in metres. 100–200 m suits most offices.
4. Make sure **Active** is ticked and select **Add office**.

Select an office to edit or delete it. If the mode is **Enforce** but there's no active office, check-ins
are allowed from anywhere, and a warning explains this.

### 3.8 Holidays

1. Open **Holidays** and select a date on the calendar, or select **Add**.
2. Enter the **Name** and **Date**.
3. Tick **Optional / restricted holiday** if employees can choose whether to take it. Optional holidays
   appear on calendars but still count as working days for leave.
4. Select **Add holiday**.

Select a holiday on the calendar or in the list to edit it, or use the bin icon to delete it.

---

## 4. Troubleshooting & FAQ

| Problem | What to do |
| ------- | ---------- |
| *"Location is required. Allow location access…"* | Allow location for this site in your browser settings (on a phone, also check that Location Services are on for your browser), then try again. |
| Check-in says I'm outside the office | Move closer to the office or a window and try again. If you're in the right place, ask your admin to check the office location and radius. |
| *"You have already checked in / out today"* | You can check in and out once per day. Ask your admin if a time needs fixing. |
| *"You already have a leave request covering some of these dates"* | Withdraw or cancel the existing request first, then apply again. |
| *"Those dates are all weekends or holidays"* | Those days don't need leave. |
| Submit is disabled with *"only N days are available"* | You don't have enough balance. Choose fewer days or a different leave type, or talk to your admin. |
| I can't see a leave type | You may not be eligible for it, or the admin has turned it off. |
| I can't cancel a leave | Approved leave can only be cancelled before it starts. |
| I was signed out suddenly | Your password was changed or reset, or your access was changed. Sign in again, or contact your admin. |
| Forgot password | Ask your admin to **Reset password**. |
| Location doesn't work at all | Location only works on the secure (`https://`) address of the app. |

---

# For developers

## Features

**Admin**
- Overview: headcount, who's checked in, who's on leave, pending requests, upcoming holidays
- Employees: add (with gender, which drives maternity eligibility), edit, revoke / reinstate access, reset password
  (one-time temporary password shown to the admin, forced change on first login)
- Per-employee page: year-at-a-glance leave calendar, balances with per-person quota overrides, 1–5★ ratings with
  history, monthly attendance, profile and emergency contact
- Leave requests: approve with optional comment, reject with required reason; race-safe (can't double-decide)
- Holiday calendar: click a date to add/edit; mandatory vs optional holidays
- Settings: geofence mode (enforce / record only / off), office locations with radius ("use my current location"),
  weekly off days, leave-type quotas

**Employee**
- Dashboard: live clock, geofenced check-in/out, leave balance rings, recent requests, upcoming holidays
- Apply for leave with a live preview of how many days it will cost (weekends and holidays excluded), half days,
  overlap and balance checks, withdraw/cancel
- Attendance history and holiday calendar
- Profile: photo (resized client-side), phone, DOB, address, blood group, emergency contact; change password

**Workspaces**
- Created only by Lasan staff from the platform console (`/platform`), with the first admin and the default
  leave policy, holidays and settings; no public sign-up
- Platform console: create, suspend and reactivate workspaces; manage the Lasan team (add staff with a temporary
  password, reset passwords, deactivate); every staff member can change their own password
- Sign-in by workspace name + employee ID/email; the same employee ID or email can exist in different workspaces
- Workspace shown in the menu; login messages for new employees include a pre-filled sign-in link

**Security**
- Tenant isolation enforced by Postgres row-level security (see below), verified by `npm run test:rls`
- bcrypt passwords, HS256 JWT carrying user + tenant id and a per-user token version: revoking access,
  resetting or changing a password signs the user out everywhere immediately
- Every API route re-checks the user and workspace in the database (status + token version + role);
  `proxy.js` is only an optimistic redirect
- Workspace and platform sign-in rate-limited; no user enumeration; append-only audit log
- Platform staff live outside every workspace (private `app` schema, reached only through definer functions)
  and use separate tokens: a workspace token can't open the console, and a console token can't open a workspace
- Geofence is enforced server-side (haversine distance; GPS accuracy forgiven up to 50 m)

## Multi-tenancy & row-level security

Shared database, shared schema, `tenant_id` on every row. Postgres enforces isolation, so a bug in a
query can't leak another company's data.

| Layer | What it does |
| ----- | ------------ |
| **Runtime role** `lasan_pro_app` | The app connects as this role. It is not a superuser, has no `BYPASSRLS` and owns no tables, so every policy applies to it. Migrations use a separate owner connection (`DATABASE_ADMIN_URL`). |
| **Request context** | `requireAuth` opens one transaction per request and runs `set_config('app.tenant_id' / 'app.user_id' / 'app.role', …, true)`. The values are transaction-local, so a pooled connection never carries them into the next request. `db` in `server/` is bound to that transaction through `AsyncLocalStorage` and throws if it's used outside a tenant context. |
| **Policies** | Every table has `ENABLE` + `FORCE ROW LEVEL SECURITY` with a `tenant_id = app.current_tenant_id()` policy. With no context set, every table reads as empty. |
| **Role inside a workspace** | Catalog tables (leave types, holidays, offices, settings) can be read by everyone and written only by admins. Personal tables (profiles, attendance, leave requests) are visible to their owner and to admins. The role comes from the user's database row, never from the token. |
| **Guard triggers** | Non-admins can't change their own role, status or HR fields, and can only create *pending* leave or cancel their own. |
| **Composite foreign keys** | Children reference `(tenant_id, id)`, so a row can't point at another tenant's user, leave type or office, even with a guessed UUID. |
| **Defaults** | `tenant_id` defaults to `app.current_tenant_id()`, so inserts never have to pass it (and can't pass someone else's). |
| **Sign-in** | Before a tenant is known, the workspace name is resolved by the narrow `SECURITY DEFINER` function `app.tenant_by_slug()`. It's the only way to read across tenants. |

Everything is defined in [`db/migrations/0001_multi_tenant_init.sql`](db/migrations/0001_multi_tenant_init.sql).

### Database layout on Railway

The app uses the **same Railway Postgres service** as Lasan People v1 (project *worthy-learning*) but its own
**database, `lasan_pro`**. The v1 database (`railway`) is untouched. Only `lasan_pro_app` and superusers can
connect to `lasan_pro`.

To move to a dedicated Postgres service later, point `PG_SUPERUSER_URL` at the new service and re-run
`db:setup` and `db:migrate`.

## Default leave policy (India)

Seeded defaults. Admins can change them in **Settings → Leave policy**, or per employee via **Adjust quota**.

| Type            | Days / year          | Basis |
| --------------- | -------------------- | ----- |
| Casual Leave    | 12                   | State Shops & Establishments Acts typically mandate 7–12 casual days; 12 is common in IT/services |
| Sick Leave      | 12                   | States mandate roughly 6–12 paid sick days (e.g. Maharashtra 8, many others 12) |
| Emergency Leave | 5                    | Not statutory; a company benefit. 3–5 days is typical |
| Maternity Leave | 182 (26 weeks)       | Maternity Benefit Act, 1961 (amended 2017): 26 weeks for the first two children (12 weeks from the third). Requires 80 days worked in the preceding 12 months. Counted in **calendar days**, female employees only |

That's **29 working days** a year for everyone, plus maternity where eligible. Many companies also offer
**Earned/Privilege Leave** (about 15–18 days, which most Shops Acts require) and paternity leave (5–15 days).
You can add these as extra leave types. Check the Shops & Establishments Act for your state.

## Local setup

Prereqs: Node 20+, and access to the Railway Postgres service (Railway → Postgres → Variables → `DATABASE_PUBLIC_URL`).

```bash
npm install
cp .env.example .env.local          # then set JWT_SECRET

# One time per Postgres server: creates database lasan_pro + role lasan_pro_app
# and writes DATABASE_URL / DATABASE_ADMIN_URL into .env.local
PG_SUPERUSER_URL="postgresql://postgres:…@…proxy.rlwy.net:PORT/railway" npm run db:setup

npm run db:migrate                  # schema, policies, triggers, grants
npm run test:rls                    # optional: prove tenant isolation (creates + deletes 2 test workspaces)
npm run dev                         # http://localhost:3000
```

### Platform console (Lasan staff)

Workspaces are created at **`/platform`**. The first Lasan staff account has to come from the terminal (it uses
the owner connection, so the web app can never create one on its own); after that, staff add each other from the
console's **Lasan team** page.

```bash
npm run platform:admin -- --email you@lasan.in --name "Your Name" --password "Secret123"   # create
npm run platform:admin -- --email you@lasan.in --password "NewSecret456"                   # reset a password
npm run platform:admin -- --email you@lasan.in --disable                                   # or --enable
npm run platform:admin -- --list
```

Then sign in at `/platform/login`, select **Create workspace**, and send the new company's admin the login the
console shows. They must replace the password on first sign-in.

The console has two roles. **Admins** manage the **Lasan team** page: they add people as Admin or Staff, change
roles, deactivate accounts and give out temporary passwords. **Staff** set up and manage workspaces but can't see the
team. Nobody can demote or deactivate themselves, and the console always keeps at least one active admin.

Forgot your password? Select **Forgot password?** on the console sign-in page and enter your email and the email of
the admin you're asking. The request waits in that admin's **Lasan team** page until they give you a temporary
password. If every admin is locked out, reset one from the terminal with `npm run platform:admin`.

A workspace can also be created from the terminal:

```bash
npm run tenant:create -- --slug lasan --company "Lasan" --name "Your Name" --email you@lasan.in --password "Secret123"
```

> Geolocation only works on `https://` or `localhost`. To test check-in from a phone, use the deployed URL.

## Deploying (Railway)

Create a new service in the *worthy-learning* project from this repo (root directory = repo root). Railway
detects Next.js. [`railway.json`](railway.json) sets the build, the pre-deploy migration and the start command.

Variables:

| Variable | Value |
| -------- | ----- |
| `DATABASE_URL` | `postgresql://lasan_pro_app:<app password>@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/lasan_pro` |
| `DATABASE_ADMIN_URL` | `postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/lasan_pro` |
| `JWT_SECRET` | a new random 48-byte string (don't reuse v1's) |
| `APP_TIMEZONE`, `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Kolkata` |

The app password is the one `db:setup` wrote into your `.env.local` (`DATABASE_URL`).

## Changing the schema

Add a new numbered file to `db/migrations/` (e.g. `0002_add_shifts.sql`), then mirror the columns in
`server/db/schema.js`. **Every new table needs** a `tenant_id uuid not null default app.current_tenant_id()`
column, `ENABLE`/`FORCE ROW LEVEL SECURITY`, policies, and a grant to `lasan_pro_app`. Copy the pattern from
`0001`. Run `npm run db:migrate`, then `npm run test:rls`.

## Built to grow

- `tenants.status = 'suspended'` blocks a workspace's sign-in and sessions immediately
- `leave_allocations`: per-employee/year quota overrides (pro-rata joiners, carry-forward, special grants)
- `attendance.source` (`geo` / `remote` / `manual`) and stored coordinates, accuracy and distance for audits
- `settings` key/value store per workspace: new org-level switches need no migration
- `audit_logs` captures who did what, ready for an activity feed
- Avatars are stored as small data URLs; move them to S3/R2 later by storing a URL in the same column

## Project map

```
app/                     Next.js routes
  admin/                 overview, employees/[id], leaves, attendance, holidays, settings
  employee/              dashboard, leaves, attendance, holidays, profile
  login/                 workspace sign-in (signup/ only redirects here)
  platform/              Lasan staff console: workspaces, Lasan team, change password
  api/[...path]/         the API for external clients (Bearer token)
  actions/               server actions → API
components/              UI kit, calendar, punch card, shell
lib/api.js               server-only, in-process API client
proxy.js                 optimistic route guard
server/                  the API (Hono): routes, middleware, business rules
  db/client.js           tenant-scoped transactions (withTenant, db)
  lib/tenants.js         workspace creation + default policy
db/migrations/           SQL: schema, RLS policies, triggers, grants (source of truth)
scripts/                 db-setup, migrate, create-tenant, test-rls
```

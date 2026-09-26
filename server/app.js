import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { ApiError } from "./lib/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { leaveRoutes, adminLeaveRoutes } from "./routes/leaves.js";
import { leaveTypeRoutes, holidayRoutes, orgRoutes, configRoutes } from "./routes/catalog.js";
import { attendanceRoutes, adminAttendanceRoutes } from "./routes/attendance.js";
import { employeeRoutes } from "./routes/employees.js";
import { overviewRoutes } from "./routes/overview.js";
import { platformAuthRoutes, platformRoutes } from "./routes/platform.js";

// Postgres unique-constraint names → the form field they belong to. All are per tenant.
const UNIQUE_FIELDS = {
  tenants_slug_uq: ["workspace", "That workspace name is taken"],
  users_employee_code_uq: ["employeeCode", "That employee ID is already in use"],
  users_email_uq: ["email", "That email is already in use"],
  leave_types_code_uq: ["code", "That code is already in use"],
  holidays_date_uq: ["date", "There is already a holiday on that date"],
};

/**
 * The whole API. Next.js calls it in-process (lib/api.js) and also serves it at /api/* for
 * other clients such as a future mobile app.
 */
export function createApp() {
  const app = new Hono();

  app.use("*", secureHeaders());
  app.use("*", bodyLimit({ maxSize: 512 * 1024, onError: (c) => c.json({ error: { message: "Payload too large" } }, 413) }));

  app.get("/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

  app.route("/auth", authRoutes);
  // Platform console: its own sign-in and tokens, registered before the workspace API's auth.
  app.route("/platform", platformAuthRoutes);
  app.route("/platform", platformRoutes);

  const api = new Hono();
  api.use("*", requireAuth);
  api.route("/me", meRoutes);
  api.route("/config", configRoutes);
  api.route("/leaves", leaveRoutes);
  api.route("/leave-types", leaveTypeRoutes);
  api.route("/holidays", holidayRoutes);
  api.route("/attendance", attendanceRoutes);
  api.route("/admin/overview", overviewRoutes);
  api.route("/admin/employees", employeeRoutes);
  api.route("/admin/leaves", adminLeaveRoutes);
  api.route("/admin/attendance", adminAttendanceRoutes);
  api.route("/admin/org", orgRoutes);
  app.route("/", api);

  app.notFound((c) => c.json({ error: { message: "Route not found", code: "not_found" } }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: { message: err.message, code: err.code, fields: err.fields } }, err.status);
    }
    const pg = err.cause ?? err;
    if (pg?.code === "23505") {
      const [field, message] = UNIQUE_FIELDS[pg.constraint_name] ?? [undefined, "That record already exists"];
      return c.json({ error: { message, code: "conflict", fields: field ? { [field]: message } : undefined } }, 409);
    }
    if (pg?.code === "23503") return c.json({ error: { message: "Referenced record does not exist", code: "bad_request" } }, 400);
    // Row-level security or a guard trigger refused the write.
    if (pg?.code === "42501") {
      console.warn("blocked by database policy:", pg.message);
      return c.json({ error: { message: "You do not have access to this resource", code: "forbidden" } }, 403);
    }
    console.error(err);
    return c.json({ error: { message: "Something went wrong on our side", code: "internal" } }, 500);
  });

  return app;
}

let instance;
export const getApp = () => (instance ??= createApp());

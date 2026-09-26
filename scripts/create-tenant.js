/**
 * Creates a workspace and its first admin from the terminal (same code path as the platform console).
 *
 *   npm run tenant:create -- --slug acme --company "Acme Tools" --name "Priya Rao" \
 *     --email priya@acme.in --password "Secret123" [--code ADMIN]
 */
import "./lib/load-env.js";
import { parseArgs } from "node:util";
import { closeDb } from "../server/db/client.js";
import { createTenant, isReservedSlug } from "../server/lib/tenants.js";

const { values: a } = parseArgs({
  options: {
    slug: { type: "string" },
    company: { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
    code: { type: "string", default: "ADMIN" },
  },
});

const missing = ["slug", "company", "name", "email", "password"].filter((k) => !a[k]);
if (missing.length) {
  console.error(`Missing: ${missing.map((k) => `--${k}`).join(", ")}`);
  process.exit(1);
}
if (isReservedSlug(a.slug)) {
  console.error(`"${a.slug}" is reserved`);
  process.exit(1);
}

try {
  const { tenant, user } = await createTenant({
    slug: a.slug,
    companyName: a.company,
    admin: { name: a.name, email: a.email, employeeCode: a.code, password: a.password },
  });
  console.log(`✓ workspace "${tenant.slug}" (${tenant.name}) created with admin ${user.email} / ${user.employeeCode}`);
} catch (err) {
  const pg = err.cause ?? err;
  console.error(pg.code === "23505" ? `That workspace name or admin already exists (${pg.constraint_name})` : err);
  process.exitCode = 1;
} finally {
  await closeDb();
}

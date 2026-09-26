/**
 * Creates a Lasan console account (admin by default, or --role staff), or updates an existing one.
 * Runs as DATABASE_ADMIN_URL (the owner). Use it for the first admin, and as the last resort if
 * every admin is locked out; otherwise admins manage the team from the console.
 *
 *   npm run platform:admin -- --email boss@lasan.in --name "Boss Name" --password "Secret123"
 *   npm run platform:admin -- --email boss@lasan.in --password "NewSecret456"   (reset password)
 *   npm run platform:admin -- --email boss@lasan.in --role admin                (or staff)
 *   npm run platform:admin -- --email boss@lasan.in --disable                   (or --enable)
 *   npm run platform:admin -- --list
 */
import "./lib/load-env.js";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { sslFor } from "./lib/ssl.js";

const { values: a } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
    role: { type: "string" },
    disable: { type: "boolean", default: false },
    enable: { type: "boolean", default: false },
    list: { type: "boolean", default: false },
  },
});

const url = process.env.DATABASE_ADMIN_URL;
if (!url) {
  console.error("DATABASE_ADMIN_URL is not set (the owner connection to the lasan_pro database).");
  process.exit(1);
}
const sql = postgres(url, { ssl: sslFor(url), max: 1, onnotice: () => {} });

// Same rule as workspace passwords (server/lib/validators.js).
const strong = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

try {
  if (a.role && !["admin", "staff"].includes(a.role)) throw new Error("--role must be admin or staff");
  if (a.list) {
    const rows = await sql`select email, name, role, is_active, last_login_at, created_at from app.platform_admins order by created_at`;
    console.table(rows);
  } else {
    if (!a.email) throw new Error("Pass --email (or --list)");
    const email = a.email.trim().toLowerCase();
    const [existing] = await sql`select id from app.platform_admins where lower(email) = ${email}`;

    if (a.password && !strong(a.password)) throw new Error("Password needs 8+ characters with a letter and a number");
    const hash = a.password ? await bcrypt.hash(a.password, 12) : null;

    if (!existing) {
      if (!a.name || !hash) throw new Error("A new platform admin needs --name and --password");
      await sql`insert into app.platform_admins (email, name, role, password_hash) values (${email}, ${a.name.trim()}, ${a.role ?? "admin"}, ${hash})`;
      console.log(`✓ platform ${a.role ?? "admin"} ${email} created. Sign in at /platform/login`);
    } else {
      // Any change signs them out everywhere.
      const active = a.disable ? false : a.enable ? true : null;
      await sql`
        update app.platform_admins set
          name = coalesce(${a.name?.trim() ?? null}, name),
          password_hash = coalesce(${hash}, password_hash),
          is_active = coalesce(${active}, is_active),
          role = coalesce(${a.role ?? null}::app.platform_role, role),
          must_change_password = case when ${hash}::text is null then must_change_password else false end,
          token_version = token_version + 1
        where id = ${existing.id}`;
      // A reset from here answers any request they had waiting in the console.
      if (hash) await sql`update app.platform_password_requests set resolved_at = now() where requester_id = ${existing.id} and resolved_at is null`;
      console.log(
        `✓ ${email} updated${hash ? " (new password)" : ""}${a.role ? ` (role: ${a.role})` : ""}${active === false ? " (disabled)" : active ? " (enabled)" : ""}`,
      );
    }
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

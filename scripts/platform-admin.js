/**
 * Creates a platform (super) admin who can sign in at /platform and create workspaces, or updates
 * an existing one. Runs as DATABASE_ADMIN_URL (the owner): the web app can't create these accounts.
 *
 *   npm run platform:admin -- --email boss@lasan.in --name "Boss Name" --password "Secret123"
 *   npm run platform:admin -- --email boss@lasan.in --password "NewSecret456"   (reset password)
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
  if (a.list) {
    const rows = await sql`select email, name, is_active, last_login_at, created_at from app.platform_admins order by created_at`;
    console.table(rows);
  } else {
    if (!a.email) throw new Error("Pass --email (or --list)");
    const email = a.email.trim().toLowerCase();
    const [existing] = await sql`select id from app.platform_admins where lower(email) = ${email}`;

    if (a.password && !strong(a.password)) throw new Error("Password needs 8+ characters with a letter and a number");
    const hash = a.password ? await bcrypt.hash(a.password, 12) : null;

    if (!existing) {
      if (!a.name || !hash) throw new Error("A new platform admin needs --name and --password");
      await sql`insert into app.platform_admins (email, name, password_hash) values (${email}, ${a.name.trim()}, ${hash})`;
      console.log(`✓ platform admin ${email} created. Sign in at /platform/login`);
    } else {
      // Any change signs them out everywhere.
      const active = a.disable ? false : a.enable ? true : null;
      await sql`
        update app.platform_admins set
          name = coalesce(${a.name?.trim() ?? null}, name),
          password_hash = coalesce(${hash}, password_hash),
          is_active = coalesce(${active}, is_active),
          token_version = token_version + 1
        where id = ${existing.id}`;
      console.log(`✓ platform admin ${email} updated${hash ? " (new password)" : ""}${active === false ? " (disabled)" : active ? " (enabled)" : ""}`);
    }
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

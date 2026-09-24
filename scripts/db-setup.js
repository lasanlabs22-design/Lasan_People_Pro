/**
 * One-time: creates the Lasan Pro database and its restricted runtime role inside an existing
 * Postgres server (e.g. the Railway Postgres the first Lasan People app already uses).
 *
 *   PG_SUPERUSER_URL=postgresql://postgres:...@host:port/railway npm run db:setup
 *
 * - Database `lasan_pro`: separate from the old app's `railway` database, same server.
 * - Role `lasan_pro_app`: LOGIN, not superuser, NOBYPASSRLS, owns nothing, so every query it
 *   runs is subject to row-level security.
 * Writes DATABASE_URL (app role) and DATABASE_ADMIN_URL (migrations) into .env.local.
 * Safe to re-run: keeps the existing app password from .env.local if there is one.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { sslFor } from "./lib/ssl.js";

const DB_NAME = process.env.LASAN_DB_NAME ?? "lasan_pro";
const APP_ROLE = "lasan_pro_app";
const ENV_FILE = ".env.local";

const superUrl = process.env.PG_SUPERUSER_URL;
if (!superUrl) {
  console.error("Set PG_SUPERUSER_URL to a superuser connection string (Railway → Postgres → DATABASE_PUBLIC_URL).");
  process.exit(1);
}

const envText = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const existingAppUrl = envText.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const appPassword =
  (existingAppUrl && new URL(existingAppUrl).username === APP_ROLE && decodeURIComponent(new URL(existingAppUrl).password)) ||
  randomBytes(24).toString("base64url");

const sql = postgres(superUrl, { ssl: sslFor(superUrl), max: 1, onnotice: () => {} });
try {
  const [role] = await sql`select 1 from pg_roles where rolname = ${APP_ROLE}`;
  if (role) {
    await sql.unsafe(`alter role ${APP_ROLE} with login nosuperuser nobypassrls nocreatedb nocreaterole password '${appPassword}'`);
    console.log(`• role ${APP_ROLE} exists (password synced)`);
  } else {
    await sql.unsafe(`create role ${APP_ROLE} with login nosuperuser nobypassrls nocreatedb nocreaterole password '${appPassword}'`);
    console.log(`✓ role ${APP_ROLE} created`);
  }

  const [db] = await sql`select 1 from pg_database where datname = ${DB_NAME}`;
  if (db) console.log(`• database ${DB_NAME} exists`);
  else {
    await sql.unsafe(`create database ${DB_NAME}`);
    console.log(`✓ database ${DB_NAME} created`);
  }
  // Only the app role (and superusers) may connect to it.
  await sql.unsafe(`revoke connect on database ${DB_NAME} from public`);
  await sql.unsafe(`grant connect on database ${DB_NAME} to ${APP_ROLE}`);
} finally {
  await sql.end();
}

const adminUrl = new URL(superUrl);
adminUrl.pathname = `/${DB_NAME}`;
const appUrl = new URL(adminUrl);
appUrl.username = APP_ROLE;
appUrl.password = appPassword;

const upsert = (text, key, value) =>
  new RegExp(`^${key}=`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
let next = upsert(envText, "DATABASE_URL", appUrl.toString());
next = upsert(next, "DATABASE_ADMIN_URL", adminUrl.toString());
writeFileSync(ENV_FILE, next.trimStart());
console.log(`✓ wrote DATABASE_URL (${APP_ROLE}) and DATABASE_ADMIN_URL to ${ENV_FILE}`);

/**
 * Applies db/migrations/*.sql in name order, each in its own transaction, recording what ran in
 * ops.schema_migrations. Runs as DATABASE_ADMIN_URL (the owner) — never as the app role.
 *
 *   npm run db:migrate
 */
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { sslFor } from "./lib/ssl.js";

const url = process.env.DATABASE_ADMIN_URL;
if (!url) {
  console.error("DATABASE_ADMIN_URL is not set (the owner connection to the lasan_pro database).");
  process.exit(1);
}

const dir = new URL("../db/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(url, { ssl: sslFor(url), max: 1, onnotice: () => {} });

try {
  await sql`create schema if not exists ops`;
  await sql`create table if not exists ops.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from ops.schema_migrations`).map((r) => r.name));

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(new URL(file, dir), "utf8"));
      await tx`insert into ops.schema_migrations (name) values (${file})`;
    });
    console.log(`✓ ${file}`);
    applied++;
  }
  console.log(applied ? `Applied ${applied} migration(s).` : "Database is up to date.");
} finally {
  await sql.end();
}

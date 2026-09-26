import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // The restricted runtime role (lasan_pro_app). Never the owner/superuser: RLS doesn't apply to those.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Railway's public proxy needs TLS; the private network (*.railway.internal) does not.
  DATABASE_SSL: z.enum(["require", "disable"]).optional(),
  // Railway's Postgres allows ~100 connections shared with the old app; keep headroom.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_TTL: z.string().default("7d"),
  APP_TIMEZONE: z.string().default(process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Kolkata"),
});

let parsed;

// Parsed on first use rather than at import, so `next build` can load modules without secrets.
function load() {
  if (parsed) return parsed;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error("Invalid environment:\n" + result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"));
  }
  return (parsed = result.data);
}

export const env = new Proxy({}, { get: (_, key) => load()[key] });

// Off unless ALLOW_PUBLIC_SIGNUP=true: workspaces are created by Lasan from the platform console.
// Read live (not cached with the rest) so tests can flip it.
export const publicSignupEnabled = () => process.env.ALLOW_PUBLIC_SIGNUP === "true";

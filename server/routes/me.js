import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { publicUser } from "../lib/auth.js";
import { BLOOD_GROUPS, isoDate, optionalText } from "../lib/validators.js";
import { validate } from "../middleware/validate.js";

const { profiles } = schema;
export const meRoutes = new Hono();

// ~200 KB of base64 ≈ 150 KB image; the web app resizes to 320px before upload.
const MAX_AVATAR_CHARS = 200_000;
const avatar = z
  .string()
  .max(MAX_AVATAR_CHARS, "Image is too large")
  .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, "Upload a PNG, JPG or WEBP image")
  .nullish();

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, "Enter a valid phone number")
  .or(z.literal("").transform(() => null))
  .nullish();

const profileSchema = z.object({
  avatar,
  phone,
  dateOfBirth: isoDate.or(z.literal("").transform(() => null)).nullish(),
  bloodGroup: z.enum(BLOOD_GROUPS).or(z.literal("").transform(() => null)).nullish(),
  address: optionalText(500),
  emergencyContactName: optionalText(120),
  emergencyContactRelation: optionalText(60),
  emergencyContactPhone: phone,
});

export async function loadProfile(userId) {
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return p ?? { userId };
}

meRoutes.get("/profile", async (c) => {
  const user = c.get("user");
  return c.json({ user: publicUser(user), profile: await loadProfile(user.id) });
});

meRoutes.put("/profile", validate("json", profileSchema), async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");
  // Only touch fields that were sent, so the avatar can be updated independently.
  const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const [profile] = await db
    .insert(profiles)
    .values({ userId: user.id, ...patch })
    .onConflictDoUpdate({ target: profiles.userId, set: { ...patch, updatedAt: new Date() } })
    .returning();
  return c.json({ profile });
});

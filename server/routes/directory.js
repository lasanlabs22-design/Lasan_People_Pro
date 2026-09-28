import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { notFound } from "../lib/errors.js";
import { loadPhoto } from "../lib/photos.js";
import { uuidParam } from "../lib/validators.js";
import { validate } from "../middleware/validate.js";

/*
 * The employee directory: every signed-in person can see the active people in their own workspace,
 * limited to work details (name, ID, email, title, department, photo). Both queries go through
 * definer functions scoped to the request's workspace (db/migrations/0010).
 */
const { profiles } = schema;
export const directoryRoutes = new Hono();

directoryRoutes.get("/", async (c) => {
  const rows = await db.execute(sql`select * from app.directory()`);
  return c.json({
    people: rows.map((r) => ({
      id: r.id,
      employeeCode: r.employee_code,
      name: r.name,
      email: r.email,
      role: r.role,
      designation: r.designation,
      department: r.department,
      hasPhoto: r.has_photo,
    })),
  });
});

// One person's profile photo, as a data URL for the /profile-photo route. Admins and the person
// themselves read the profile directly (row-level security allows exactly them, revoked people
// included); colleagues go through the directory function, which covers active people only.
directoryRoutes.get("/:id/photo", validate("param", uuidParam), async (c) => {
  const { id } = c.req.valid("param");
  const me = c.get("user");
  const [row] =
    me.role === "admin" || me.id === id
      ? await db.select({ photo: profiles.avatar }).from(profiles).where(eq(profiles.userId, id))
      : await db.execute(sql`select app.directory_photo(${id}) as photo`);
  const photo = row?.photo && (await loadPhoto(row.photo));
  if (!photo) throw notFound("Photo");
  return c.json({ photo });
});

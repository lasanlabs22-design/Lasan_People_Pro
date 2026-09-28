import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { notFound } from "../lib/errors.js";
import { uuidParam } from "../lib/validators.js";
import { validate } from "../middleware/validate.js";

/*
 * The employee directory: every signed-in person can see the active people in their own workspace,
 * limited to work details (name, ID, email, title, department, photo). Both queries go through
 * definer functions scoped to the request's workspace (db/migrations/0010).
 */
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

directoryRoutes.get("/:id/photo", validate("param", uuidParam), async (c) => {
  const [row] = await db.execute(sql`select app.directory_photo(${c.req.valid("param").id}) as photo`);
  if (!row?.photo) throw notFound("Photo");
  return c.json({ photo: row.photo });
});

import { eq } from "drizzle-orm";
import { currentTenantId, db, schema } from "../db/client.js";

export const SETTING_DEFAULTS = {
  // "enforce": check-in must be inside an office fence; "record": allow but flag; "off": don't ask for location.
  geofenceMode: "enforce",
  // 0 = Sunday ... 6 = Saturday
  weekendDays: [0, 6],
  companyName: "Lasan",
};

// Rows are already limited to the current tenant by RLS.
export async function getSettings() {
  const rows = await db.select().from(schema.settings);
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out;
}

export async function getSetting(key) {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row ? row.value : SETTING_DEFAULTS[key];
}

export async function putSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTING_DEFAULTS) || value === undefined) continue;
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: [schema.settings.tenantId, schema.settings.key], set: { value, updatedAt: new Date() } });
  }
  // The workspace's display name follows the company name.
  if (patch.companyName) {
    await db.update(schema.tenants).set({ name: patch.companyName }).where(eq(schema.tenants.id, currentTenantId()));
  }
  return getSettings();
}

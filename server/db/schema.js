// Query-side mirror of db/migrations/*.sql, which is the source of truth for constraints, indexes,
// row-level security policies and triggers. Add columns there first, then here.
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  primaryKey,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  smallint,
  numeric,
  date,
  timestamp,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended"]);
export const roleEnum = pgEnum("role", ["admin", "employee"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const userStatusEnum = pgEnum("user_status", ["active", "revoked"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected", "cancelled"]);
export const leaveGenderEnum = pgEnum("leave_gender", ["any", "male", "female"]);
export const halfDayEnum = pgEnum("half_day", ["none", "first_half", "second_half"]);
export const attendanceSourceEnum = pgEnum("attendance_source", ["geo", "manual", "remote"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Filled in by Postgres from the request's tenant context; RLS rejects any other value.
const tenantId = () => uuid("tenant_id").notNull().default(sql`app.current_tenant_id()`);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  status: tenantStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  employeeCode: varchar("employee_code", { length: 32 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  name: varchar("name", { length: 120 }).notNull(),
  gender: genderEnum("gender").notNull(),
  designation: varchar("designation", { length: 120 }),
  department: varchar("department", { length: 120 }),
  dateOfJoining: date("date_of_joining"),
  status: userStatusEnum("status").notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  // Bumped on revoke / password change / reset to invalidate every issued token.
  tokenVersion: integer("token_version").notNull().default(0),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  // Set by an admin: check-in and check-out must include a live camera photo.
  photoPunch: boolean("photo_punch").notNull().default(false),
  ...timestamps,
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  tenantId: tenantId(),
  // Small, client-resized JPEG/WEBP data URL. Swap for object storage URL later without schema churn.
  avatar: text("avatar"),
  phone: varchar("phone", { length: 32 }),
  dateOfBirth: date("date_of_birth"),
  bloodGroup: varchar("blood_group", { length: 4 }),
  address: text("address"),
  emergencyContactName: varchar("emergency_contact_name", { length: 120 }),
  emergencyContactRelation: varchar("emergency_contact_relation", { length: 60 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 32 }),
  ...timestamps,
});

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  code: varchar("code", { length: 24 }).notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  description: text("description"),
  annualQuota: numeric("annual_quota", { precision: 5, scale: 1, mode: "number" }).notNull(),
  eligibleGender: leaveGenderEnum("eligible_gender").notNull().default("any"),
  // Maternity is counted in calendar days; everything else skips weekends + holidays.
  countsCalendarDays: boolean("counts_calendar_days").notNull().default(false),
  allowHalfDay: boolean("allow_half_day").notNull().default(true),
  color: varchar("color", { length: 16 }).notNull().default("#6366f1"),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

// Per-employee, per-year override of a leave type's quota (joining pro-rata, special grants, carry-forward).
export const leaveAllocations = pgTable("leave_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  userId: uuid("user_id").notNull(),
  leaveTypeId: uuid("leave_type_id").notNull(),
  year: smallint("year").notNull(),
  days: numeric("days", { precision: 5, scale: 1, mode: "number" }).notNull(),
  note: text("note"),
  ...timestamps,
});

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  userId: uuid("user_id").notNull(),
  leaveTypeId: uuid("leave_type_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  halfDay: halfDayEnum("half_day").notNull().default("none"),
  days: numeric("days", { precision: 5, scale: 1, mode: "number" }).notNull(),
  reason: text("reason").notNull(),
  status: leaveStatusEnum("status").notNull().default("pending"),
  reviewerId: uuid("reviewer_id"),
  reviewComment: text("review_comment"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps,
});

export const holidays = pgTable("holidays", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  date: date("date").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  isOptional: boolean("is_optional").notNull().default(false),
  createdBy: uuid("created_by"),
  ...timestamps,
});

export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  userId: uuid("user_id").notNull(),
  ratedBy: uuid("rated_by"),
  score: smallint("score").notNull(),
  // Free-form period label, e.g. "2026-Q3" or "2026-09".
  period: varchar("period", { length: 16 }).notNull(),
  comment: text("comment"),
  ...timestamps,
});

export const officeLocations = pgTable("office_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: varchar("name", { length: 120 }).notNull(),
  address: text("address"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusMeters: integer("radius_meters").notNull().default(150),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  userId: uuid("user_id").notNull(),
  date: date("date").notNull(),
  source: attendanceSourceEnum("source").notNull().default("geo"),
  checkInAt: timestamp("check_in_at", { withTimezone: true }).notNull(),
  checkInLat: doublePrecision("check_in_lat"),
  checkInLng: doublePrecision("check_in_lng"),
  checkInAccuracy: doublePrecision("check_in_accuracy"),
  checkInOfficeId: uuid("check_in_office_id"),
  checkInDistance: doublePrecision("check_in_distance"),
  checkOutAt: timestamp("check_out_at", { withTimezone: true }),
  checkOutLat: doublePrecision("check_out_lat"),
  checkOutLng: doublePrecision("check_out_lng"),
  checkOutAccuracy: doublePrecision("check_out_accuracy"),
  checkOutOfficeId: uuid("check_out_office_id"),
  checkOutDistance: doublePrecision("check_out_distance"),
  note: text("note"),
  ...timestamps,
});

// Selfie taken with a punch; one per attendance row and direction ("in" / "out").
export const attendancePhotos = pgTable(
  "attendance_photos",
  {
    attendanceId: uuid("attendance_id").notNull(),
    kind: varchar("kind", { length: 3 }).notNull(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    photo: text("photo").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.attendanceId, t.kind] })],
);

// Key/value org settings (geofence enforcement, work week...), one set per tenant.
export const settings = pgTable(
  "settings",
  {
    tenantId: tenantId(),
    key: varchar("key", { length: 64 }).notNull(),
    value: jsonb("value").notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantId(),
  actorId: uuid("actor_id"),
  action: varchar("action", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: uuid("entity_id"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

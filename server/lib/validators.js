import { z } from "zod";
import { isIsoDate } from "./dates.js";

export const isoDate = z.string().refine(isIsoDate, "Use a valid date (YYYY-MM-DD)");
export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

export const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number");

export const uuidParam = z.object({ id: z.uuid("Invalid id") });
export const yearQuery = z.coerce.number().int().min(2000).max(2100);
export const monthQuery = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

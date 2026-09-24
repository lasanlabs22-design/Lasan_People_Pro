import { zValidator } from "@hono/zod-validator";
import { badRequest, zodFields } from "../lib/errors.js";

/** zValidator with the API's standard error shape. Read the result with c.req.valid(target). */
export const validate = (target, schema) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw badRequest("Please check the highlighted fields", zodFields(result.error.issues));
  });

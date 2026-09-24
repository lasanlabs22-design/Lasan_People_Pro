export class ApiError extends Error {
  constructor(status, message, code = undefined, fields = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new ApiError(400, message, "bad_request", fields);
export const unauthorized = (message = "Not authenticated") => new ApiError(401, message, "unauthorized");
export const forbidden = (message = "You do not have access to this resource") => new ApiError(403, message, "forbidden");
export const notFound = (what = "Resource") => new ApiError(404, `${what} not found`, "not_found");
export const conflict = (message) => new ApiError(409, message, "conflict");

export function zodFields(issues) {
  const fields = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

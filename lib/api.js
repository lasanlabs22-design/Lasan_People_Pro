import "server-only";
import { redirect } from "next/navigation";
import { getApp } from "@/server/app";
import { getPlatformToken, getToken } from "./session";

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.fields = body?.error?.fields ?? {};
  }
}

/**
 * Server-side call into the API with the session token attached. The API runs in this same
 * process (server/app.js), so there is no network hop and no second service to deploy.
 */
export async function api(path, { method = "GET", body, token, query, clientIp } = {}) {
  const auth = token === undefined ? await getToken() : token;
  const url = new URL(path, "http://lasan.internal");
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);

  let res;
  try {
    res = await getApp().request(url.pathname + url.search, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
        // Rate limiting keys on the visitor's address.
        ...(clientIp ? { "x-lasan-client-ip": clientIp } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(err);
    throw new ApiError(503, { error: { message: "Can't reach the database right now. Please try again shortly.", code: "unreachable" } });
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

/**
 * For page loads: turns auth failures into redirects so pages only handle the happy path.
 */
export async function load(path, options) {
  try {
    return await api(path, options);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect("/logout");
      if (err.code === "password_change_required") redirect("/change-password");
      if (err.status === 403 && /revoked/i.test(err.message)) redirect("/logout?reason=revoked");
    }
    throw err;
  }
}

/** Calls the platform-console API with the platform session (not the workspace one). */
export async function platformApi(path, options = {}) {
  return api(path, { ...options, token: await getPlatformToken() });
}

/** Page loads in the platform console: an expired session goes back to its sign-in. */
export async function loadPlatform(path, options) {
  try {
    return await platformApi(path, options);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) redirect("/platform/logout");
    throw err;
  }
}

/** Standard shape returned by server actions to useActionState. */
export function actionError(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) redirect("/logout");
    return { ok: false, error: err.message, fields: err.fields };
  }
  throw err;
}

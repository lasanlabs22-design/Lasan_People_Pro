import "server-only";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "lasan_pro_session";
// Non-secret hint used only by proxy.js for fast redirects; the API is the real authority.
export const ROLE_COOKIE = "lasan_pro_role";
// Last workspace signed in to on this device, so the sign-in form can prefill it. Survives sign-out.
export const WORKSPACE_COOKIE = "lasan_pro_workspace";
const MAX_AGE = 60 * 60 * 24 * 7;

const base = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export async function getToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function getWorkspace() {
  return (await cookies()).get(WORKSPACE_COOKIE)?.value ?? "";
}

export async function setSession(token, role, workspace) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, base);
  jar.set(ROLE_COOKIE, role, base);
  if (workspace) jar.set(WORKSPACE_COOKIE, workspace, { ...base, maxAge: 60 * 60 * 24 * 365 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(ROLE_COOKIE);
}

export const homeFor = (role) => (role === "admin" ? "/admin" : "/employee");

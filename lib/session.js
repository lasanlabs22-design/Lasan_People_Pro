import "server-only";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "lasan_pro_session";
// Non-secret hint used only by proxy.js for fast redirects; the API is the real authority.
export const ROLE_COOKIE = "lasan_pro_role";
// Older versions remembered the last workspace here to prefill sign-in. The form now starts empty
// (shared office phones shouldn't hint whose company was last used), so it's only ever deleted.
const WORKSPACE_COOKIE = "lasan_pro_workspace";
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

export async function setSession(token, role) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, base);
  jar.set(ROLE_COOKIE, role, base);
  jar.delete(WORKSPACE_COOKIE);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(ROLE_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
}

// Platform console session: separate cookie, shorter life, scoped to /platform so it's never sent
// to workspace pages.
export const PLATFORM_COOKIE = "lasan_pro_platform";
const platformCookie = { ...base, path: "/platform", maxAge: 60 * 60 * 12 };

export async function getPlatformToken() {
  return (await cookies()).get(PLATFORM_COOKIE)?.value ?? null;
}

export async function setPlatformSession(token) {
  (await cookies()).set(PLATFORM_COOKIE, token, platformCookie);
}

export async function clearPlatformSession() {
  (await cookies()).delete({ name: PLATFORM_COOKIE, path: "/platform" });
}

export const homeFor =(role) => (role === "admin" ? "/admin" : "/employee");

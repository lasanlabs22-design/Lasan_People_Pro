"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { api, actionError, ApiError } from "@/lib/api";
import { setSession, homeFor } from "@/lib/session";
import { lastForwarded } from "@/server/middleware/rate-limit";

// Only allow same-site relative paths as post-login targets.
const safeNext = (next, role) =>
  typeof next === "string" && next.startsWith(`/${role === "admin" ? "admin" : "employee"}`) && !next.startsWith("//") ? next : null;

// The last X-Forwarded-For entry is the one our proxy (Railway's edge) added; earlier ones are
// whatever the visitor sent, so trusting them would let anyone pick their own rate-limit key.
async function visitorIp() {
  const h = await headers();
  return lastForwarded(h.get("x-forwarded-for")) || h.get("x-real-ip") || undefined;
}

// Credential errors aren't expired sessions, so don't use actionError's redirect.
const formError = (err) => {
  if (err instanceof ApiError) return { ok: false, error: err.message, fields: err.fields };
  throw err;
};

export async function login(_prev, formData) {
  const body = {
    workspace: String(formData.get("workspace") ?? "").trim().toLowerCase(),
    identifier: String(formData.get("identifier") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
  let res;
  try {
    res = await api("/auth/login", { method: "POST", body, token: null, clientIp: await visitorIp() });
  } catch (err) {
    return formError(err);
  }
  await setSession(res.token, res.user.role, res.tenant.slug);
  if (res.user.mustChangePassword) redirect("/change-password");
  redirect(safeNext(formData.get("next"), res.user.role) ?? homeFor(res.user.role));
}

export async function changePassword(_prev, formData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword !== String(formData.get("confirmPassword") ?? "")) {
    return { ok: false, error: "Passwords don't match", fields: { confirmPassword: "Doesn't match the new password" } };
  }
  let res;
  try {
    res = await api("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
  } catch (err) {
    return actionError(err);
  }
  await setSession(res.token, res.user.role, res.tenant.slug);
  redirect(`${homeFor(res.user.role)}?welcome=1`);
}

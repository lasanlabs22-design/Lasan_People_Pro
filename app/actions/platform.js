"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, platformApi, ApiError } from "@/lib/api";
import { setPlatformSession } from "@/lib/session";
import { lastForwarded } from "@/server/middleware/rate-limit";

const field = (fd, k) => String(fd.get(k) ?? "").trim();

// A platform session that lapsed mid-form goes back to its own sign-in, never the workspace one.
function platformError(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) redirect("/platform/logout");
    return { ok: false, error: err.message, fields: err.fields };
  }
  throw err;
}

export async function platformLogin(_prev, fd) {
  const h = await headers();
  let res;
  try {
    res = await api("/platform/login", {
      method: "POST",
      body: { email: field(fd, "email"), password: String(fd.get("password") ?? "") },
      token: null,
      clientIp: lastForwarded(h.get("x-forwarded-for")) || h.get("x-real-ip") || undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message, fields: err.fields };
    throw err;
  }
  await setPlatformSession(res.token);
  redirect(res.admin.mustChangePassword ? "/platform/password" : "/platform");
}

export async function createWorkspace(_prev, fd) {
  if (fd.get("password") !== fd.get("confirmPassword")) {
    return { ok: false, error: "Passwords don't match", fields: { confirmPassword: "Doesn't match the password" } };
  }
  const password = String(fd.get("password") ?? "");
  try {
    const res = await platformApi("/platform/workspaces", {
      method: "POST",
      body: {
        companyName: field(fd, "companyName"),
        workspace: field(fd, "workspace").toLowerCase(),
        name: field(fd, "name"),
        employeeCode: field(fd, "employeeCode") || undefined,
        email: field(fd, "email"),
        password,
      },
    });
    revalidatePath("/platform");
    // The password goes back to this browser once, so the console can show the login to hand over.
    return { ok: true, ...res, password };
  } catch (err) {
    return platformError(err);
  }
}

export async function changePlatformPassword(_prev, fd) {
  const newPassword = String(fd.get("newPassword") ?? "");
  if (newPassword !== String(fd.get("confirmPassword") ?? "")) {
    return { ok: false, error: "Passwords don't match", fields: { confirmPassword: "Doesn't match the new password" } };
  }
  let res;
  try {
    res = await platformApi("/platform/password", {
      method: "POST",
      body: { currentPassword: String(fd.get("currentPassword") ?? ""), newPassword },
    });
  } catch (err) {
    return platformError(err);
  }
  // The password change signed out every session, this one included; carry on with the new token.
  await setPlatformSession(res.token);
  redirect("/platform?password=changed");
}

export async function addStaff(_prev, fd) {
  if (fd.get("password") !== fd.get("confirmPassword")) {
    return { ok: false, error: "Passwords don't match", fields: { confirmPassword: "Doesn't match the password" } };
  }
  const password = String(fd.get("password") ?? "");
  try {
    const res = await platformApi("/platform/team", {
      method: "POST",
      body: { name: field(fd, "name"), email: field(fd, "email"), password },
    });
    revalidatePath("/platform/team");
    return { ok: true, ...res, password };
  } catch (err) {
    return platformError(err);
  }
}

export async function resetStaffPassword(id, _prev, fd) {
  const password = String(fd.get("password") ?? "");
  try {
    await platformApi(`/platform/team/${id}/reset-password`, { method: "POST", body: { password } });
    revalidatePath("/platform/team");
    return { ok: true, password };
  } catch (err) {
    return platformError(err);
  }
}

export async function setStaffActive(id, active) {
  try {
    await platformApi(`/platform/team/${id}/${active ? "activate" : "deactivate"}`, { method: "POST" });
    revalidatePath("/platform/team");
    return { ok: true };
  } catch (err) {
    return platformError(err);
  }
}

export async function setWorkspaceStatus(id, status) {
  try {
    await platformApi(`/platform/workspaces/${id}/${status === "suspended" ? "suspend" : "activate"}`, { method: "POST" });
    revalidatePath("/platform");
    return { ok: true };
  } catch (err) {
    return platformError(err);
  }
}

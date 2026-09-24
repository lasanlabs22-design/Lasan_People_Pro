"use server";

import { revalidatePath } from "next/cache";
import { api, actionError } from "@/lib/api";

async function run(call, ...paths) {
  try {
    const data = await call();
    revalidatePath("/employee", "layout");
    for (const p of paths) revalidatePath(p);
    return { ok: true, ...data };
  } catch (err) {
    return actionError(err);
  }
}

const leaveBody = (fd) => ({
  leaveTypeId: String(fd.get("leaveTypeId") ?? ""),
  startDate: String(fd.get("startDate") ?? ""),
  endDate: String(fd.get("endDate") || fd.get("startDate") || ""),
  halfDay: String(fd.get("halfDay") || "none"),
  reason: String(fd.get("reason") ?? "").trim(),
});

export async function applyLeave(_prev, fd) {
  return run(() => api("/leaves", { method: "POST", body: leaveBody(fd) }), "/employee/leaves");
}

/** Dry run used while the form is being filled in. Never throws. */
export async function previewLeave(body) {
  try {
    return { ok: true, ...(await api("/leaves/preview", { method: "POST", body: { reason: "preview", ...body } })) };
  } catch (err) {
    return actionError(err);
  }
}

export async function cancelLeave(id) {
  return run(() => api(`/leaves/${id}/cancel`, { method: "POST" }), "/employee/leaves");
}

export async function punch(kind, position) {
  const path = kind === "out" ? "/attendance/check-out" : "/attendance/check-in";
  return run(() => api(path, { method: "POST", body: position ?? {} }), "/employee/attendance");
}

export async function saveProfile(_prev, fd) {
  const body = {};
  for (const k of [
    "phone",
    "dateOfBirth",
    "bloodGroup",
    "address",
    "emergencyContactName",
    "emergencyContactRelation",
    "emergencyContactPhone",
  ]) {
    if (fd.has(k)) body[k] = String(fd.get(k)).trim();
  }
  return run(() => api("/me/profile", { method: "PUT", body }), "/employee/profile");
}

export async function saveAvatar(dataUrl) {
  return run(() => api("/me/profile", { method: "PUT", body: { avatar: dataUrl } }), "/employee/profile");
}

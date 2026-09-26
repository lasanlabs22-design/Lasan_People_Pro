"use server";

import { revalidatePath } from "next/cache";
import { api, actionError } from "@/lib/api";

const str = (fd, k) => {
  const v = fd.get(k);
  return v === null ? undefined : String(v).trim();
};

async function run(call, ...paths) {
  try {
    const data = await call();
    // Refresh the admin layout too (pending-leave badge, counts).
    revalidatePath("/admin", "layout");
    for (const p of paths) revalidatePath(p);
    return { ok: true, ...data };
  } catch (err) {
    return actionError(err);
  }
}

/* ------------------------------ Employees ------------------------------ */

const employeeBody = (fd) => ({
  employeeCode: str(fd, "employeeCode"),
  name: str(fd, "name"),
  email: str(fd, "email"),
  gender: str(fd, "gender"),
  designation: str(fd, "designation"),
  department: str(fd, "department"),
  dateOfJoining: str(fd, "dateOfJoining"),
});

export async function createEmployee(_prev, fd) {
  return run(() =>
    api("/admin/employees", {
      method: "POST",
      body: { ...employeeBody(fd), role: str(fd, "role") || "employee", password: str(fd, "password") },
    }),
  );
}

export async function updateEmployee(id, _prev, fd) {
  return run(() => api(`/admin/employees/${id}`, { method: "PATCH", body: employeeBody(fd) }), `/admin/employees/${id}`);
}

export async function revokeEmployee(id) {
  return run(() => api(`/admin/employees/${id}/revoke`, { method: "POST" }), `/admin/employees/${id}`);
}

export async function reinstateEmployee(id) {
  return run(() => api(`/admin/employees/${id}/reinstate`, { method: "POST" }), `/admin/employees/${id}`);
}

export async function setPhotoPunch(id, enabled) {
  return run(
    () => api(`/admin/employees/${id}/photo-punch`, { method: "PUT", body: { enabled } }),
    `/admin/employees/${id}`,
    "/admin/employees",
  );
}

export async function resetEmployeePassword(id) {
  return run(() => api(`/admin/employees/${id}/reset-password`, { method: "POST" }));
}

export async function rateEmployee(id, _prev, fd) {
  return run(
    () =>
      api(`/admin/employees/${id}/ratings`, {
        method: "POST",
        body: { score: Number(fd.get("score")), period: str(fd, "period"), comment: str(fd, "comment") },
      }),
    `/admin/employees/${id}`,
  );
}

export async function deleteRating(id, ratingId) {
  return run(() => api(`/admin/employees/${id}/ratings/${ratingId}`, { method: "DELETE" }), `/admin/employees/${id}`);
}

export async function setAllocation(id, _prev, fd) {
  const raw = str(fd, "days");
  return run(
    () =>
      api(`/admin/employees/${id}/allocations`, {
        method: "PUT",
        body: {
          leaveTypeId: str(fd, "leaveTypeId"),
          year: Number(fd.get("year")),
          days: raw === "" ? null : Number(raw),
          note: str(fd, "note"),
        },
      }),
    `/admin/employees/${id}`,
  );
}

/* -------------------------------- Leaves -------------------------------- */

export async function approveLeave(id, _prev, fd) {
  return run(() => api(`/admin/leaves/${id}/approve`, { method: "POST", body: { comment: str(fd, "comment") } }), "/admin/leaves");
}

export async function rejectLeave(id, _prev, fd) {
  return run(() => api(`/admin/leaves/${id}/reject`, { method: "POST", body: { reason: str(fd, "reason") } }), "/admin/leaves");
}

// Leave recorded on an employee's behalf (any date, approved straight away).
export async function recordLeave(userId, _prev, fd) {
  const body = {
    userId,
    leaveTypeId: str(fd, "leaveTypeId"),
    startDate: str(fd, "startDate"),
    endDate: str(fd, "endDate") || str(fd, "startDate"),
    halfDay: str(fd, "halfDay") || "none",
    reason: str(fd, "reason"),
  };
  return run(() => api("/admin/leaves/record", { method: "POST", body }), `/admin/employees/${userId}`);
}

/** Dry run for the record-leave form. Never throws. */
export async function previewRecordedLeave(userId, body) {
  try {
    return { ok: true, ...(await api("/admin/leaves/record/preview", { method: "POST", body: { reason: "preview", ...body, userId } })) };
  } catch (err) {
    return actionError(err);
  }
}

/* ------------------------------ Attendance ------------------------------ */

export async function setCheckOut(recordId, _prev, fd) {
  return run(() => api(`/admin/attendance/${recordId}/check-out`, { method: "POST", body: { time: str(fd, "time") } }), "/admin/attendance");
}

/* ------------------------------- Holidays ------------------------------- */

export async function saveHoliday(id, _prev, fd) {
  const body = { date: str(fd, "date"), name: str(fd, "name"), isOptional: fd.get("isOptional") === "on" };
  return run(
    () => (id ? api(`/holidays/${id}`, { method: "PATCH", body }) : api("/holidays", { method: "POST", body })),
    "/admin/holidays",
  );
}

export async function deleteHoliday(id) {
  return run(() => api(`/holidays/${id}`, { method: "DELETE" }), "/admin/holidays");
}

/* ------------------------------- Settings ------------------------------- */

export async function saveSettings(_prev, fd) {
  return run(
    () =>
      api("/admin/org/settings", {
        method: "PUT",
        body: {
          companyName: str(fd, "companyName"),
          geofenceMode: str(fd, "geofenceMode"),
          weekendDays: fd.getAll("weekendDays").map(Number),
        },
      }),
    "/admin/settings",
  );
}

export async function saveOffice(id, _prev, fd) {
  const body = {
    name: str(fd, "name"),
    address: str(fd, "address"),
    latitude: Number(fd.get("latitude")),
    longitude: Number(fd.get("longitude")),
    radiusMeters: Number(fd.get("radiusMeters")),
    isActive: fd.get("isActive") === "on",
  };
  return run(
    () => (id ? api(`/admin/org/offices/${id}`, { method: "PATCH", body }) : api("/admin/org/offices", { method: "POST", body })),
    "/admin/settings",
  );
}

export async function deleteOffice(id) {
  return run(() => api(`/admin/org/offices/${id}`, { method: "DELETE" }), "/admin/settings");
}

export async function saveLeaveType(id, _prev, fd) {
  const body = {
    name: str(fd, "name"),
    annualQuota: Number(fd.get("annualQuota")),
    color: str(fd, "color"),
    isActive: fd.get("isActive") === "on",
  };
  return run(() => api(`/leave-types/${id}`, { method: "PATCH", body }), "/admin/settings");
}

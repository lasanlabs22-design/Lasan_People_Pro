// Shared by server and client components. Dates arrive as YYYY-MM-DD strings.

const parse = (iso) => new Date(`${iso}T00:00:00`);

export function fmtDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  return parse(iso).toLocaleDateString("en-IN", opts);
}

export function fmtRange(start, end) {
  if (start === end) return fmtDate(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmtDate(start, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })} – ${fmtDate(end)}`;
}

export const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Kolkata";

export function fmtTime(ts, timeZone = TZ) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone });
}

// 125.4 → "2h 05m"
export function fmtMinutes(minutes) {
  const mins = Math.max(0, Math.round(minutes));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function fmtDuration(from, to) {
  if (!from || !to) return "—";
  return fmtMinutes((new Date(to) - new Date(from)) / 60000);
}

/** Calendar chip for a punch: "10:41 am–06:05 pm", "10:41 am" while in, "10:41 am–?" if never closed. */
export function punchLabel(r, today) {
  if (r.checkOutAt) return `${fmtTime(r.checkInAt)}–${fmtTime(r.checkOutAt)}`;
  return r.date < today ? `${fmtTime(r.checkInAt)}–?` : fmtTime(r.checkInAt);
}

// 850 m, 1.2 km, 1,682 km
export function fmtDistance(m) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString("en-IN")} km`;
}

export const fmtDays =(n) => `${Number(n) % 1 ? Number(n).toFixed(1) : Number(n)} ${Number(n) === 1 ? "day" : "days"}`;

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function greeting(date = new Date()) {
  const h = Number(date.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: TZ }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const STATUS_TONE = {
  pending: "amber",
  approved: "emerald",
  rejected: "rose",
  cancelled: "slate",
  active: "emerald",
  revoked: "rose",
};

export const HALF_DAY_LABEL = { none: "", first_half: "First half", second_half: "Second half" };
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

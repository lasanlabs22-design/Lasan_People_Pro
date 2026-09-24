"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { CheckCircle2, Fingerprint, Loader2, LogIn, LogOut, MapPin, Navigation, ShieldAlert } from "lucide-react";
import { punch } from "@/app/actions/employee";
import { getPosition, nearestOffice } from "@/lib/geo";
import { fmtDate, fmtDistance, fmtDuration, fmtTime, TZ } from "@/lib/format";
import { Card, cn } from "./ui";

// One-second ticking clock; null during SSR so server and client markup match.
let tick = Date.now();
const subscribeClock = (cb) => {
  const id = setInterval(() => {
    tick = Date.now();
    cb();
  }, 1000);
  return () => clearInterval(id);
};
function useNow() {
  const ms = useSyncExternalStore(subscribeClock, () => tick, () => null);
  return ms === null ? null : new Date(ms);
}

export function PunchCard({ today }) {
  const { record, geofenceMode, offices, date } = today;
  const now = useNow();
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [fix, setFix] = useState(null); // last known { latitude, longitude, accuracy }

  const state = !record ? "in" : !record.checkOutAt ? "out" : "done";
  const near = fix && offices.length ? nearestOffice(offices, fix.latitude, fix.longitude) : null;
  const inside = near && near.distance - Math.min(fix.accuracy ?? 0, 50) <= near.office.radiusMeters;

  function go() {
    setError(null);
    start(async () => {
      let position;
      if (geofenceMode !== "off") {
        try {
          position = await getPosition();
          setFix(position);
        } catch (e) {
          setError(e.message);
          return;
        }
      }
      const res = await punch(state === "in" ? "in" : "out", position);
      if (!res.ok) setError(res.error);
    });
  }

  const clock = now?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });
  const worked = record ? fmtDuration(record.checkInAt, record.checkOutAt ?? now ?? record.checkInAt) : null;

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <Radar active={state !== "done"} />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300/80">Attendance</p>
            <p className="mt-1 text-sm text-muted">{fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <GeoStatus mode={geofenceMode} offices={offices} near={near} inside={inside} />
        </div>

        <p className="mt-5 font-display text-4xl font-semibold tabular-nums tracking-tight sm:mt-6 sm:text-5xl" suppressHydrationWarning>
          {clock ?? "--:--:--"}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:mt-6 sm:gap-3">
          <Stat label="Check in" value={fmtTime(record?.checkInAt)} />
          <Stat label="Check out" value={fmtTime(record?.checkOutAt)} />
          <Stat label="Worked" value={worked ?? "—"} highlight={state === "out"} />
        </div>

        <div className="mt-6">
          {state === "done" ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 py-4 text-sm font-medium text-emerald-200">
              <CheckCircle2 className="size-5" /> You&apos;re done for today. See you tomorrow!
            </div>
          ) : (
            <button
              type="button"
              onClick={go}
              disabled={pending}
              className={cn(
                "group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl py-4 text-base font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-70",
                state === "in"
                  ? "bg-gradient-to-r from-brand-500 via-brand-600 to-cyan-600 shadow-glow hover:brightness-110"
                  : "bg-gradient-to-r from-rose-500 to-orange-500 shadow-[0_10px_40px_-10px_rgb(244_63_94/0.6)] hover:brightness-110",
              )}
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {pending ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> {geofenceMode === "off" ? "Saving…" : "Locating you…"}
                </>
              ) : state === "in" ? (
                <>
                  <LogIn className="size-5" /> Check in
                </>
              ) : (
                <>
                  <LogOut className="size-5" /> Check out
                </>
              )}
            </button>
          )}
          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          {geofenceMode !== "off" && state !== "done" && !error && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-subtle">
              <Fingerprint className="size-3.5" /> Your location is checked only when you punch.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3">
      <p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p>
      <p className={cn("mt-1 font-display text-base font-semibold tabular-nums", highlight && "text-brand-300")} suppressHydrationWarning>
        {value}
      </p>
    </div>
  );
}

function GeoStatus({ mode, offices, near, inside }) {
  if (mode === "off")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted">
        <Navigation className="size-3" /> Location not required
      </span>
    );
  if (!near)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted">
        <MapPin className="size-3" /> {offices.length ? `${offices.length} office${offices.length > 1 ? "s" : ""} geofenced` : "Geofence ready"}
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        inside ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300",
      )}
    >
      <MapPin className="size-3" /> {inside ? `At ${near.office.name}` : `${fmtDistance(near.distance)} from ${near.office.name}`}
    </span>
  );
}

function Radar({ active }) {
  return (
    <div className="pointer-events-none absolute -right-[168px] -top-6 size-72" aria-hidden>
      <div className="absolute inset-0 rounded-full border border-brand-400/15" />
      <div className="absolute inset-10 rounded-full border border-brand-400/15" />
      <div className="absolute inset-20 rounded-full border border-brand-400/20" />
      {active && (
        <>
          <div className="absolute inset-24 rounded-full bg-brand-500/30 animate-pulse-ring" />
          <div className="absolute inset-24 rounded-full bg-brand-500/20 animate-pulse-ring [animation-delay:1.1s]" />
        </>
      )}
      <div className="absolute inset-[132px] rounded-full bg-brand-400 shadow-[0_0_20px_rgb(154_130_255)]" />
    </div>
  );
}

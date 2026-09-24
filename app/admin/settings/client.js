"use client";

import { useState } from "react";
import { Building2, CalendarRange, Crosshair, Loader2, MapPin, Plus, Settings2, Trash2 } from "lucide-react";
import { deleteOffice, saveLeaveType, saveOffice, saveSettings } from "@/app/actions/admin";
import { ActionButton, Modal, SubmitButton, useFormAction } from "@/components/client";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, cn } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MODES = [
  { value: "enforce", title: "Enforce", text: "Check-in only works inside an office geofence." },
  { value: "record", title: "Record only", text: "Allow anywhere, but flag punches outside the fence." },
  { value: "off", title: "Off", text: "Don't ask for location. Good for fully remote teams." },
];

export function GeneralSettings({ settings }) {
  const [state, onSubmit, pending] = useFormAction(saveSettings);
  return (
    <Card>
      <CardHeader title="General" subtitle="Applies to everyone" icon={Settings2} />
      <form onSubmit={onSubmit} className="space-y-5 p-5">
        <Alert>{state?.error}</Alert>
        {state?.ok && <Alert tone="emerald">Settings saved.</Alert>}
        <Field label="Company name" name="companyName">
          <Input name="companyName" defaultValue={settings.companyName} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Geofence for check-in</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <label
                key={m.value}
                className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition-colors has-[:checked]:border-brand-400/60 has-[:checked]:bg-brand-500/10"
              >
                <input type="radio" name="geofenceMode" value={m.value} defaultChecked={settings.geofenceMode === m.value} className="sr-only" />
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{m.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Weekly off days</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <label
                key={d}
                className="cursor-pointer rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm text-muted transition-colors has-[:checked]:border-brand-400/60 has-[:checked]:bg-brand-500/15 has-[:checked]:text-fg"
              >
                <input type="checkbox" name="weekendDays" value={i} defaultChecked={settings.weekendDays.includes(i)} className="sr-only" />
                {d}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">Off days are excluded when counting leave (except calendar-day leave like maternity).</p>
        </fieldset>
        <SubmitButton pending={pending}>Save settings</SubmitButton>
      </form>
    </Card>
  );
}

export function LeavePolicy({ leaveTypes }) {
  return (
    <Card>
      <CardHeader title="Leave policy" subtitle="Annual quota per employee" icon={CalendarRange} />
      <div className="divide-y divide-white/[0.05] p-2">
        {leaveTypes.map((t) => (
          <LeaveTypeRow key={t.id} type={t} />
        ))}
      </div>
      <p className="px-5 pb-5 text-xs text-subtle">
        Change a quota here to update it for everyone. For one person, use “Adjust quota” on their profile.
      </p>
    </Card>
  );
}

function LeaveTypeRow({ type }) {
  const [state, onSubmit, pending] = useFormAction(saveLeaveType.bind(null, type.id));
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
      <input type="color" name="color" defaultValue={type.color} className="size-8 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5" aria-label="Colour" />
      <div className="min-w-0 flex-1 basis-40">
        <input name="name" defaultValue={type.name} className="w-full bg-transparent text-sm font-medium outline-none focus:text-brand-50" aria-label="Name" />
        <p className="text-xs text-muted">
          {type.eligibleGender !== "any" && <span className="capitalize">{type.eligibleGender} only · </span>}
          {type.countsCalendarDays ? "Calendar days" : "Working days"}
          {!type.allowHalfDay && " · No half days"}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input name="annualQuota" type="number" step="0.5" min="0" max="366" defaultValue={type.annualQuota} className="field h-9 w-20 py-1 text-right tabular-nums" aria-label="Annual quota" />
          days
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" name="isActive" defaultChecked={type.isActive} className="size-4 accent-brand-500" /> Active
        </label>
        <SubmitButton pending={pending} size="sm" variant="secondary">
          Save
        </SubmitButton>
      </div>
      {state?.error && <p className="w-full text-xs text-rose-300">{state.error}</p>}
      {state?.ok && !pending && <p className="w-full text-xs text-emerald-300">Saved</p>}
    </form>
  );
}

export function Offices({ offices, geofenceMode }) {
  const [editing, setEditing] = useState(null); // {} for new, office for edit
  return (
    <Card>
      <CardHeader
        title="Office locations"
        subtitle="Employees must be within the radius to check in when geofencing is enforced."
        icon={Building2}
        action={
          <Button size="sm" onClick={() => setEditing({})}>
            <Plus className="size-3.5" /> Add office
          </Button>
        }
      />
      {geofenceMode === "enforce" && offices.filter((o) => o.isActive).length === 0 && (
        <Alert tone="amber" className="mx-5 mt-4">
          Geofencing is set to enforce, but no active office exists yet — check-ins are currently allowed from anywhere.
        </Alert>
      )}
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {offices.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState icon={MapPin} title="No offices yet" description="Add your office and stand inside it to capture the exact coordinates." />
          </div>
        )}
        {offices.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setEditing(o)}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition-colors hover:border-brand-400/40"
          >
            <GeofenceGlyph />
            <div className="relative">
              <div className="flex items-center gap-2">
                <p className="font-medium">{o.name}</p>
                {!o.isActive && <Badge>Inactive</Badge>}
              </div>
              {o.address && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{o.address}</p>}
              <p className="mt-3 font-mono text-[11px] text-subtle">
                {o.latitude.toFixed(5)}, {o.longitude.toFixed(5)}
              </p>
              <Badge tone="brand" className="mt-2">
                {o.radiusMeters} m radius
              </Badge>
            </div>
          </button>
        ))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit office" : "Add office"}>
        {editing && <OfficeForm office={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function GeofenceGlyph() {
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute -right-6 -top-6 size-28 text-brand-400/20 transition-colors group-hover:text-brand-400/35" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeDasharray="4 4" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" />
      <circle cx="50" cy="50" r="5" fill="currentColor" />
    </svg>
  );
}

function OfficeForm({ office, onDone }) {
  const [coords, setCoords] = useState({ lat: office.latitude ?? "", lng: office.longitude ?? "" });
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await saveOffice(office.id ?? null, prev, fd);
    if (res.ok) onDone();
    return res;
  });
  const f = state?.fields ?? {};

  function locate() {
    if (!navigator.geolocation) return setGeoError("This browser doesn't support location.");
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) });
        setLocating(false);
      },
      (e) => {
        setGeoError(e.code === 1 ? "Location permission was denied." : "Couldn't get your location. Try again outdoors or near a window.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Field label="Name" name="name" error={f.name}>
        <Input name="name" required defaultValue={office.name} placeholder="Head office" error={f.name} />
      </Field>
      <Field label="Address" name="address" hint="Optional">
        <Input name="address" defaultValue={office.address ?? ""} placeholder="Street, city" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" name="latitude" error={f.latitude}>
          <Input name="latitude" required inputMode="decimal" value={coords.lat} onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))} error={f.latitude} />
        </Field>
        <Field label="Longitude" name="longitude" error={f.longitude}>
          <Input name="longitude" required inputMode="decimal" value={coords.lng} onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))} error={f.longitude} />
        </Field>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={locate} disabled={locating}>
        {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
        Use my current location
      </Button>
      {geoError && <p className="text-xs text-rose-300">{geoError}</p>}
      <Field label="Radius (metres)" name="radiusMeters" error={f.radiusMeters} hint="100–200 m suits most offices">
        <Input name="radiusMeters" type="number" min="20" max="5000" required defaultValue={office.radiusMeters ?? 150} error={f.radiusMeters} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={office.isActive ?? true} className="size-4 accent-brand-500" /> Active
      </label>
      <div className={cn("flex gap-2")}>
        <SubmitButton pending={pending} className="flex-1" pendingText="Saving…">
          {office.id ? "Save office" : "Add office"}
        </SubmitButton>
        {office.id && (
          <ActionButton
            variant="danger"
            action={deleteOffice.bind(null, office.id)}
            confirmText={`Delete ${office.name}?`}
            onDone={onDone}
            aria-label={`Delete ${office.name}`}
            title="Delete office"
          >
            <Trash2 className="size-4" />
          </ActionButton>
        )}
      </div>
    </form>
  );
}

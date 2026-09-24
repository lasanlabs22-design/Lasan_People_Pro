"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Droplet, HeartPulse, Loader2, Trash2, UserRound } from "lucide-react";
import { saveAvatar, saveProfile } from "@/app/actions/employee";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Avatar, Card, CardHeader, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { BLOOD_GROUPS } from "@/lib/format";

const AVATAR_PX = 320;

/** Center-crops to a square and re-encodes small enough to store inline. */
async function toAvatarDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  bitmap.close?.();
  for (const q of [0.85, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < 150_000) return url;
  }
  throw new Error("That image is too detailed to compress. Try a different photo.");
}

export function AvatarUploader({ name, avatar }) {
  const input = useRef(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const upload = (file) => {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError("Use a PNG, JPG or WEBP image.");
    if (file.size > 10 * 1024 * 1024) return setError("Pick an image under 10 MB.");
    start(async () => {
      try {
        const dataUrl = await toAvatarDataUrl(file);
        setPreview(dataUrl);
        const res = await saveAvatar(dataUrl);
        if (!res.ok) {
          setPreview(null);
          setError(res.error);
        }
      } catch (e) {
        setError(e.message);
      }
    });
  };

  const shown = preview ?? avatar;
  return (
    <div className="flex flex-col items-center">
      <div className="group relative">
        <div className="rounded-full bg-gradient-to-br from-brand-400 via-cyan-glow to-pink-400 p-[3px]">
          <div className="rounded-full bg-ink-900 p-1">
            <Avatar src={shown} name={name} size={120} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Change photo"
        >
          {pending ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <div className="mt-3 flex gap-3 text-xs">
        <button type="button" onClick={() => input.current?.click()} className="text-brand-300 hover:text-brand-50">
          {shown ? "Change photo" : "Upload photo"}
        </button>
        {shown && (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                const res = await saveAvatar(null);
                if (res.ok) setPreview(null);
                else setError(res.error);
              })
            }
            className="inline-flex items-center gap-1 text-subtle hover:text-rose-300"
          >
            <Trash2 className="size-3" /> Remove
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

export function ProfileForm({ profile }) {
  const [state, onSubmit, pending] = useFormAction(saveProfile);
  const f = state?.fields ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Alert>{state?.error}</Alert>
      {state?.ok && <Alert tone="emerald">Profile saved.</Alert>}

      <Card>
        <CardHeader title="Personal details" icon={UserRound} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Phone" name="phone" error={f.phone}>
            <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} placeholder="+91 98765 43210" error={f.phone} />
          </Field>
          <Field label="Date of birth" name="dateOfBirth" error={f.dateOfBirth}>
            <Input name="dateOfBirth" type="date" defaultValue={profile.dateOfBirth ?? ""} error={f.dateOfBirth} />
          </Field>
          <Field label="Address" name="address" error={f.address} className="sm:col-span-2">
            <Textarea name="address" defaultValue={profile.address ?? ""} placeholder="House, street, city, PIN" className="min-h-20" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Blood group" subtitle="Helps in a medical emergency" icon={Droplet} />
        <fieldset className="flex flex-wrap gap-2 p-5">
          <legend className="sr-only">Blood group</legend>
          {BLOOD_GROUPS.map((g) => (
            <label
              key={g}
              className={cn(
                "grid h-11 w-14 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.02] font-display font-semibold text-muted transition-all",
                "hover:border-white/20 has-[:checked]:border-rose-400/60 has-[:checked]:bg-rose-500/15 has-[:checked]:text-rose-200 has-[:checked]:shadow-[0_0_20px_-4px_rgb(244_63_94/0.5)]",
              )}
            >
              <input type="radio" name="bloodGroup" value={g} defaultChecked={profile.bloodGroup === g} className="sr-only" />
              {g}
            </label>
          ))}
          {f.bloodGroup && <p className="w-full text-xs text-rose-300">{f.bloodGroup}</p>}
        </fieldset>
      </Card>

      <Card className="border-rose-500/15">
        <CardHeader title="Emergency contact" subtitle="Who should we call if something happens?" icon={HeartPulse} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name" name="emergencyContactName" error={f.emergencyContactName}>
            <Input name="emergencyContactName" defaultValue={profile.emergencyContactName ?? ""} placeholder="Full name" />
          </Field>
          <Field label="Relationship" name="emergencyContactRelation" error={f.emergencyContactRelation}>
            <Select name="emergencyContactRelation" defaultValue={profile.emergencyContactRelation ?? ""}>
              <option value="">Select…</option>
              {["Spouse", "Parent", "Father", "Mother", "Sibling", "Child", "Friend", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Phone" name="emergencyContactPhone" error={f.emergencyContactPhone} className="sm:col-span-2">
            <Input name="emergencyContactPhone" type="tel" defaultValue={profile.emergencyContactPhone ?? ""} placeholder="+91 …" error={f.emergencyContactPhone} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton pending={pending} size="lg" pendingText="Saving…">
          Save profile
        </SubmitButton>
      </div>
    </form>
  );
}

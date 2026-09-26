"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Pause, Play, ShieldMinus, ShieldPlus, UserPlus } from "lucide-react";
import { addStaff, dismissPasswordRequest, resetStaffPassword, setStaffActive, setStaffRole } from "@/app/actions/platform";
import { ActionButton, Modal, SubmitButton, useFormAction } from "@/components/client";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";
import { TZ } from "@/lib/format";

const ROLE_CHOICES = [
  { value: "staff", title: "Staff", text: "Sets up and manages workspaces. Can't see the team." },
  { value: "admin", title: "Admin", text: "Also manages the team and gives out temporary passwords." },
];

/** A one-time console login to hand to a colleague. */
function StaffCredentials({ name, email, password }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/platform/login`;
  const text = `Hi ${name.split(" ")[0]}, here is your Lasan platform console login.\nSign in at: ${url}\nEmail: ${email}\nTemporary password: ${password}\nYou'll be asked to set your own password when you first sign in.`;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-emerald-200">
          <KeyRound className="size-4" /> Console login for {name}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Sign in at</dt>
          <dd className="break-all font-mono text-xs leading-5">{url}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="font-mono">{email}</dd>
          <dt className="text-muted">Temporary password</dt>
          <dd className="font-mono text-base tracking-wider text-fg">{password}</dd>
        </dl>
      </div>
      <Alert tone="amber">This password is shown only once. Share it securely — they&apos;ll replace it on first sign-in.</Alert>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy login message"}
      </Button>
    </div>
  );
}

function PasswordFields({ f }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Temporary password" name="password" error={f.password}>
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" error={f.password} />
        </Field>
        <Field label="Confirm password" name="confirmPassword" error={f.confirmPassword}>
          <Input name="confirmPassword" type="password" required autoComplete="new-password" error={f.confirmPassword} />
        </Field>
      </div>
      <p className="text-xs text-subtle">At least 8 characters with a letter and a number. They replace it the first time they sign in.</p>
    </>
  );
}

export function AddStaff() {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const close = () => {
    setOpen(false);
    setAdded(null);
    setFormKey((k) => k + 1);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Add to team
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={added ? `${added.member.name} added as ${added.member.role}` : "Add someone to the Lasan team"}
        description={added ? "Send them this login." : "They sign in to this console with their email."}
      >
        {added ? (
          <div className="space-y-4">
            <StaffCredentials name={added.member.name} email={added.member.email} password={added.password} />
            <Button variant="ghost" className="w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <AddStaffForm key={formKey} onAdded={setAdded} />
        )}
      </Modal>
    </>
  );
}

function AddStaffForm({ onAdded }) {
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await addStaff(prev, fd);
    if (res.ok) onAdded(res);
    return res;
  });
  const f = state?.fields ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <Alert>{state?.error}</Alert>
      <Field label="Full name" name="name" error={f.name}>
        <Input name="name" required error={f.name} />
      </Field>
      <Field label="Email" name="email" error={f.email} hint="They sign in with this">
        <Input name="email" type="email" required error={f.email} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">Role</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_CHOICES.map((r) => (
            <label
              key={r.value}
              className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition-colors has-[:checked]:border-brand-400/60 has-[:checked]:bg-brand-500/10"
            >
              <input type="radio" name="role" value={r.value} defaultChecked={r.value === "staff"} className="sr-only" />
              <span className="block text-sm font-medium">{r.title}</span>
              <span className="mt-0.5 block text-xs text-muted">{r.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <PasswordFields f={f} />
      <SubmitButton pending={pending} size="lg" className="w-full" pendingText="Adding…">
        Add to the team
      </SubmitButton>
    </form>
  );
}

export function StaffActions({ member }) {
  const [resetOpen, setResetOpen] = useState(false);
  const admin = member.role === "admin";
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {member.active && (
        <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
          <KeyRound className="size-3.5" /> Temporary password
        </Button>
      )}
      {member.active && (
        <ActionButton
          variant="secondary"
          size="sm"
          action={setStaffRole.bind(null, member.id, admin ? "staff" : "admin")}
          confirmText={
            admin
              ? `Make ${member.name} staff? They'll no longer see or manage the team.`
              : `Make ${member.name} an admin? They'll be able to manage the team and give out temporary passwords.`
          }
        >
          {admin ? <ShieldMinus className="size-3.5" /> : <ShieldPlus className="size-3.5" />} {admin ? "Make staff" : "Make admin"}
        </ActionButton>
      )}
      {member.active ? (
        <ActionButton
          variant="danger"
          size="sm"
          action={setStaffActive.bind(null, member.id, false)}
          confirmText={`Deactivate ${member.name}? They're signed out at once and can't sign in to the console.`}
        >
          <Pause className="size-3.5" /> Deactivate
        </ActionButton>
      ) : (
        <ActionButton variant="success" size="sm" action={setStaffActive.bind(null, member.id, true)}>
          <Play className="size-3.5" /> Reactivate
        </ActionButton>
      )}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={`Temporary password for ${member.name}`}>
        {resetOpen && <ResetPassword member={member} onDone={() => setResetOpen(false)} />}
      </Modal>
    </div>
  );
}

function ResetPassword({ member, onDone }) {
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    if (fd.get("password") !== fd.get("confirmPassword")) {
      return { ok: false, error: "Passwords don't match", fields: { confirmPassword: "Doesn't match the password" } };
    }
    return resetStaffPassword(member.id, prev, fd);
  });
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <StaffCredentials name={member.name} email={member.email} password={state.password} />
        <Button variant="ghost" className="w-full" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }
  const f = state?.fields ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left" autoComplete="off">
      <Alert>{state?.error}</Alert>
      <p className="text-sm text-muted">They&apos;re signed out everywhere and must choose a new password with this one.</p>
      <PasswordFields f={f} />
      <SubmitButton pending={pending} className="w-full" pendingText="Saving…">
        Set temporary password
      </SubmitButton>
    </form>
  );
}

/** People who forgot their password and asked this admin for a temporary one. */
export function PasswordRequests({ requests }) {
  const [answering, setAnswering] = useState(null);
  return (
    <>
      <ul className="mt-3 divide-y divide-white/[0.05]">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {r.name} <Badge tone={r.role === "admin" ? "amber" : "slate"}>{r.role}</Badge>
              </p>
              <p className="text-xs text-muted">
                {r.email} · asked {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TZ })}
              </p>
            </div>
            <Button size="sm" onClick={() => setAnswering(r)}>
              <KeyRound className="size-3.5" /> Give temporary password
            </Button>
            <ActionButton variant="ghost" size="sm" action={dismissPasswordRequest.bind(null, r.id)} confirmText={`Dismiss ${r.name}'s request?`}>
              Dismiss
            </ActionButton>
          </li>
        ))}
      </ul>
      <div className="h-2" />
      <Modal open={!!answering} onClose={() => setAnswering(null)} title={answering ? `Temporary password for ${answering.name}` : ""}>
        {answering && (
          <ResetPassword
            member={{ id: answering.requesterId, name: answering.name, email: answering.email }}
            onDone={() => setAnswering(null)}
          />
        )}
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Pause, Play, UserPlus } from "lucide-react";
import { addStaff, resetStaffPassword, setStaffActive } from "@/app/actions/platform";
import { ActionButton, Modal, SubmitButton, useFormAction } from "@/components/client";
import { Alert, Button, Field, Input } from "@/components/ui";

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
        <UserPlus className="size-4" /> Add staff member
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={added ? "Staff member added" : "Add a Lasan staff member"}
        description={added ? "Send them this login." : "They'll be able to create and manage workspaces, and manage this team."}
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
      <PasswordFields f={f} />
      <SubmitButton pending={pending} size="lg" className="w-full" pendingText="Adding…">
        Add staff member
      </SubmitButton>
    </form>
  );
}

export function StaffActions({ member }) {
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {member.active && (
        <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
          <KeyRound className="size-3.5" /> Reset password
        </Button>
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
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={`Reset ${member.name}'s password`}>
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
      <SubmitButton pending={pending} className="w-full" pendingText="Resetting…">
        Reset password
      </SubmitButton>
    </form>
  );
}

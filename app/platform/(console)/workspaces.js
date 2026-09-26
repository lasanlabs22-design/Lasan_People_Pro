"use client";

import { useState } from "react";
import { ArrowRight, Pause, Play, Plus } from "lucide-react";
import { createWorkspace, setWorkspaceStatus } from "@/app/actions/platform";
import { ActionButton, Modal, SubmitButton, useFormAction } from "@/components/client";
import { CredentialsCard } from "@/components/credentials";
import { Alert, Button, Field, Input } from "@/components/ui";

// "Acme Tools Pvt. Ltd." → "acme-tools-pvt-ltd"
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function CreateWorkspace() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(null);
  // Remount the form each time so a previous company's details never linger.
  const [formKey, setFormKey] = useState(0);
  const close = () => {
    setOpen(false);
    setCreated(null);
    setFormKey((k) => k + 1);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Create workspace
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={created ? "Workspace created" : "Create a workspace"}
        description={created ? `${created.workspace.name} is ready. Send this login to its admin.` : "For a company that's signed up with Lasan."}
      >
        {created ? (
          <div className="space-y-4">
            <CredentialsCard
              name={created.admin.name}
              workspace={created.workspace.slug}
              loginId={created.admin.employeeCode}
              password={created.password}
            />
            <Button variant="ghost" className="w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <WorkspaceForm key={formKey} onCreated={setCreated} />
        )}
      </Modal>
    </>
  );
}

function WorkspaceForm({ onCreated }) {
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await createWorkspace(prev, fd);
    if (res.ok) onCreated(res);
    return res;
  });
  const [company, setCompany] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const f = state?.fields ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <Alert>{state?.error}</Alert>
      <Field label="Company name" name="companyName" error={f.companyName}>
        <Input
          name="companyName"
          required
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          placeholder="Acme Tools"
          error={f.companyName}
        />
      </Field>
      <Field label="Workspace name" name="workspace" error={f.workspace} hint="Their team types this to sign in">
        <Input
          name="workspace"
          required
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(e.target.value.toLowerCase());
          }}
          pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
          title="3–40 lowercase letters, numbers or hyphens"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="acme-tools"
          className="font-mono"
          error={f.workspace}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Admin's full name" name="name" error={f.name}>
          <Input name="name" required error={f.name} />
        </Field>
        <Field label="Admin's employee ID" name="employeeCode" error={f.employeeCode} hint="Optional">
          <Input name="employeeCode" placeholder="ADMIN" className="uppercase" error={f.employeeCode} />
        </Field>
      </div>
      <Field label="Admin's work email" name="email" error={f.email}>
        <Input name="email" type="email" required error={f.email} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" name="password" error={f.password}>
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" error={f.password} />
        </Field>
        <Field label="Confirm password" name="confirmPassword" error={f.confirmPassword}>
          <Input name="confirmPassword" type="password" required autoComplete="new-password" error={f.confirmPassword} />
        </Field>
      </div>
      <p className="text-xs text-subtle">
        At least 8 characters with a letter and a number. The admin is asked to replace it the first time they sign in.
      </p>
      <SubmitButton pending={pending} size="lg" className="w-full" pendingText="Creating workspace…">
        Create workspace <ArrowRight className="size-4" />
      </SubmitButton>
    </form>
  );
}

export function WorkspaceStatusButton({ workspace }) {
  const active = workspace.status === "active";
  return active ? (
    <ActionButton
      variant="danger"
      size="sm"
      action={setWorkspaceStatus.bind(null, workspace.id, "suspended")}
      confirmText={`Suspend ${workspace.name}? Everyone in it loses access until you reactivate it.`}
    >
      <Pause className="size-3.5" /> Suspend
    </ActionButton>
  ) : (
    <ActionButton variant="success" size="sm" action={setWorkspaceStatus.bind(null, workspace.id, "active")}>
      <Play className="size-3.5" /> Reactivate
    </ActionButton>
  );
}

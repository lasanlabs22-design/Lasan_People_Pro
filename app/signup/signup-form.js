"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { register } from "@/app/actions/auth";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field, Input } from "@/components/ui";

// "Acme Tools Pvt. Ltd." → "acme-tools-pvt-ltd"
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function SignupForm() {
  const [state, onSubmit, pending] = useFormAction(register);
  const [company, setCompany] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const f = state?.fields ?? {};

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <Alert>{state?.error}</Alert>

      <Field label="Company name" name="companyName" error={f.companyName}>
        <Input
          name="companyName"
          required
          autoFocus
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          placeholder="Acme Tools"
          error={f.companyName}
        />
      </Field>

      <Field label="Workspace name" name="workspace" error={f.workspace} hint="Your team types this to sign in">
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your full name" name="name" error={f.name}>
          <Input name="name" required autoComplete="name" error={f.name} />
        </Field>
        <Field label="Your employee ID" name="employeeCode" error={f.employeeCode} hint="Optional">
          <Input name="employeeCode" placeholder="ADMIN" className="uppercase" error={f.employeeCode} />
        </Field>
      </div>

      <Field label="Work email" name="email" error={f.email}>
        <Input name="email" type="email" required autoComplete="email" error={f.email} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Password" name="password" error={f.password} hint="8+ chars, a letter and a number">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" error={f.password} />
        </Field>
        <Field label="Confirm password" name="confirmPassword" error={f.confirmPassword}>
          <Input name="confirmPassword" type="password" required autoComplete="new-password" error={f.confirmPassword} />
        </Field>
      </div>

      <SubmitButton pending={pending} size="lg" className="w-full" pendingText="Creating workspace…">
        Create workspace <ArrowRight className="size-4" />
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have one?{" "}
        <a href="/login" className="font-medium text-brand-300 hover:text-brand-200">
          Sign in
        </a>
      </p>
    </form>
  );
}

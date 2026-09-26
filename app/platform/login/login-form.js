"use client";

import { ArrowRight } from "lucide-react";
import { platformLogin } from "@/app/actions/platform";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field, Input } from "@/components/ui";

export function PlatformLoginForm() {
  const [state, onSubmit, pending] = useFormAction(platformLogin);
  const f = state?.fields ?? {};
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <Alert>{state?.error}</Alert>
      <Field label="Email" name="email" error={f.email}>
        <Input name="email" type="email" required autoFocus autoComplete="username" error={f.email} />
      </Field>
      <Field label="Password" name="password" error={f.password}>
        <Input name="password" type="password" required autoComplete="current-password" error={f.password} />
      </Field>
      <SubmitButton pending={pending} size="lg" className="w-full" pendingText="Signing in…">
        Sign in <ArrowRight className="size-4" />
      </SubmitButton>
    </form>
  );
}

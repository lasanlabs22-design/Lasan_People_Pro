"use client";

import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { requestPlatformPasswordReset } from "@/app/actions/platform";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field, Input, LinkButton } from "@/components/ui";

export function ForgotForm() {
  const [state, onSubmit, pending] = useFormAction(requestPlatformPasswordReset);
  const f = state?.fields ?? {};

  if (state?.ok) {
    return (
      <div className="mt-8 space-y-5">
        <Alert tone="emerald" className="flex gap-3">
          <MailCheck className="mt-0.5 size-4 shrink-0" />
          <span>
            Request sent. If <b>{state.adminEmail}</b> is a Lasan admin and your email has an account, they&apos;ll see your
            request in the console. Ask them for your temporary password.
          </span>
        </Alert>
        <LinkButton href="/platform/login" variant="secondary" className="w-full">
          <ArrowLeft className="size-4" /> Back to sign in
        </LinkButton>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <Alert>{state?.error}</Alert>
      <Field label="Your email" name="email" error={f.email}>
        <Input name="email" type="email" required autoFocus autoComplete="username" error={f.email} />
      </Field>
      <Field label="Admin to ask" name="adminEmail" error={f.adminEmail} hint="Their email address">
        <Input name="adminEmail" type="email" required autoComplete="off" placeholder="admin@lasan.in" error={f.adminEmail} />
      </Field>
      <SubmitButton pending={pending} size="lg" className="w-full" pendingText="Sending…">
        <Send className="size-4" /> Ask for a temporary password
      </SubmitButton>
      <a href="/platform/login" className="block text-center text-sm text-muted hover:text-fg">
        Back to sign in
      </a>
    </form>
  );
}

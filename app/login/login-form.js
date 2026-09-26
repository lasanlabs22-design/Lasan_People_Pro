"use client";

import { useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { login } from "@/app/actions/auth";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field } from "@/components/ui";

export function LoginForm({ next, workspace }) {
  const [state, onSubmit, pending] = useFormAction(login);
  const [show, setShow] = useState(false);

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <Alert>{state?.error}</Alert>

      <Field label="Workspace" name="workspace" error={state?.fields?.workspace}>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            id="workspace"
            name="workspace"
            required
            defaultValue={workspace}
            autoComplete="organization"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={!workspace}
            placeholder="your-company"
            className="field pl-10 lowercase"
          />
        </div>
      </Field>

      <Field label="Employee ID or email" name="identifier" error={state?.fields?.identifier}>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            id="identifier"
            name="identifier"
            required
            autoComplete="username"
            autoFocus={Boolean(workspace)}
            placeholder="LS001 or you@company.com"
            className="field pl-10"
          />
        </div>
      </Field>

      <Field label="Password" name="password" error={state?.fields?.password}>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="field px-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle hover:text-fg"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <SubmitButton pending={pending} size="lg" className="w-full" pendingText="Signing in…">
        Sign in <ArrowRight className="size-4" />
      </SubmitButton>
      <p className="text-center text-xs text-subtle">Forgot your password? Ask your admin to reset it.</p>
      <p className="text-center text-sm text-muted">New company? Contact Lasan to have your workspace set up.</p>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { changePassword } from "@/app/actions/auth";
import { SubmitButton, useFormAction } from "./client";
import { Alert, Field, Input, LinkButton, cn } from "./ui";

const RULES = [
  { test: (v) => v.length >= 8, label: "8+ characters" },
  { test: (v) => /[A-Za-z]/.test(v), label: "A letter" },
  { test: (v) => /\d/.test(v), label: "A number" },
];

/** `action` defaults to a workspace user's own password; the platform console passes its own. */
export function ChangePasswordForm({ cancelHref, action = changePassword }) {
  const [state, onSubmit, pending] = useFormAction(action);
  const [pw, setPw] = useState("");
  const f = state?.fields ?? {};

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Alert>{state?.error}</Alert>
      <Field label="Current / temporary password" name="currentPassword" error={f.currentPassword}>
        <Input name="currentPassword" type="password" required autoComplete="current-password" error={f.currentPassword} />
      </Field>
      <Field label="New password" name="newPassword" error={f.newPassword}>
        <Input
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          error={f.newPassword}
        />
      </Field>
      <ul className="flex flex-wrap gap-2">
        {RULES.map((r) => {
          const ok = r.test(pw);
          return (
            <li
              key={r.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-subtle",
              )}
            >
              <Check className="size-3" /> {r.label}
            </li>
          );
        })}
      </ul>
      <Field label="Confirm new password" name="confirmPassword" error={f.confirmPassword}>
        <Input name="confirmPassword" type="password" required autoComplete="new-password" error={f.confirmPassword} />
      </Field>
      <div className="flex gap-2 pt-2">
        <SubmitButton pending={pending} className="flex-1" pendingText="Saving…" disabled={!RULES.every((r) => r.test(pw))}>
          Save password
        </SubmitButton>
        {cancelHref && (
          <LinkButton href={cancelHref} variant="secondary">
            Cancel
          </LinkButton>
        )}
      </div>
    </form>
  );
}

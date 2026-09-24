"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Alert, Button } from "./ui";

/** Shows a one-time login for the admin to hand over. */
export function CredentialsCard({ name, workspace, loginId, password }) {
  const [copied, setCopied] = useState(false);
  const signInUrl = typeof window === "undefined" ? "" : `${window.location.origin}/login?workspace=${workspace}`;
  const text = `Hi ${name.split(" ")[0]}, here is your Lasan People login.\nSign in at: ${signInUrl}\nWorkspace: ${workspace}\nID: ${loginId}\nTemporary password: ${password}\nYou'll be asked to set your own password when you first sign in.`;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-emerald-200">
          <KeyRound className="size-4" /> Login for {name}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Workspace</dt>
          <dd className="font-mono">{workspace}</dd>
          <dt className="text-muted">Login ID</dt>
          <dd className="font-mono">{loginId}</dd>
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

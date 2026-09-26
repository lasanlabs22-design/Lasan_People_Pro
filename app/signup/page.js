import { connection } from "next/server";
import { Building2 } from "lucide-react";
import { Logo } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { LinkButton } from "@/components/ui";
import { publicSignupEnabled } from "@/server/env";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create a workspace" };

export default async function SignupPage() {
  // Decided per request, so flipping ALLOW_PUBLIC_SIGNUP doesn't need a rebuild.
  await connection();
  const open = publicSignupEnabled();
  return (
    <main className="flex min-h-dvh flex-col px-5">
      <div className="m-auto w-full max-w-lg animate-fade-up py-12">
        <Logo className="mb-10" />
        {open ? (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Create your workspace</h1>
            <p className="mt-2 text-sm text-muted">
              One workspace per company. You&apos;ll be its first admin; your team&apos;s data stays private to it.
            </p>
            <SignupForm />
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-brand-300">
              <Building2 className="size-5" />
            </span>
            <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Workspaces are set up by Lasan</h1>
            <p className="mt-2 text-sm text-muted">
              To bring your company onto Lasan People Pro, get in touch with the Lasan team. We&apos;ll create your workspace
              and send your admin login. Already have one? Sign in with the details you were given.
            </p>
            <LinkButton href="/login" className="mt-8">
              Go to sign in
            </LinkButton>
          </>
        )}
      </div>
      <PoweredBy />
    </main>
  );
}

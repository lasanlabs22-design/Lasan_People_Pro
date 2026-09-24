import { Logo } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create a workspace" };

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh flex-col px-5">
      <div className="m-auto w-full max-w-lg animate-fade-up py-12">
        <Logo className="mb-10" />
        <h1 className="font-display text-3xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-2 text-sm text-muted">
          One workspace per company. You&apos;ll be its first admin; your team&apos;s data stays private to it.
        </p>
        <SignupForm />
      </div>
      <PoweredBy />
    </main>
  );
}

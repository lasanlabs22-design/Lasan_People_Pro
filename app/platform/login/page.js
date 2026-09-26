import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { PlatformLoginForm } from "./login-form";

export const metadata = { title: "Platform sign in" };

export default function PlatformLoginPage() {
  return (
    <main className="flex min-h-dvh flex-col px-5">
      <div className="m-auto w-full max-w-sm animate-fade-up py-12">
        <Logo className="mb-10" />
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
            <ShieldCheck className="size-3.5" /> Lasan staff only
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Platform console</h1>
        <p className="mt-2 text-sm text-muted">Create and manage customer workspaces. Company admins and employees sign in at the regular sign-in page.</p>
        <PlatformLoginForm />
      </div>
      <PoweredBy />
    </main>
  );
}

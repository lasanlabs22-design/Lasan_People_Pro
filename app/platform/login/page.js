import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlatformLoginForm } from "./login-form";

export const metadata = { title: "Platform sign in" };

export default function PlatformLoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col px-5">
      <ThemeToggle withLabel className="absolute right-5 top-5" />
      <div className="glass m-auto w-full max-w-md rounded-md px-6 py-10 sm:px-10">
        <Logo className="mb-8" />
        <div>
          <span className="inline-flex items-center gap-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
            <ShieldCheck className="size-3.5" /> Lasan staff only
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Platform console</h1>
        <p className="mt-2 text-sm text-muted">Create and manage customer workspaces. Company admins and employees sign in at the regular sign-in page.</p>
        <PlatformLoginForm />
      </div>
      <PoweredBy />
    </main>
  );
}

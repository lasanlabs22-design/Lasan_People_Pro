import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { Alert } from "@/components/ui";
import { api } from "@/lib/api";
import { PoweredBy } from "@/components/powered-by";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";
import { SignInShowcase } from "./showcase";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
  const { next, reason, workspace } = await searchParams;
  // Only a login link from an admin (…/login?workspace=acme) fills in the workspace; otherwise it starts empty.
  const prefill = typeof workspace === "string" ? workspace.toLowerCase() : "";
  // Arriving from a company's link, greet it by name. The lookup is public and says nothing more.
  const company = prefill ? (await api(`/auth/workspace/${encodeURIComponent(prefill)}`, { token: null }).catch(() => null))?.workspace : null;
  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="absolute inset-x-0 top-0 z-10 h-1 bg-brand-500" aria-hidden />
      <SignInShowcase />

      {/* Same background as the left panel, so the page reads as one surface. */}
      <section className="relative flex flex-col overflow-hidden bg-ink-900 px-5 pt-16 pb-1 lg:pt-6">
        {/* On wide screens the toggle sits in the left panel's top bar instead. */}
        <ThemeToggle withLabel className="absolute right-5 top-5 z-10 lg:hidden" />
        <div className="glass relative m-auto w-full max-w-[560px] rounded-md border-t-[3px] border-t-brand-500 px-6 py-7 sm:px-10">
          <Logo className="mb-6 lg:hidden" />
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">
            <ShieldCheck className="size-3.5" /> Secure sign-in
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold">{company ? `Sign in to ${company.name}` : "Sign in"}</h2>
          <p className="mt-1 text-sm text-muted">
            {company
              ? "Use the employee ID or email and password your administrator gave you."
              : "Enter your workspace, your employee ID or email, and your password."}
          </p>
          {reason === "revoked" && (
            <Alert className="mt-6">Your access has been revoked. Contact your administrator if this is a mistake.</Alert>
          )}
          {reason === "suspended" && (
            <Alert className="mt-6">Your company&apos;s workspace is suspended. Contact Lasan to have it reactivated.</Alert>
          )}
          <LoginForm next={typeof next === "string" ? next : ""} workspace={prefill} />
          <div className="mt-6 space-y-1.5 border-t border-white/10 pt-4 text-center text-xs text-subtle">
            <p className="flex items-center justify-center gap-1.5">
              <Lock className="size-3.5 text-emerald-300" /> Your connection to this page is encrypted.
            </p>
            <p className="sm:whitespace-nowrap">
              By signing in, you agree to the{" "}
              <Link href="/terms" className="text-brand-300 hover:underline">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-brand-300 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <PoweredBy className="relative py-4!" />
      </section>
    </main>
  );
}

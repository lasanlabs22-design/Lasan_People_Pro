import { KeyRound } from "lucide-react";
import { Logo } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password · Platform" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh flex-col px-5">
      <div className="m-auto w-full max-w-sm animate-fade-up py-12">
        <Logo className="mb-10" />
        <span className="grid size-11 place-items-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-300">
          <KeyRound className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">Admin password reset</h1>
        <p className="mt-2 text-sm text-muted">
          For Lasan admins: ask another admin for a temporary password. They&apos;ll see your request when they next open the
          console, then send you the new password. Staff don&apos;t need this; ask an admin directly.
        </p>
        <ForgotForm />
      </div>
      <PoweredBy />
    </main>
  );
}

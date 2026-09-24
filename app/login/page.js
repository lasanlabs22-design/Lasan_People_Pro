import { CalendarCheck2, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand";
import { Alert } from "@/components/ui";
import { PoweredBy } from "@/components/powered-by";
import { getWorkspace } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const FEATURES = [
  { icon: MapPinned, title: "Geo-fenced check-in", text: "Punch in only when you're actually at the office." },
  { icon: CalendarCheck2, title: "Leave in two taps", text: "Live balances, instant requests, clear decisions." },
  { icon: ShieldCheck, title: "Private by default", text: "Your profile and history stay between you and HR." },
];

export default async function LoginPage({ searchParams }) {
  const { next, reason, workspace } = await searchParams;
  const prefill = typeof workspace === "string" ? workspace.toLowerCase() : await getWorkspace();
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-white/5 p-12 lg:flex lg:flex-col">
        <div className="absolute -left-32 top-1/3 size-[520px] rounded-full bg-brand-600/25 blur-[120px] animate-float" />
        <div className="absolute -bottom-40 right-0 size-[420px] rounded-full bg-cyan-500/15 blur-[120px] animate-float [animation-delay:-6s]" />
        <Logo />
        <div className="relative my-auto max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted">
            <Sparkles className="size-3.5 text-brand-300" /> Attendance & leave, reimagined
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight">
            <span className="text-gradient">Show up.</span>
            <br />
            Take time off.
            <br />
            <span className="text-muted">Zero paperwork.</span>
          </h1>
          <ul className="mt-12 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-300">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-subtle">© {new Date().getFullYear()} Lasan. All rights reserved.</p>
      </section>

      <section className="flex flex-col px-5">
        <div className="m-auto w-full max-w-sm animate-fade-up py-12">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-muted">
            Sign in with your company&apos;s workspace name and the employee ID or email your admin shared with you.
          </p>
          {reason === "revoked" && (
            <Alert className="mt-6">Your access has been revoked. Contact your administrator if this is a mistake.</Alert>
          )}
          <LoginForm next={typeof next === "string" ? next : ""} workspace={prefill} />
        </div>
        <PoweredBy />
      </section>
    </main>
  );
}

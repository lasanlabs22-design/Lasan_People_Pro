import Link from "next/link";
import { Logo } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { ThemeToggle } from "@/components/theme-toggle";

// Public pages (no sign-in): Privacy Policy and Terms.
export default function LegalLayout({ children }) {
  return (
    <div className="relative min-h-dvh bg-ink-900">
      <div className="h-1 bg-brand-500" aria-hidden />
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-6">
        <Link href="/login" aria-label="Back to sign in">
          <Logo />
        </Link>
        <ThemeToggle withLabel />
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-10">{children}</main>
      <nav className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 border-t border-white/10 px-5 pt-5 text-sm">
        <Link href="/privacy" className="text-brand-300 hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-brand-300 hover:underline">
          Terms and Conditions
        </Link>
        <Link href="/login" className="text-muted hover:text-fg">
          Back to sign in
        </Link>
      </nav>
      <PoweredBy />
    </div>
  );
}

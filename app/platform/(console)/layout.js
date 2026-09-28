import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui";
import { loadPlatform } from "@/lib/api";
import { ConsoleNav, AccountMenu } from "./nav";

export default async function ConsoleLayout({ children }) {
  const { admin } = await loadPlatform("/platform/me");
  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden sm:block">
            <Badge tone="amber">Platform</Badge>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu name={admin.name} email={admin.email} role={admin.role} />
        </div>
      </header>
      {!admin.mustChangePassword && <ConsoleNav isAdmin={admin.role === "admin"} passwordRequests={admin.passwordRequests} />}
      {children}
    </div>
  );
}

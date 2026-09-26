import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui";
import { loadPlatform } from "@/lib/api";
import { ConsoleNav, AccountMenu } from "./nav";

export default async function ConsoleLayout({ children }) {
  const { admin } = await loadPlatform("/platform/me");
  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <Badge tone="amber">Platform</Badge>
        </div>
        <AccountMenu name={admin.name} email={admin.email} role={admin.role} />
      </header>
      {!admin.mustChangePassword && <ConsoleNav isAdmin={admin.role === "admin"} passwordRequests={admin.passwordRequests} />}
      {children}
    </div>
  );
}

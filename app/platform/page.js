import { Building2, LogOut, Users } from "lucide-react";
import { Logo } from "@/components/brand";
import { Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { loadPlatform } from "@/lib/api";
import { fmtDate, TZ } from "@/lib/format";
import { CreateWorkspace, WorkspaceStatusButton } from "./client";

export const metadata = { title: "Platform console" };

// Timestamps → the app's local calendar day, which fmtDate expects.
const day = (ts) => (ts ? fmtDate(new Date(ts).toLocaleDateString("en-CA", { timeZone: TZ })) : null);

export default async function PlatformConsole() {
  const [{ admin }, { workspaces }] = await Promise.all([loadPlatform("/platform/me"), loadPlatform("/platform/workspaces")]);
  const active = workspaces.filter((w) => w.status === "active").length;

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <Badge tone="amber">Platform</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{admin.name}</span>
          <a href="/platform/logout" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted hover:bg-white/[0.06] hover:text-fg">
            <LogOut className="size-4" /> Sign out
          </a>
        </div>
      </header>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Workspaces</h1>
          <p className="mt-1.5 text-sm text-muted">
            {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"} · {active} active. Create one for a company, then hand its admin the login.
          </p>
        </div>
        <CreateWorkspace />
      </div>

      <Card>
        <CardHeader title="All workspaces" icon={Building2} />
        {workspaces.length === 0 ? (
          <EmptyState icon={Building2} title="No workspaces yet" description="Create the first one with the button above." />
        ) : (
          <Table className="mt-3">
            <thead className="border-b border-white/[0.06]">
              <tr>
                <Th>Company</Th>
                <Th>Workspace</Th>
                <Th>People</Th>
                <Th className="hidden md:table-cell">Created</Th>
                <Th className="hidden md:table-cell">Last sign-in</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {workspaces.map((w) => (
                <tr key={w.id} className="hover:bg-white/[0.02]">
                  <Td className="font-medium">{w.name}</Td>
                  <Td className="font-mono text-xs text-muted">{w.slug}</Td>
                  <Td className="tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5 text-subtle" /> {w.people}
                      <span className="text-xs text-subtle">({w.admins} admin{w.admins === 1 ? "" : "s"})</span>
                    </span>
                  </Td>
                  <Td className="hidden text-muted md:table-cell">{day(w.createdAt)}</Td>
                  <Td className="hidden text-muted md:table-cell">{day(w.lastLoginAt) ?? "Never"}</Td>
                  <Td>
                    <Badge tone={w.status === "active" ? "emerald" : "rose"} dot>
                      {w.status}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <WorkspaceStatusButton workspace={w} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="h-2" />
      </Card>
    </div>
  );
}

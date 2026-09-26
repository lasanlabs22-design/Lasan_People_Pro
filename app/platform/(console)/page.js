import { Building2, Users } from "lucide-react";
import { Alert, Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { ConsumeSearchParam } from "@/components/url-params";
import { loadPlatform } from "@/lib/api";
import { fmtDay } from "@/lib/format";
import { CreateWorkspace, WorkspaceStatusButton } from "./workspaces";

export const metadata = { title: "Workspaces · Platform" };

export default async function WorkspacesPage({ searchParams }) {
  const { password } = await searchParams;
  const { workspaces } = await loadPlatform("/platform/workspaces");
  const active = workspaces.filter((w) => w.status === "active").length;

  return (
    <>
      {password === "changed" && (
        <>
          <ConsumeSearchParam name="password" />
          <Alert tone="emerald" className="mb-6">
            Your password is changed. Any other devices you were signed in on have been signed out.
          </Alert>
        </>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Workspaces</h1>
          <p className="mt-1.5 text-sm text-muted">
            {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"} · {active} active. Every company on Lasan People Pro
            is set up here; create one, then hand its admin the login.
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
                  <Td className="hidden text-muted md:table-cell">{fmtDay(w.createdAt)}</Td>
                  <Td className="hidden text-muted md:table-cell">{fmtDay(w.lastLoginAt) ?? "Never"}</Td>
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
    </>
  );
}

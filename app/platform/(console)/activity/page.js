import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { loadPlatform } from "@/lib/api";
import { fmtDay, fmtTime } from "@/lib/format";

export const metadata = { title: "Activity · Platform" };

// Plain-language names for what the console records (server/routes/platform.js).
const ACTIONS = {
  "auth.login": ["Signed in", "slate"],
  "auth.login_failed": ["Failed sign-in", "rose"],
  "auth.password_changed": ["Changed their password", "slate"],
  "workspace.created": ["Created workspace", "emerald"],
  "workspace.suspended": ["Suspended workspace", "rose"],
  "workspace.reactivated": ["Reactivated workspace", "emerald"],
  "team.added": ["Added to the team", "brand"],
  "team.role_changed": ["Changed role", "amber"],
  "team.deactivated": ["Deactivated", "rose"],
  "team.activated": ["Reactivated", "emerald"],
  "team.password_reset": ["Gave a temporary password", "amber"],
  "team.password_request_dismissed": ["Dismissed a password request", "slate"],
};

export default async function ActivityPage() {
  const { admin: me } = await loadPlatform("/platform/me");
  // Staff don't see the audit trail.
  if (me.role !== "admin") redirect("/platform");
  const { entries } = await loadPlatform("/platform/audit", { query: { limit: 300 } });

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Activity</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Everything done in this console: sign-ins, workspaces created or suspended, and changes to the Lasan team. Nobody can
          edit or delete this history.
        </p>
      </div>

      <Card>
        <CardHeader title="Latest activity" subtitle={`Last ${entries.length} events`} icon={History} />
        {entries.length === 0 ? (
          <EmptyState icon={History} title="Nothing recorded yet" description="Console actions will appear here." />
        ) : (
          <Table className="mt-3">
            <thead className="border-b border-white/[0.06]">
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
                <Th className="hidden md:table-cell">From</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {entries.map((e) => {
                const [label, tone] = ACTIONS[e.action] ?? [e.action, "slate"];
                return (
                  <tr key={e.id} className="hover:bg-white/[0.02]">
                    <Td className="whitespace-nowrap text-muted">
                      {fmtDay(e.at)}
                      <span className="block text-xs text-subtle">{fmtTime(e.at)}</span>
                    </Td>
                    <Td>
                      <p className="font-medium">{e.actorName ?? e.actorEmail ?? "Unknown"}</p>
                      {e.actorName && <p className="text-xs text-muted">{e.actorEmail}</p>}
                    </Td>
                    <Td>
                      <Badge tone={tone}>{label}</Badge>
                      {e.targetLabel && <span className="ml-2 text-sm text-muted">{e.targetLabel}</span>}
                      {e.meta?.role && <span className="ml-1 text-xs text-subtle">→ {e.meta.role}</span>}
                    </Td>
                    <Td className="hidden font-mono text-xs text-subtle md:table-cell">{e.ip ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <div className="h-2" />
      </Card>
    </>
  );
}

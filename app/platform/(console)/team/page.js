import { UsersRound } from "lucide-react";
import { Badge, Card, CardHeader, Table, Td, Th } from "@/components/ui";
import { loadPlatform } from "@/lib/api";
import { fmtDay } from "@/lib/format";
import { AddStaff, StaffActions } from "./client";

export const metadata = { title: "Lasan team · Platform" };

export default async function TeamPage() {
  const [{ admin: me }, { team }] = await Promise.all([loadPlatform("/platform/me"), loadPlatform("/platform/team")]);
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Lasan team</h1>
          <p className="mt-1.5 text-sm text-muted">
            Staff who can sign in to this console and set up workspaces. New members get a temporary password and choose
            their own when they first sign in.
          </p>
        </div>
        <AddStaff />
      </div>

      <Card>
        <CardHeader title="Staff" subtitle={`${team.filter((m) => m.active).length} active`} icon={UsersRound} />
        <Table className="mt-3">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Name</Th>
              <Th className="hidden sm:table-cell">Added</Th>
              <Th className="hidden md:table-cell">Last sign-in</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {team.map((m) => (
              <tr key={m.id} className="hover:bg-white/[0.02]">
                <Td>
                  <p className="flex items-center gap-2 font-medium">
                    {m.name}
                    {m.id === me.id && <Badge tone="brand">You</Badge>}
                  </p>
                  <p className="text-xs text-muted">{m.email}</p>
                </Td>
                <Td className="hidden text-muted sm:table-cell">
                  {fmtDay(m.createdAt)}
                  {m.createdBy && <span className="block text-xs text-subtle">by {m.createdBy}</span>}
                </Td>
                <Td className="hidden text-muted md:table-cell">{fmtDay(m.lastLoginAt) ?? "Never"}</Td>
                <Td>
                  {!m.active ? (
                    <Badge tone="rose" dot>
                      Deactivated
                    </Badge>
                  ) : m.mustChangePassword ? (
                    <Badge tone="amber" dot>
                      Awaiting first sign-in
                    </Badge>
                  ) : (
                    <Badge tone="emerald" dot>
                      Active
                    </Badge>
                  )}
                </Td>
                <Td className="text-right">{m.id !== me.id && <StaffActions member={m} />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="h-2" />
      </Card>
    </>
  );
}

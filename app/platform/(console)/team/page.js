import { redirect } from "next/navigation";
import { KeyRound, UsersRound } from "lucide-react";
import { Badge, Card, CardHeader, Table, Td, Th } from "@/components/ui";
import { loadPlatform } from "@/lib/api";
import { fmtDay } from "@/lib/format";
import { AddStaff, PasswordRequests, StaffActions } from "./client";

export const metadata = { title: "Lasan team · Platform" };

export default async function TeamPage() {
  const { admin: me } = await loadPlatform("/platform/me");
  // Staff don't see the team or its admins.
  if (me.role !== "admin") redirect("/platform");
  const [{ team }, { requests }] = await Promise.all([loadPlatform("/platform/team"), loadPlatform("/platform/password-requests")]);
  const admins = team.filter((m) => m.role === "admin" && m.active).length;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Lasan team</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            <b className="font-medium text-fg">Admins</b> manage this team and give out temporary passwords.{" "}
            <b className="font-medium text-fg">Staff</b> set up workspaces and can&apos;t see the team. New people choose their
            own password when they first sign in.
          </p>
        </div>
        <AddStaff />
      </div>

      {requests.length > 0 && (
        <Card className="mb-6 border-amber-500/25">
          <CardHeader
            title="Asked you for a temporary password"
            subtitle="They forgot their password and chose you to reset it"
            icon={KeyRound}
          />
          <PasswordRequests requests={requests} />
        </Card>
      )}

      <Card>
        <CardHeader title="Team" subtitle={`${team.filter((m) => m.active).length} active · ${admins} admin${admins === 1 ? "" : "s"}`} icon={UsersRound} />
        <Table className="mt-3">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th className="hidden md:table-cell">Added</Th>
              <Th className="hidden lg:table-cell">Last sign-in</Th>
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
                <Td>
                  <Badge tone={m.role === "admin" ? "amber" : "slate"}>{m.role}</Badge>
                </Td>
                <Td className="hidden text-muted md:table-cell">
                  {fmtDay(m.createdAt)}
                  {m.createdBy && <span className="block text-xs text-subtle">by {m.createdBy}</span>}
                </Td>
                <Td className="hidden text-muted lg:table-cell">{fmtDay(m.lastLoginAt) ?? "Never"}</Td>
                <Td>
                  {!m.active ? (
                    <Badge tone="rose" dot>
                      Deactivated
                    </Badge>
                  ) : m.mustChangePassword ? (
                    <Badge tone="amber" dot className="normal-case">
                      Temporary password
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

import { BriefcaseBusiness, KeyRound } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { AvatarUploader, ProfileForm } from "./client";

/** Your own profile: photo, personal details and emergency contact. Shared by /employee/profile and /admin/profile. */
export function ProfileView({ user, profile }) {
  const filled = ["avatar", "phone", "dateOfBirth", "bloodGroup", "emergencyContactName", "emergencyContactPhone"].filter((k) => profile[k]).length;
  const completeness = Math.round((filled / 6) * 100);
  const admin = user.role === "admin";

  return (
    <>
      <PageHeader eyebrow="You" title={admin ? "My profile" : "Profile"} description="Keep this up to date — HR uses it in emergencies." />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden p-6 text-center">
            <div className="relative">
              <AvatarUploader name={user.name} avatar={profile.avatar ?? null} />
              <h2 className="mt-4 font-display text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted">{user.designation || (admin ? "Administrator" : "Team member")}</p>
              <div className="mx-auto mt-5 max-w-56">
                <div className="flex justify-between text-xs text-muted">
                  <span>Profile complete</span>
                  <span className="tabular-nums">{completeness}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${completeness}%` }} />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Employment"
              subtitle={admin ? "Edit these from Employees" : "Managed by your admin"}
              icon={BriefcaseBusiness}
            />
            <dl className="grid grid-cols-[110px_1fr] gap-y-3 px-5 pb-5 pt-4 text-sm">
              <dt className="text-muted">Employee ID</dt>
              <dd className="font-mono">{user.employeeCode}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="truncate">{user.email}</dd>
              <dt className="text-muted">Department</dt>
              <dd>{user.department || "—"}</dd>
              <dt className="text-muted">Joined</dt>
              <dd>{fmtDate(user.dateOfJoining)}</dd>
              <dt className="text-muted">Gender</dt>
              <dd className="capitalize">{user.gender}</dd>
            </dl>
            <div className="border-t border-white/[0.06] p-4">
              <LinkButton href="/change-password" variant="secondary" size="sm" className="w-full">
                <KeyRound className="size-3.5" /> Change password
              </LinkButton>
            </div>
          </Card>
        </div>

        <ProfileForm profile={profile} />
      </div>
    </>
  );
}

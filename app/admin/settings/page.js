import { load } from "@/lib/api";
import { Alert, PageHeader } from "@/components/ui";
import { GeneralSettings, LeavePolicy, Offices } from "./client";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }) {
  const { welcome } = await searchParams;
  const [{ settings }, { offices }, { leaveTypes }, { tenant }] = await Promise.all([
    load("/admin/org/settings"),
    load("/admin/org/offices"),
    load("/leave-types"),
    load("/auth/me"),
  ]);
  return (
    <>
      <PageHeader eyebrow="Organisation" title="Settings" description="Geofencing, work week and leave policy." />
      {welcome && (
        <Alert tone="brand" className="mb-6 animate-fade-up">
          Your workspace <b>{tenant.name}</b> is ready. Your team signs in with the workspace name{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">{tenant.slug}</code>. Next: set your weekly off days,
          add an office location, check the leave policy, then add employees.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <GeneralSettings settings={settings} />
        <LeavePolicy leaveTypes={leaveTypes} />
        <div className="xl:col-span-2">
          <Offices offices={offices} geofenceMode={settings.geofenceMode} />
        </div>
      </div>
    </>
  );
}

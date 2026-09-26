import { load } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { GeneralSettings, LeavePolicy, Offices } from "./client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [{ settings }, { offices }, { leaveTypes }] = await Promise.all([
    load("/admin/org/settings"),
    load("/admin/org/offices"),
    load("/leave-types"),
  ]);
  return (
    <>
      <PageHeader eyebrow="Organisation" title="Settings" description="Geofencing, work week and leave policy." />
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

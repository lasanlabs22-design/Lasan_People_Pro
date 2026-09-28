import { load } from "@/lib/api";
import { ProfileView } from "@/app/employee/profile/view";

export const metadata = { title: "My profile" };

// An admin's own profile: the same page employees have, reachable from the admin area.
export default async function AdminProfilePage() {
  const { user, profile } = await load("/me/profile");
  return <ProfileView user={user} profile={profile} />;
}

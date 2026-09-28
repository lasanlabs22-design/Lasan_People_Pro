import { load } from "@/lib/api";
import { ProfileView } from "./view";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await load("/me/profile");
  return <ProfileView user={user} profile={profile} />;
}

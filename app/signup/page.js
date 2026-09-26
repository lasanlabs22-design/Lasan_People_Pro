import { redirect } from "next/navigation";

// Workspaces are created by Lasan from the platform console; old sign-up links land on sign-in.
export default function SignupPage() {
  redirect("/login");
}

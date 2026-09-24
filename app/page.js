import { redirect } from "next/navigation";

// proxy.js sends signed-in users to their dashboard; this is the fallback.
export default function Home() {
  redirect("/login");
}

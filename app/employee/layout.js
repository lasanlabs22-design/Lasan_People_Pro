import { redirect } from "next/navigation";
import { load } from "@/lib/api";
import { Shell } from "@/components/shell";

export default async function EmployeeLayout({ children }) {
  const { user, tenant } = await load("/auth/me");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role === "admin") redirect("/admin");
  return (
    <Shell user={user} tenant={tenant}>
      {children}
    </Shell>
  );
}

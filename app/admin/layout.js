import { redirect } from "next/navigation";
import { load } from "@/lib/api";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }) {
  const { user, tenant } = await load("/auth/me");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "admin") redirect("/employee");
  const { stats } = await load("/admin/overview");
  return (
    <Shell user={user} tenant={tenant} badges={{ pendingLeaves: stats.pendingLeaves }}>
      {children}
    </Shell>
  );
}

import { LockKeyhole } from "lucide-react";
import { changePlatformPassword } from "@/app/actions/platform";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Card } from "@/components/ui";
import { loadPlatform } from "@/lib/api";

export const metadata = { title: "Change password · Platform" };

export default async function PlatformPasswordPage() {
  const { admin } = await loadPlatform("/platform/me");
  const first = admin.mustChangePassword;
  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <Card className="p-7">
        <span className="mb-5 grid size-11 place-items-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-300">
          <LockKeyhole className="size-5" />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {first ? `Welcome to the Lasan team, ${admin.name.split(" ")[0]}` : "Change password"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {first
            ? "Before you continue, replace the temporary password you were given with one only you know."
            : "Pick a new password with at least 8 characters, including a letter and a number. You'll be signed out on your other devices."}
        </p>
        <ChangePasswordForm action={changePlatformPassword} cancelHref={first ? null : "/platform"} />
      </Card>
    </div>
  );
}

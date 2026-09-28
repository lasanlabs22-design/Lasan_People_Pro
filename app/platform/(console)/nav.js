"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, History, KeyRound, LogOut, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/platform", label: "Workspaces", icon: Building2 },
  // The team, its admins, their password requests and the audit trail are for admins only.
  { href: "/platform/team", label: "Lasan team", icon: UsersRound, adminOnly: true, badge: true },
  { href: "/platform/activity", label: "Activity", icon: History, adminOnly: true },
];

export function ConsoleNav({ isAdmin, passwordRequests = 0 }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  if (tabs.length < 2) return null;
  return (
    <nav className="mb-6 flex gap-1 border-b border-white/15 sm:mb-8 sm:w-full">
      {tabs.map(({ href, label, icon: Icon, badge }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "-mb-px inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-2 py-2.5 text-sm transition-colors sm:flex-none sm:px-4",
            pathname === href ? "border-brand-500 font-semibold text-brand-50" : "border-transparent text-muted hover:text-fg",
          )}
        >
          <Icon className="hidden size-4 sm:block" /> {label}
          {badge && passwordRequests > 0 && (
            <span
              className="grid min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-black"
              title={`${passwordRequests} password request${passwordRequests === 1 ? "" : "s"} waiting`}
            >
              {passwordRequests}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function AccountMenu({ name, email, role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-white/[0.06] hover:text-fg sm:py-1.5"
      >
        {/* Phones show an icon so the header fits on one line; the name is in the menu. */}
        <UserRound className="size-5 sm:hidden" />
        <span className="hidden sm:inline">{name}</span>
        <ChevronDown className={cn("hidden size-4 transition-transform sm:block", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-md border border-white/15 bg-ink-900 shadow-lg">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="truncate text-sm font-medium sm:hidden">{name}</p>
            <p className="truncate text-xs text-subtle">{email}</p>
            <p className="mt-0.5 text-xs font-medium text-muted">{role === "admin" ? "Admin" : "Staff"}</p>
          </div>
          <Link
            href="/platform/password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:bg-white/[0.06] hover:text-fg"
          >
            <KeyRound className="size-4" /> Change password
          </Link>
          <a href="/platform/logout" className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:bg-white/[0.06] hover:text-rose-300">
            <LogOut className="size-4" /> Sign out
          </a>
        </div>
      )}
    </div>
  );
}

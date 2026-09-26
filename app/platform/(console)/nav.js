"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, KeyRound, LogOut, UsersRound } from "lucide-react";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/platform", label: "Workspaces", icon: Building2 },
  // The team, its admins and their password requests are for admins only.
  { href: "/platform/team", label: "Lasan team", icon: UsersRound, adminOnly: true },
];

export function ConsoleNav({ isAdmin, passwordRequests = 0 }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  if (tabs.length < 2) return null;
  return (
    <nav className="mb-8 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 sm:w-fit">
      {tabs.map(({ href, label, icon: Icon, adminOnly }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors sm:flex-none",
            pathname === href ? "bg-white/10 text-fg" : "text-muted hover:text-fg",
          )}
        >
          <Icon className="size-4" /> {label}
          {adminOnly && passwordRequests > 0 && (
            <span
              className="grid min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-ink-950"
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
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-white/[0.06] hover:text-fg"
      >
        {name} <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur">
          <div className="border-b border-white/[0.06] px-4 py-3">
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

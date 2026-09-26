"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, KeyRound, LogOut, UsersRound } from "lucide-react";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/platform", label: "Workspaces", icon: Building2 },
  { href: "/platform/team", label: "Lasan team", icon: UsersRound },
];

export function ConsoleNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 sm:w-fit">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors sm:flex-none",
            pathname === href ? "bg-white/10 text-fg" : "text-muted hover:text-fg",
          )}
        >
          <Icon className="size-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}

export function AccountMenu({ name, email }) {
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
          <p className="truncate border-b border-white/[0.06] px-4 py-3 text-xs text-subtle">{email}</p>
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

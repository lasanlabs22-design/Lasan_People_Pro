"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Clock3,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Logo } from "./brand";
import { NavPending } from "./nav-pending";
import { PoweredBy } from "./powered-by";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, cn } from "./ui";

const NAV = {
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/admin/employees", label: "Employees", icon: Users },
    { href: "/admin/leaves", label: "Leave requests", icon: Inbox, badgeKey: "pendingLeaves" },
    { href: "/admin/attendance", label: "Attendance", icon: Clock3 },
    { href: "/admin/holidays", label: "Holidays", icon: CalendarDays },
    { href: "/admin/settings", label: "Settings", icon: Settings2 },
  ],
  employee: [
    { href: "/employee", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/employee/leaves", label: "My leaves", icon: CalendarRange },
    { href: "/employee/attendance", label: "Attendance", icon: Clock3 },
    { href: "/employee/holidays", label: "Holidays", icon: CalendarDays },
    { href: "/employee/profile", label: "Profile", icon: UserRound },
  ],
};

export function Shell({ user, tenant, badges = {}, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV[user.role] ?? NAV.employee;

  // Close the mobile drawer whenever navigation happens.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon, exact, badgeKey }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        const badge = badgeKey ? badges[badgeKey] : 0;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-brand-500/10 font-semibold text-brand-50" : "text-fg hover:bg-white/[0.05]",
            )}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-sm bg-brand-500" />}
            <Icon className={cn("size-[18px]", active ? "text-brand-300" : "text-muted")} />
            <span className="flex-1">{label}</span>
            <NavPending spinner />
            {badge > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-on-brand">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const workspace = tenant && (
    <div className="mb-5 flex items-center gap-2.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2" title={`Workspace: ${tenant.slug}`}>
      <Building2 className="size-4 shrink-0 text-brand-300" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{tenant.name}</p>
        <p className="truncate font-mono text-[11px] text-subtle">{tenant.slug}</p>
      </div>
    </div>
  );

  const account = (
    <div className="mt-6 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] p-2.5">
      <Avatar src={user.avatar} name={user.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-subtle">{user.role === "admin" ? "Administrator" : user.designation || user.employeeCode}</p>
      </div>
      {/* POST so link prefetching can never sign anyone out. */}
      <form action="/logout" method="post">
        <button className="rounded-lg p-2 text-subtle hover:bg-white/10 hover:text-rose-300" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-ink-900 p-4 lg:flex">
        <Link href={items[0].href} className="mb-4 px-2 pt-2">
          <Logo />
        </Link>
        {workspace}
        {nav}
        <ThemeToggle withLabel className="mt-4 w-full justify-center" />
        {account}
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-ink-900 px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setOpen(true)} className="rounded-md p-2 text-muted hover:bg-white/10" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/10 bg-ink-900 p-4 animate-fade-up">
            <div className="mb-4 flex items-center justify-between px-2 pt-2">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-white/10" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {workspace}
            {nav}
            {account}
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-4 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">{children}</main>
      <PoweredBy className={cn(user.role !== "admin" && "pb-24 lg:pb-6")} />

      {user.role !== "admin" && <BottomNav items={items} pathname={pathname} />}
    </div>
  );
}

/** Thumb-reachable tab bar for employees on phones (they mostly check in from mobile). */
function BottomNav({ items, pathname }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-900 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-brand-300" : "text-subtle hover:text-muted",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-md transition-colors", active && "bg-brand-500/10")}>
                  <Icon className="size-[18px]" />
                </span>
                {label === "My leaves" ? "Leaves" : label}
                <NavPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

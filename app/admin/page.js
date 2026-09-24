import Link from "next/link";
import { ArrowUpRight, CalendarDays, CalendarOff, Inbox, UserCheck, Users } from "lucide-react";
import { load } from "@/lib/api";
import { fmtDate, fmtRange, fmtDays, fmtTime, greeting } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const [{ user }, overview, pending, roll] = await Promise.all([
    load("/auth/me"),
    load("/admin/overview"),
    load("/admin/leaves", { query: { status: "pending" } }),
    load("/admin/attendance"),
  ]);
  const { stats, upcomingHolidays, date } = overview;
  const presentPct = stats.employees ? Math.round((stats.present / stats.employees) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow={fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description="Here's how the team is doing today."
        actions={
          <LinkButton href="/admin/employees?new=1">
            <Users className="size-4" /> Add employee
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 animate-fade-up">
        <StatCard label="Active employees" value={stats.employees} icon={Users} accent="brand" />
        <StatCard label="Checked in today" value={stats.present} hint={`${presentPct}% of the team`} icon={UserCheck} accent="emerald" />
        <StatCard label="On leave today" value={stats.onLeave} icon={CalendarOff} accent="cyan" />
        <StatCard label="Pending requests" value={stats.pendingLeaves} hint={stats.pendingLeaves ? "Needs your review" : "All caught up"} icon={Inbox} accent="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Leave requests awaiting you"
            subtitle="Oldest first"
            icon={Inbox}
            action={
              <Link href="/admin/leaves" className="inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-50">
                View all <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <div className="mt-3 divide-y divide-white/[0.05]">
            {pending.leaves.length === 0 && <EmptyState icon={Inbox} title="Inbox zero" description="No leave requests are waiting for a decision." />}
            {pending.leaves.slice(0, 6).map((l) => (
              <Link key={l.id} href="/admin/leaves" className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.03]">
                <Avatar name={l.employee.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.employee.name}</p>
                  <p className="truncate text-xs text-muted">
                    {fmtRange(l.startDate, l.endDate)} · {fmtDays(l.days)}
                  </p>
                </div>
                <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: `${l.leaveType.color}22`, color: l.leaveType.color }}>
                  {l.leaveType.name}
                </span>
              </Link>
            ))}
          </div>
          <div className="h-2" />
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader title="Today's roll-call" subtitle={`${roll.summary.present} in · ${roll.summary.onLeave} on leave · ${roll.summary.absent} not in`} icon={UserCheck}
              action={<Link href="/admin/attendance" className="text-xs text-brand-300 hover:text-brand-50">Details</Link>} />
            <div className="px-5 pb-5 pt-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="bg-emerald-400" style={{ width: `${pct(roll.summary.present, roll.summary.total)}%` }} />
                <div className="bg-cyan-400" style={{ width: `${pct(roll.summary.onLeave, roll.summary.total)}%` }} />
              </div>
              <ul className="mt-4 space-y-2.5">
                {roll.rows.filter((r) => r.record).slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.name}</span>
                    <span className="tabular-nums text-xs text-muted">
                      {fmtTime(r.record.checkInAt)} {r.record.checkOutAt && `→ ${fmtTime(r.record.checkOutAt)}`}
                    </span>
                  </li>
                ))}
                {roll.summary.present === 0 && <li className="text-sm text-subtle">No one has checked in yet.</li>}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Upcoming holidays" subtitle="Next 90 days" icon={CalendarDays}
              action={<Link href="/admin/holidays" className="text-xs text-brand-300 hover:text-brand-50">Manage</Link>} />
            <ul className="space-y-1 px-3 pb-4 pt-3">
              {upcomingHolidays.length === 0 && <li className="px-2 py-3 text-sm text-subtle">Nothing scheduled.</li>}
              {upcomingHolidays.map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-center leading-none">
                    <span className="font-display text-sm font-semibold text-cyan-200">{h.date.slice(8)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.name}</p>
                    <p className="text-xs text-muted">{fmtDate(h.date, { weekday: "long", month: "short", day: "numeric" })}</p>
                  </div>
                  {h.isOptional && <Badge>Optional</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

const pct = (n, total) => (total ? (n / total) * 100 : 0);

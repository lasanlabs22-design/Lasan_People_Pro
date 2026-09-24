import Link from "@/components/link";
import { ArrowUpRight, CalendarDays, CalendarPlus, History, PartyPopper } from "lucide-react";
import { load } from "@/lib/api";
import { fmtDate, fmtDays, fmtRange, greeting, STATUS_TONE } from "@/lib/format";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { BalanceCard } from "@/components/balance-card";
import { PunchCard } from "@/components/punch-card";
import { ConsumeSearchParam } from "@/components/url-params";

export const metadata = { title: "Dashboard" };

export default async function EmployeeDashboard({ searchParams }) {
  const { welcome } = await searchParams;
  const [{ user }, today, { balances, year }, { leaves }] = await Promise.all([
    load("/auth/me"),
    load("/attendance/today"),
    load("/leaves/balances"),
    load("/leaves/mine"),
  ]);
  const { holidays } = await load("/holidays", { query: { year } });
  const upcoming = holidays.filter((h) => h.date >= today.date).slice(0, 4);
  const totalAvailable = balances.filter((b) => !b.countsCalendarDays).reduce((s, b) => s + b.available, 0);

  return (
    <>
      <PageHeader
        eyebrow={fmtDate(today.date, { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description={`You have ${fmtDays(totalAvailable)} of leave available this year.`}
        actions={
          <LinkButton href="/employee/leaves?apply=1">
            <CalendarPlus className="size-4" /> Apply for leave
          </LinkButton>
        }
      />

      {welcome && <ConsumeSearchParam name="welcome" />}
      {welcome && (
        <Alert tone="brand" className="mb-6 flex items-center gap-2">
          <PartyPopper className="size-4" /> You&apos;re all set! Take a minute to{" "}
          <Link href="/employee/profile" className="font-medium underline underline-offset-4">
            complete your profile
          </Link>
          .
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <PunchCard today={today} />

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {balances.map((b) => (
              <BalanceCard key={b.leaveTypeId} balance={b} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent requests"
            icon={History}
            action={
              <Link href="/employee/leaves" className="inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-50">
                All <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <div className="mt-3 divide-y divide-white/[0.05]">
            {leaves.length === 0 && <EmptyState icon={History} title="No requests yet" description="Your leave requests and their status appear here." />}
            {leaves.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                <span className="size-2 shrink-0 rounded-full" style={{ background: l.leaveType.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {l.leaveType.name} · <span className="text-muted">{fmtRange(l.startDate, l.endDate)}</span>
                  </p>
                  {l.reviewComment && <p className="truncate text-xs text-subtle">{l.reviewComment}</p>}
                </div>
                <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
              </div>
            ))}
          </div>
          <div className="h-2" />
        </Card>

        <Card>
          <CardHeader
            title="Upcoming holidays"
            icon={CalendarDays}
            action={
              <Link href="/employee/holidays" className="inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-50">
                Calendar <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <ul className="space-y-1 px-3 pb-4 pt-3">
            {upcoming.length === 0 && <li className="px-2 py-3 text-sm text-subtle">No more holidays this year.</li>}
            {upcoming.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-center leading-tight">
                  <span className="font-display text-sm font-semibold text-cyan-200">{h.date.slice(8)}</span>
                  <span className="text-[9px] uppercase text-cyan-200/70">{fmtDate(h.date, { month: "short" })}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted">{fmtDate(h.date, { weekday: "long" })}</p>
                </div>
                {h.isOptional && <Badge>Optional</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

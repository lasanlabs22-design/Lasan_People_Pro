import { CalendarRange, History } from "lucide-react";
import { load } from "@/lib/api";
import { isMonth, leavesByDate, todayIso } from "@/lib/dates";
import { cancelLeave } from "@/app/actions/employee";
import { fmtDays, fmtRange, HALF_DAY_LABEL, STATUS_TONE } from "@/lib/format";
import { ActionButton } from "@/components/client";
import { Legend, MonthCalendar, MonthNav } from "@/components/calendar";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ApplyLeave } from "./apply";

export const metadata = { title: "My leaves" };

export default async function MyLeaves({ searchParams }) {
  const sp = await searchParams;
  const today = todayIso();
  const month = isMonth(sp.month) ? sp.month : today.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const [{ balances }, { leaves }, { holidays }, config] = await Promise.all([
    load("/leaves/balances", { query: { year } }),
    load("/leaves/mine", { query: { year } }),
    load("/holidays", { query: { year } }),
    load("/config"),
  ]);

  const events = Object.fromEntries(
    Object.entries(leavesByDate(leaves, { weekendDays: config.weekendDays, holidays })).map(([d, ls]) => [
      d,
      ls.map((l) => ({ label: l.leaveType.name, color: l.leaveType.color, dashed: l.status === "pending" })),
    ]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Time off"
        title="My leaves"
        description="Weekends and company holidays are never deducted from your balance."
        actions={<ApplyLeave balances={balances} defaultOpen={sp.apply === "1"} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {balances.map((b) => (
          <div key={b.leaveTypeId} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: b.color }} />
              <p className="truncate text-xs text-muted">{b.name}</p>
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
              {b.available}
              <span className="text-sm font-normal text-subtle"> / {b.quota}</span>
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${b.quota ? (b.available / b.quota) * 100 : 0}%`, background: b.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Legend
              items={[
                { label: "Approved", color: "#9a82ff" },
                { label: "Pending", color: "#9a82ff", dashed: true },
                { label: "Holiday", color: "#67e8f9" },
              ]}
            />
            <MonthNav month={month} basePath="/employee/leaves" />
          </div>
          <MonthCalendar
            month={month}
            holidays={Object.fromEntries(holidays.map((h) => [h.date, h]))}
            events={events}
            weekendDays={config.weekendDays}
          />
        </Card>

        <Card className="h-fit">
          <CardHeader title={`Requests in ${year}`} subtitle={`${leaves.length} total`} icon={History} />
          <div className="mt-3 max-h-[640px] divide-y divide-white/[0.05] overflow-y-auto">
            {leaves.length === 0 && <EmptyState icon={CalendarRange} title="Nothing yet" description="Apply for leave and track it here." />}
            {leaves.map((l) => {
              // Same rule as the API: approved leave can be cancelled until the end of its first day.
              const cancellable = l.status === "pending" || (l.status === "approved" && l.startDate >= today);
              return (
                <div key={l.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="size-2 rounded-full" style={{ background: l.leaveType.color }} />
                        {l.leaveType.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {fmtRange(l.startDate, l.endDate)} · {fmtDays(l.days)}
                        {l.halfDay !== "none" && ` · ${HALF_DAY_LABEL[l.halfDay]}`}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-fg/80">{l.reason}</p>
                  {l.reviewComment && (
                    <p
                      className={`mt-2 rounded-lg px-3 py-2 text-xs ${l.status === "rejected" ? "bg-rose-500/10 text-rose-200" : "bg-white/[0.04] text-muted"}`}
                    >
                      <span className="font-medium">{l.reviewerName ?? "Admin"}:</span> {l.reviewComment}
                    </p>
                  )}
                  {cancellable && (
                    <div className="mt-2">
                      <ActionButton
                        action={cancelLeave.bind(null, l.id)}
                        confirmText={
                          l.status === "pending"
                            ? "Cancel this leave request?"
                            : `Cancel this approved leave? ${fmtDays(l.days)} will go back to your balance.`
                        }
                        variant="ghost"
                        size="sm"
                        className="-ml-3"
                      >
                        {l.status === "pending" ? "Cancel request" : "Cancel leave"}
                      </ActionButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

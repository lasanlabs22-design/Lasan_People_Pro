import Link from "next/link";
import { Inbox } from "lucide-react";
import { load } from "@/lib/api";
import { fmtDate, fmtDays, fmtRange, HALF_DAY_LABEL, STATUS_TONE } from "@/lib/format";
import { Avatar, Badge, Card, EmptyState, PageHeader, cn } from "@/components/ui";
import { ReviewButtons } from "./review";

export const metadata = { title: "Leave requests" };

const TABS = ["pending", "approved", "rejected", "cancelled"];

export default async function LeavesPage({ searchParams }) {
  const sp = await searchParams;
  const status = TABS.includes(sp.status) ? sp.status : "pending";
  const [{ leaves }, pending] = await Promise.all([
    load("/admin/leaves", { query: { status } }),
    status === "pending" ? null : load("/admin/leaves", { query: { status: "pending" } }),
  ]);
  const pendingCount = status === "pending" ? leaves.length : pending.leaves.length;

  return (
    <>
      <PageHeader eyebrow="Time off" title="Leave requests" description="Approve with an optional note, or reject with a reason the employee will see." />

      <nav className="no-scrollbar mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/leaves?status=${t}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm capitalize transition-colors sm:px-4",
              status === t ? "bg-white/10 text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t}
            {t === "pending" && pendingCount > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">{pendingCount}</span>
            )}
          </Link>
        ))}
      </nav>

      {leaves.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={status === "pending" ? "You're all caught up" : `No ${status} requests`}
            description={status === "pending" ? "New requests will show up here." : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {leaves.map((l) => (
            <Card key={l.id} className="flex flex-col p-5 animate-fade-up">
              <div className="flex items-start gap-3">
                <Avatar name={l.employee.name} size={40} />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/employees/${l.userId}?tab=leaves`} className="font-medium hover:text-brand-300">
                    {l.employee.name}
                  </Link>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{l.employee.employeeCode}</span> · requested {fmtDate(l.createdAt.slice(0, 10), { day: "numeric", month: "short" })}
                  </p>
                </div>
                {status !== "pending" && <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ background: `${l.leaveType.color}22`, color: l.leaveType.color }}>
                  {l.leaveType.name}
                </span>
                <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs">{fmtRange(l.startDate, l.endDate)}</span>
                <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs tabular-nums">
                  {fmtDays(l.days)}
                  {l.halfDay !== "none" && ` · ${HALF_DAY_LABEL[l.halfDay]}`}
                </span>
              </div>

              <p className="mt-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm text-fg/90">“{l.reason}”</p>

              {l.reviewComment && (
                <p className="mt-3 text-xs text-muted">
                  <span className="text-subtle">{l.reviewerName ?? "Admin"}:</span> {l.reviewComment}
                </p>
              )}

              {l.status === "pending" && (
                <div className="mt-auto pt-4">
                  <ReviewButtons leave={l} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

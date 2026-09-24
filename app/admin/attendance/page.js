import Link from "@/components/link";
import { ChevronLeft, ChevronRight, Clock3, Coffee, MapPin, UserCheck, UserX, CalendarOff } from "lucide-react";
import { load } from "@/lib/api";
import { addDays, isIsoDate, missedCheckOut, todayIso } from "@/lib/dates";
import { fmtDate, fmtDistance, fmtDuration, fmtTime } from "@/lib/format";
import { Alert, Avatar, Badge, Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { DateJump } from "@/components/date-jump";
import { MissedCheckOut } from "@/components/missed-check-out";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }) {
  const sp = await searchParams;
  const today = todayIso();
  // The roll-call is a record of what happened, so it stops at today.
  const date = isIsoDate(sp.date) && sp.date <= today ? sp.date : today;
  const { summary, rows, dayOff } = await load("/admin/attendance", { query: { date } });
  const offLabel = dayOff?.reason === "holiday" ? dayOff.name : "Weekly off";

  return (
    <>
      <PageHeader
        eyebrow="Roll-call"
        title="Attendance"
        description={fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
            <Link href={`?date=${addDays(date, -1)}`} className="rounded-lg p-2 text-muted hover:bg-white/10 hover:text-fg" aria-label="Previous day">
              <ChevronLeft className="size-4" />
            </Link>
            <DateJump key={date} value={date} max={today} />
            {date < today && (
              <Link href={`?date=${addDays(date, 1)}`} className="rounded-lg p-2 text-muted hover:bg-white/10 hover:text-fg" aria-label="Next day">
                <ChevronRight className="size-4" />
              </Link>
            )}
            {date !== today && (
              <Link href="/admin/attendance" className="rounded-lg px-3 py-1.5 text-xs text-brand-300 hover:bg-white/10">
                Today
              </Link>
            )}
          </div>
        }
      />

      {dayOff && (
        <Alert tone="brand" className="mb-6 flex items-center gap-2">
          <Coffee className="size-4 shrink-0" />
          {dayOff.reason === "holiday" ? `${dayOff.name} — a company holiday.` : "A weekly off day."} No one was expected in.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Present" value={summary.present} hint={`of ${summary.total}`} icon={UserCheck} accent="emerald" />
        <StatCard label="On leave" value={summary.onLeave} icon={CalendarOff} accent="cyan" />
        {dayOff ? (
          <StatCard label="Off" value={summary.off} hint={offLabel} icon={Coffee} accent="brand" />
        ) : (
          <StatCard label="Not checked in" value={summary.absent} icon={UserX} accent="rose" />
        )}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Clock3} title="No one on the roll" description="No employees had joined by this day." />
        ) : (
          <>
          {/* Phones: one card per person instead of a 6-column table. */}
          <ul className="divide-y divide-white/[0.05] sm:hidden">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.03]">
                <Link href={`/admin/employees/${r.id}?tab=attendance`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{r.name}</span>
                      {r.revoked && <Badge tone="rose">Revoked</Badge>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {r.record ? (
                        <>
                          <span className="tabular-nums">
                            {fmtTime(r.record.checkInAt)} → {fmtTime(r.record.checkOutAt)}
                          </span>
                          <span className={r.record.source === "geo" ? "text-emerald-300" : "text-amber-300"}>
                            {r.record.source === "geo" ? "In office" : "Remote"}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono">{r.employeeCode}</span>
                      )}
                    </p>
                  </div>
                </Link>
                {missedCheckOut(r.record, today) ? (
                  <MissedCheckOut record={r.record} editable />
                ) : r.record ? (
                  <Badge tone="emerald" dot>
                    {r.record.checkOutAt ? fmtDuration(r.record.checkInAt, r.record.checkOutAt) : "In"}
                  </Badge>
                ) : (
                  <RollStatus row={r} />
                )}
              </li>
            ))}
          </ul>
          <Table className="hidden sm:block">
            <thead className="border-b border-white/[0.06]">
              <tr>
                <Th>Employee</Th>
                <Th>Status</Th>
                <Th>In</Th>
                <Th>Out</Th>
                <Th className="hidden sm:table-cell">Worked</Th>
                <Th className="hidden md:table-cell">Location</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/admin/employees/${r.id}?tab=attendance`} className="flex items-center gap-3 hover:text-brand-300">
                      <Avatar name={r.name} size={32} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className="truncate">{r.name}</span>
                          {r.revoked && <Badge tone="rose">Revoked</Badge>}
                        </span>
                        <span className="block font-mono text-xs text-muted">{r.employeeCode}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <RollStatus row={r} />
                  </Td>
                  <Td className="tabular-nums">{fmtTime(r.record?.checkInAt)}</Td>
                  <Td className="tabular-nums">
                    {missedCheckOut(r.record, today) ? <MissedCheckOut record={r.record} editable /> : fmtTime(r.record?.checkOutAt)}
                  </Td>
                  <Td className="hidden tabular-nums text-muted sm:table-cell">{fmtDuration(r.record?.checkInAt, r.record?.checkOutAt)}</Td>
                  <Td className="hidden md:table-cell">
                    {r.record &&
                      (r.record.source === "geo" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                          <MapPin className="size-3.5" /> In office · {fmtDistance(r.record.checkInDistance)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                          <MapPin className="size-3.5" /> Remote{r.record.checkInDistance != null && ` · ${fmtDistance(r.record.checkInDistance)} away`}
                        </span>
                      ))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </>
        )}
      </Card>
    </>
  );
}

function RollStatus({ row }) {
  // `status` comes from the API; derive it if an older API is still answering mid-deploy.
  const status = row.status ?? (row.record ? "present" : row.leave ? "leave" : "absent");
  if (status === "present") {
    return (
      <Badge tone="emerald" dot>
        Present
      </Badge>
    );
  }
  if (status === "leave") {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: `${row.leave.color}22`, color: row.leave.color }}>
        {row.leave.type}
      </span>
    );
  }
  return <Badge tone="slate">{status === "off" ? "Off" : "Not in"}</Badge>;
}

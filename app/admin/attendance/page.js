import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3, MapPin, UserCheck, UserX, CalendarOff } from "lucide-react";
import { load } from "@/lib/api";
import { addDays, isIsoDate, missedCheckOut, todayIso } from "@/lib/dates";
import { fmtDate, fmtDistance, fmtDuration, fmtTime } from "@/lib/format";
import { Avatar, Badge, Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { DateJump } from "@/components/date-jump";
import { MissedCheckOut } from "@/components/missed-check-out";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }) {
  const sp = await searchParams;
  const today = todayIso();
  const date = isIsoDate(sp.date) ? sp.date : today;
  const { summary, rows } = await load("/admin/attendance", { query: { date } });

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

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Present" value={summary.present} hint={`of ${summary.total}`} icon={UserCheck} accent="emerald" />
        <StatCard label="On leave" value={summary.onLeave} icon={CalendarOff} accent="cyan" />
        <StatCard label="Not checked in" value={summary.absent} icon={UserX} accent="rose" />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Clock3} title="No active employees" />
        ) : (
          <>
          {/* Phones: one card per person instead of a 6-column table. */}
          <ul className="divide-y divide-white/[0.05] sm:hidden">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.03]">
                <Link href={`/admin/employees/${r.id}?tab=attendance`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
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
                ) : r.leave ? (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: `${r.leave.color}22`, color: r.leave.color }}>
                    {r.leave.type}
                  </span>
                ) : (
                  <Badge tone="slate">Not in</Badge>
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
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block font-mono text-xs text-muted">{r.employeeCode}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    {r.record ? (
                      <Badge tone="emerald" dot>
                        Present
                      </Badge>
                    ) : r.leave ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: `${r.leave.color}22`, color: r.leave.color }}>
                        {r.leave.type}
                      </span>
                    ) : (
                      <Badge tone="slate">Not in</Badge>
                    )}
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

import Link from "@/components/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange, Clock3, HeartPulse, Mail, Phone, Star, UserRound } from "lucide-react";
import { load, ApiError } from "@/lib/api";
import { fmtDate, fmtDays, fmtDuration, fmtRange, fmtTime, HALF_DAY_LABEL, punchLabel, STATUS_TONE } from "@/lib/format";
import { isMonth, isYear, leavesByDate, missedCheckOut, todayIso } from "@/lib/dates";
import { MissedCheckOut } from "@/components/missed-check-out";
import { deleteRating } from "@/app/actions/admin";
import { Avatar, Badge, Card, CardHeader, EmptyState, Stars, cn } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { BalanceCard } from "@/components/balance-card";
import { Legend, MonthCalendar, MonthNav, YearCalendar } from "@/components/calendar";
import { AccessActions, AllocationEditor, RatingForm, RecordLeave } from "./client";

export const metadata = { title: "Employee" };

const TABS = [
  ["leaves", "Leave calendar", CalendarRange],
  ["ratings", "Ratings", Star],
  ["attendance", "Attendance", Clock3],
  ["profile", "Profile", UserRound],
];

export default async function EmployeeDetail({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab : "leaves";
  const year = isYear(sp.year) ? Number(sp.year) : Number(todayIso().slice(0, 4));

  let data;
  try {
    data = await load(`/admin/employees/${id}`, { query: { year } });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const { employee: e, profile, balances, ratings, rating } = data;
  const base = `/admin/employees/${id}`;

  return (
    <>
      <Link href="/admin/employees" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All employees
      </Link>

      <Card className="relative overflow-hidden p-6 animate-fade-up">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <Avatar src={profile.avatar} name={e.name} size={84} className="ring-2 ring-white/10" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{e.name}</h1>
              <Badge tone={STATUS_TONE[e.status]} dot>
                {e.status}
              </Badge>
              {e.role === "admin" && <Badge tone="brand">Admin</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {[e.designation, e.department].filter(Boolean).join(" · ") || "No designation set"}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
              <span className="font-mono text-fg/80">{e.employeeCode}</span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> {e.email}
              </span>
              <span className="capitalize">{e.gender}</span>
              <span>Joined {fmtDate(e.dateOfJoining)}</span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex items-center gap-2">
              <Stars value={rating ?? 0} size={18} />
              <span className="font-display text-lg font-semibold tabular-nums">{rating ?? "—"}</span>
              <span className="text-xs text-subtle">({ratings.length})</span>
            </div>
            <AccessActions employee={e} />
          </div>
        </div>
      </Card>

      <nav className="no-scrollbar mt-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {TABS.map(([t, label, Icon]) => (
          <Link
            key={t}
            href={`${base}?tab=${t}`}
            aria-label={label}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors sm:px-4",
              tab === t ? "bg-white/10 text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" /> <span className={cn(tab !== t && "hidden sm:inline")}>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-6 animate-fade-up">
        {tab === "leaves" && <LeavesTab id={id} employee={e} balances={balances} year={year} base={base} />}
        {tab === "ratings" && <RatingsTab id={id} ratings={ratings} />}
        {tab === "attendance" && <AttendanceTab id={id} month={isMonth(sp.month) ? sp.month : todayIso().slice(0, 7)} base={base} />}
        {tab === "profile" && <ProfileTab profile={profile} />}
      </div>
    </>
  );
}

async function LeavesTab({ id, employee, balances, year, base }) {
  const [{ leaves }, { holidays }, config] = await Promise.all([
    load(`/admin/employees/${id}/leaves`, { query: { year } }),
    load("/holidays", { query: { year } }),
    load("/config"),
  ]);
  const byDate = leavesByDate(leaves, { weekendDays: config.weekendDays, holidays });
  const events = Object.fromEntries(
    Object.entries(byDate).map(([d, ls]) => [
      d,
      ls.map((l) => ({ label: l.leaveType.name, color: l.leaveType.color, dashed: l.status === "pending" })),
    ]),
  );
  const holidayMap = Object.fromEntries(holidays.map((h) => [h.date, h]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {balances.map((b) => (
          <BalanceCard
            key={b.leaveTypeId}
            balance={b}
            footer={<AllocationEditor employeeId={id} year={year} balance={b} />}
          />
        ))}
      </div>
      {employee.gender !== "female" && (
        <p className="text-xs text-subtle">Maternity leave is only shown for employees recorded as female.</p>
      )}

      <Card className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold">{year} at a glance</h3>
            <p className="text-xs text-muted">Approved leave is solid, pending is dashed.</p>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Link href={`${base}?tab=leaves&year=${year - 1}`} className="rounded-lg px-3 py-1.5 text-muted hover:bg-white/10 hover:text-fg">
              ← {year - 1}
            </Link>
            <span className="px-2 font-display font-medium">{year}</span>
            <Link href={`${base}?tab=leaves&year=${year + 1}`} className="rounded-lg px-3 py-1.5 text-muted hover:bg-white/10 hover:text-fg">
              {year + 1} →
            </Link>
          </div>
        </div>
        <Legend
          items={[
            ...balances.map((b) => ({ label: b.name, color: b.color })),
            { label: "Holiday", color: "#67e8f9" },
          ]}
        />
        <div className="mt-6">
          <YearCalendar year={year} holidays={holidayMap} events={events} weekendDays={config.weekendDays} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Requests"
          subtitle={`${leaves.length} in ${year}`}
          icon={CalendarRange}
          action={<RecordLeave employeeId={id} employeeName={employee.name} balances={balances} disabled={employee.status !== "active"} />}
        />
        <div className="mt-3 divide-y divide-white/[0.05]">
          {leaves.length === 0 && <EmptyState title="No leave requests this year" />}
          {leaves.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <span className="size-2 rounded-full" style={{ background: l.leaveType.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {l.leaveType.name} · {fmtRange(l.startDate, l.endDate)}
                  {l.halfDay !== "none" && <span className="text-muted"> ({HALF_DAY_LABEL[l.halfDay]})</span>}
                </p>
                <p className="truncate text-xs text-muted">{l.reason}</p>
                {l.reviewComment && <p className="mt-0.5 text-xs text-subtle">↳ {l.reviewComment}</p>}
              </div>
              <span className="text-xs tabular-nums text-muted">{fmtDays(l.days)}</span>
              <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
            </div>
          ))}
        </div>
        <div className="h-2" />
      </Card>
    </div>
  );
}

function RatingsTab({ id, ratings }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit p-5">
        <h3 className="font-display font-semibold">Add a rating</h3>
        <p className="mb-5 text-xs text-muted">Ratings are private to admins.</p>
        <RatingForm employeeId={id} />
      </Card>
      <Card>
        <CardHeader title="History" subtitle={`${ratings.length} rating${ratings.length === 1 ? "" : "s"}`} icon={Star} />
        <div className="mt-3 divide-y divide-white/[0.05]">
          {ratings.length === 0 && <EmptyState icon={Star} title="Not rated yet" description="Your first rating will appear here." />}
          {ratings.map((r) => (
            <div key={r.id} className="flex gap-4 px-5 py-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars value={r.score} size={15} />
                  <Badge tone="brand">{r.period}</Badge>
                </div>
                {r.comment && <p className="mt-2 text-sm text-fg/90">{r.comment}</p>}
                <p className="mt-1.5 text-xs text-subtle">
                  {r.ratedByName ? `By ${r.ratedByName} · ` : ""}
                  {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
              </div>
              <ActionButton action={deleteRating.bind(null, id, r.id)} confirmText="Delete this rating?" variant="ghost" size="sm">
                Delete
              </ActionButton>
            </div>
          ))}
        </div>
        <div className="h-2" />
      </Card>
    </div>
  );
}

async function AttendanceTab({ id, month, base }) {
  const [{ records }, { holidays }, config] = await Promise.all([
    load(`/admin/employees/${id}/attendance`, { query: { month } }),
    load("/holidays", { query: { year: month.slice(0, 4) } }),
    load("/config"),
  ]);
  const today = todayIso();
  const events = Object.fromEntries(
    records.map((r) => [
      r.date,
      [{ label: punchLabel(r, today), color: r.source === "geo" ? "#34d399" : "#fbbf24" }],
    ]),
  );
  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Card className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display font-semibold">Punches</h3>
          <MonthNav month={month} basePath={base} params={{ tab: "attendance" }} />
        </div>
        <MonthCalendar
          month={month}
          events={events}
          holidays={Object.fromEntries(holidays.map((h) => [h.date, h]))}
          weekendDays={config.weekendDays}
        />
        <div className="mt-4">
          <Legend items={[{ label: "Inside geofence", color: "#34d399" }, { label: "Remote / outside", color: "#fbbf24" }]} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Log" subtitle={`${records.length} day${records.length === 1 ? "" : "s"} recorded`} icon={Clock3} />
        <div className="mt-3 divide-y divide-white/[0.05]">
          {records.length === 0 && <EmptyState title="No punches this month" />}
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>{fmtDate(r.date, { weekday: "short", day: "numeric", month: "short" })}</span>
              <span className="tabular-nums text-muted">
                {fmtTime(r.checkInAt)} → {missedCheckOut(r, today) ? <MissedCheckOut record={r} editable /> : fmtTime(r.checkOutAt)}
              </span>
              <span className="w-16 text-right tabular-nums text-xs text-subtle">{fmtDuration(r.checkInAt, r.checkOutAt)}</span>
            </div>
          ))}
        </div>
        <div className="h-2" />
      </Card>
    </div>
  );
}

function ProfileTab({ profile }) {
  const rows = [
    ["Phone", profile.phone],
    ["Date of birth", profile.dateOfBirth && fmtDate(profile.dateOfBirth)],
    ["Blood group", profile.bloodGroup],
    ["Address", profile.address],
  ];
  const emergency = [
    ["Name", profile.emergencyContactName],
    ["Relation", profile.emergencyContactRelation],
    ["Phone", profile.emergencyContactPhone],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <InfoCard title="Personal" icon={UserRound} rows={rows} />
      <InfoCard title="Emergency contact" icon={HeartPulse} rows={emergency} accent />
    </div>
  );
}

function InfoCard({ title, icon, rows, accent }) {
  return (
    <Card className={cn(accent && "border-rose-500/15")}>
      <CardHeader title={title} icon={icon} />
      <dl className="grid grid-cols-[140px_1fr] gap-y-3 px-5 pb-5 pt-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className={cn(!v && "text-subtle")}>
              {k === "Phone" && v ? (
                <a href={`tel:${v}`} className="inline-flex items-center gap-1.5 hover:text-brand-300">
                  <Phone className="size-3.5" /> {v}
                </a>
              ) : (
                v || "Not provided"
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

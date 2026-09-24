import Link from "@/components/link";
import { CalendarDays } from "lucide-react";
import { load } from "@/lib/api";
import { isYear, todayIso } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { YearCalendar } from "@/components/calendar";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Holidays" };

export default async function HolidaysPage({ searchParams }) {
  const sp = await searchParams;
  const today = todayIso();
  const year = isYear(sp.year) ? Number(sp.year) : Number(today.slice(0, 4));
  const [{ holidays }, config] = await Promise.all([load("/holidays", { query: { year } }), load("/config")]);

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title={`Holidays ${year}`}
        description="Company holidays for the year. Optional holidays still count as working days."
        actions={
          <div className="flex items-center gap-1 text-sm">
            <Link href={`?year=${year - 1}`} className="rounded-lg px-3 py-1.5 text-muted hover:bg-white/10 hover:text-fg">
              ← {year - 1}
            </Link>
            <Link href={`?year=${year + 1}`} className="rounded-lg px-3 py-1.5 text-muted hover:bg-white/10 hover:text-fg">
              {year + 1} →
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <YearCalendar year={year} holidays={Object.fromEntries(holidays.map((h) => [h.date, h]))} weekendDays={config.weekendDays} />
        </Card>
        <Card className="h-fit">
          <CardHeader title="List" subtitle={`${holidays.length} holidays`} icon={CalendarDays} />
          <ul className="mt-3 space-y-1 px-3 pb-4">
            {holidays.length === 0 && <EmptyState icon={CalendarDays} title="No holidays published yet" />}
            {holidays.map((h) => (
              <li key={h.id} className={`flex items-center gap-3 rounded-xl px-2 py-2 ${h.date < today ? "opacity-45" : ""}`}>
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

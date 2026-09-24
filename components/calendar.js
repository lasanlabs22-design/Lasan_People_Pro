// Hook-free so it renders on the server; pass `onSelect` only from a client component.
import Link from "@/components/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthCells, monthLabel, todayIso, weekday } from "@/lib/dates";
import { cn } from "./ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * @param month       "YYYY-MM"
 * @param holidays    { [iso]: { name, isOptional } }
 * @param events      { [iso]: [{ label, color, dashed }] }  — coloured chips (leaves, punches…)
 * @param weekendDays array of JS weekday numbers (0 = Sunday)
 */
export function MonthCalendar({ month, holidays = {}, events = {}, weekendDays = [0, 6], onSelect, selected, compact = false }) {
  const today = todayIso();
  const cells = monthCells(month);

  return (
    <div>
      <div className={cn("grid grid-cols-7 pb-2", compact ? "gap-1" : "gap-1 sm:gap-1.5")}>
        {WEEKDAYS.map((d) => (
          <div key={d} className={cn("text-center text-[10px] font-medium uppercase tracking-wider", d === "Sun" ? "text-rose-400" : "text-subtle")}>
            {compact ? d[0] : (
              <>
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className={cn("grid grid-cols-7", compact ? "gap-1" : "gap-1 sm:gap-1.5")}>
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />;
          const holiday = holidays[iso];
          const dayEvents = events[iso] ?? [];
          const weekend = weekendDays.includes(weekday(iso));
          const sunday = weekday(iso) === 0;
          const isToday = iso === today;
          const Tag = onSelect ? "button" : "div";
          return (
            <Tag
              key={iso}
              type={onSelect ? "button" : undefined}
              onClick={onSelect ? () => onSelect(iso) : undefined}
              title={[holiday?.name, ...dayEvents.map((e) => e.label)].filter(Boolean).join(" · ") || undefined}
              className={cn(
                "group relative flex flex-col border text-left transition-all",
                compact
                  ? "aspect-square items-center justify-center rounded-lg p-0.5"
                  : "min-h-14 items-center rounded-lg p-1 sm:min-h-24 sm:items-stretch sm:rounded-xl sm:p-2",
                holiday
                  ? "border-cyan-400/25 bg-cyan-400/[0.07]"
                  : sunday
                    ? "border-rose-500/20 bg-rose-500/[0.07]"
                    : weekend
                    ? "border-transparent bg-white/[0.015]"
                    : "border-white/[0.06] bg-white/[0.025]",
                onSelect && "cursor-pointer hover:border-brand-400/50 hover:bg-brand-500/10",
                selected === iso && "ring-2 ring-brand-400",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-full tabular-nums",
                  compact ? "size-5 text-[10px] sm:size-6 sm:text-xs" : "size-6 text-xs",
                  isToday
                    ? "bg-brand-500 font-semibold text-white shadow-glow"
                    : sunday
                      ? "font-medium text-rose-400"
                      : weekend
                        ? "text-subtle"
                        : "text-muted",
                )}
              >
                {Number(iso.slice(8))}
              </span>
              {compact ? (
                (holiday || dayEvents.length > 0) && (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {holiday && <span className="size-1 rounded-full bg-cyan-300" />}
                    {dayEvents.slice(0, 2).map((e, j) => (
                      <span key={j} className="size-1 rounded-full" style={{ background: e.color }} />
                    ))}
                  </span>
                )
              ) : (
                <>
                {/* Phones: colour bars only — labels are unreadable at this width (full text is in the title/tap). */}
                {(holiday || dayEvents.length > 0) && (
                  <span className="mt-1 flex w-full flex-col gap-0.5 px-0.5 sm:hidden">
                    {holiday && <span className="h-1 rounded-full bg-cyan-300" />}
                    {dayEvents.slice(0, 2).map((e, j) => (
                      <span
                        key={j}
                        className={cn("h-1 rounded-full", e.dashed && "border border-dashed bg-transparent")}
                        style={{ background: e.dashed ? undefined : e.color, borderColor: e.color }}
                      />
                    ))}
                  </span>
                )}
                <span className="mt-1 hidden min-w-0 flex-col gap-1 sm:flex">
                  {holiday && (
                    <span className="truncate rounded-md bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200">
                      {holiday.name}
                      {holiday.isOptional && " (opt.)"}
                    </span>
                  )}
                  {dayEvents.slice(0, 2).map((e, j) => (
                    <span
                      key={j}
                      className={cn("truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/90", e.dashed && "border border-dashed")}
                      style={{ background: e.dashed ? "transparent" : `${e.color}33`, borderColor: e.color, color: e.dashed ? e.color : undefined }}
                    >
                      {e.label}
                    </span>
                  ))}
                  {dayEvents.length > 2 && <span className="text-[10px] text-subtle">+{dayEvents.length - 2} more</span>}
                </span>
                </>
              )}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

/** Prev / next month links that keep other query params. */
export function MonthNav({ month, basePath, params = {} }) {
  const href = (m) => {
    const q = new URLSearchParams({ ...params, month: m });
    return `${basePath}?${q}`;
  };
  return (
    <div className="flex items-center gap-1">
      <Link href={href(addMonths(month, -1))} className="rounded-lg p-2 text-muted hover:bg-white/10 hover:text-fg" aria-label="Previous month">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 text-center font-display text-sm font-medium">{monthLabel(month)}</span>
      <Link href={href(addMonths(month, 1))} className="rounded-lg p-2 text-muted hover:bg-white/10 hover:text-fg" aria-label="Next month">
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", i.dashed && "border border-dashed bg-transparent")} style={{ background: i.dashed ? undefined : i.color, borderColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Twelve compact months for a year-at-a-glance view. */
export function YearCalendar({ year, holidays, events, weekendDays }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 xl:grid-cols-3">
      {Array.from({ length: 12 }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, "0")}`;
        return (
          <div key={month}>
            <p className="mb-2 font-display text-sm font-medium">{monthLabel(month, { month: "long" })}</p>
            <MonthCalendar month={month} holidays={holidays} events={events} weekendDays={weekendDays} compact />
          </div>
        );
      })}
    </div>
  );
}

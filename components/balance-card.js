import { fmtDays } from "@/lib/format";
import { cn } from "./ui";

/** Ring meter showing how much of a leave type is left. */
export function BalanceCard({ balance, footer, className }) {
  const { name, color, quota, used, pending, available, countsCalendarDays } = balance;
  const r = 30;
  const c = 2 * Math.PI * r;
  const usedFrac = quota ? Math.min(used / quota, 1) : 0;
  const pendingFrac = quota ? Math.min(pending / quota, 1 - usedFrac) : 0;

  return (
    <div className={cn("glass relative overflow-hidden rounded-2xl p-4 sm:p-5", className)}>
      <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <svg viewBox="0 0 80 80" className="size-16 shrink-0 -rotate-90 sm:size-20">
          <circle cx="40" cy="40" r={r} fill="none" className="stroke-white/10" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeOpacity="0.35"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(usedFrac + pendingFrac) * c} ${c}`}
          />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${usedFrac * c} ${c}`}
          />
          <text x="40" y="44" textAnchor="middle" className="rotate-90 origin-center fill-fg font-display text-[17px] font-semibold">
            {available % 1 ? available.toFixed(1) : available}
          </text>
        </svg>
        <div className="min-w-0 max-w-full">
          <p className="truncate text-sm font-medium sm:text-base">{name}</p>
          <p className="text-xs text-muted">
            {fmtDays(available)} left of {quota}
            {countsCalendarDays && " (calendar days)"}
          </p>
          <div className="mt-2 flex gap-3 text-[11px] text-subtle">
            <span>Used {used}</span>
            {pending > 0 && <span className="text-amber-300">Pending {pending}</span>}
          </div>
        </div>
      </div>
      {footer && <div className="relative mt-4">{footer}</div>}
    </div>
  );
}

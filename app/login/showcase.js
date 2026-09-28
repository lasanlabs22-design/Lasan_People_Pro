import { CalendarRange, KeyRound, Lock, MapPinned, ScanFace, ShieldCheck, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui";

// Left half of the sign-in page every customer sees: what the product does, in enterprise terms,
// with an abstract month calendar as its motif (no invented people or figures). Written as if for
// one organisation: nothing here hints that other companies use the same system. The trust points
// are only claims the system actually keeps (see the security review).

const CAPABILITIES = [
  {
    icon: ScanFace,
    title: "Face-capture check-in",
    text: "A live camera photo with every check-in and check-out, kept on record for review.",
  },
  { icon: MapPinned, title: "Geo-fenced attendance", text: "Punches verified against your office locations and radius." },
  { icon: CalendarRange, title: "Leave & holiday policy", text: "Quotas, approvals and one company calendar." },
  { icon: UsersRound, title: "Access control & audit trail", text: "Employees see only their own records; every change is logged." },
];

const TRUST = [
  { icon: Lock, label: "Encrypted connections" },
  { icon: KeyRound, label: "Protected sign-in" },
  { icon: ShieldCheck, label: "Every change logged" },
];

// Five weeks of a month, Monday first: p = present, l = leave, h = holiday, w = weekend, "" = outside the month.
const MONTH = [
  ["", "", "p", "p", "p", "w", "w"],
  ["p", "p", "l", "l", "p", "w", "w"],
  ["p", "h", "p", "p", "p", "w", "w"],
  ["p", "p", "p", "l", "p", "w", "w"],
  ["p", "p", "p", "", "", "", ""],
];
const CELL = {
  p: "bg-brand-500",
  l: "bg-cyan-400",
  h: "bg-amber-500",
  w: "bg-white/[0.07]",
  "": "",
};
const LEGEND = [
  ["bg-brand-500", "Present"],
  ["bg-cyan-400", "On leave"],
  ["bg-amber-500", "Holiday"],
  ["bg-white/[0.07]", "Weekend"],
];

function MonthMotif() {
  return (
    <div className="rounded-md border border-white/10 bg-ink-900 p-5 shadow-[var(--shadow-card)]" aria-hidden>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {MONTH.flat().map((k, i) => (
          <span key={i} className={cn("aspect-[5/3] rounded-sm", CELL[k])} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
        {LEGEND.map(([cls, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[2px]", cls)} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SignInShowcase() {
  return (
    <section className="relative hidden overflow-hidden border-r border-white/10 bg-ink-900 lg:flex lg:flex-col">
      <div className="flex flex-1 flex-col px-12 py-7 xl:px-16">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <ThemeToggle withLabel />
        </div>

        <div className="my-auto grid max-w-2xl gap-8 py-6 xl:grid-cols-[1fr_240px] xl:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">Workforce management</p>
            <h1 className="mt-2 text-[30px] font-semibold leading-[1.15] xl:text-[34px]">
              Attendance and leave, run the way your company runs.
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              One secure system for every employee, every office and every leave policy, with photo-verified
              attendance records your HR and finance teams can stand behind.
            </p>
          </div>
          <div className="hidden xl:block">
            <MonthMotif />
          </div>
        </div>

        <ul className="grid max-w-2xl gap-x-8 gap-y-5 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-brand-500/25 bg-brand-500/[0.07] text-brand-300">
                <Icon className="size-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/10 pt-4 text-xs">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5 font-medium text-muted">
                <Icon className="size-3.5 text-emerald-300" /> {label}
              </li>
            ))}
          </ul>
          <p className="text-subtle">© {new Date().getFullYear()} Lasan Labs</p>
        </div>
      </div>
    </section>
  );
}

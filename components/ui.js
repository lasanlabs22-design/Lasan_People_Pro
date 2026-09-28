// Presentational primitives: no hooks, safe in both server and client components.
import Link from "@/components/link";
import { initials } from "@/lib/format";

export const cn = (...c) => c.filter(Boolean).join(" ");

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-900 whitespace-nowrap";
const BTN_VARIANTS = {
  primary: "border-brand-500 bg-brand-500 text-on-brand hover:border-brand-600 hover:bg-brand-600",
  secondary: "border-white/25 bg-ink-900 text-fg hover:bg-white/[0.05]",
  ghost: "border-transparent text-muted hover:text-fg hover:bg-white/[0.06]",
  danger: "border-rose-500/40 bg-ink-900 text-rose-300 hover:bg-rose-500/10",
  success: "border-emerald-500/40 bg-ink-900 text-emerald-300 hover:bg-emerald-500/10",
};
const BTN_SIZES = { sm: "h-8 px-3 text-xs", md: "h-9 px-4", lg: "h-11 px-6 text-base" };

export function buttonClass({ variant = "primary", size = "md", className } = {}) {
  return cn(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], className);
}

export function Button({ variant, size, className, ...props }) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}

export function LinkButton({ variant, size, className, ...props }) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn("glass rounded-2xl", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-500/10 text-brand-300">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  );
}

const TONES = {
  slate: "bg-white/[0.06] text-muted border-white/10",
  brand: "bg-brand-500/15 text-brand-300 border-brand-500/30",
  emerald: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  rose: "bg-rose-500/12 text-rose-300 border-rose-500/25",
  cyan: "bg-cyan-500/12 text-cyan-300 border-cyan-500/25",
  pink: "bg-pink-500/12 text-pink-300 border-pink-500/25",
};

export function Badge({ tone = "slate", dot, className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-semibold capitalize",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ src, name, size = 40, className }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- data URLs; next/image adds nothing here
    return <img src={src} alt={name ?? ""} style={style} className={cn("shrink-0 rounded-full object-cover ring-1 ring-white/15", className)} />;
  }
  return (
    <span
      style={style}
      aria-label={name}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-500 font-semibold text-on-brand",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Stars({ value = 0, size = 16, className }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value ?? 0} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, (value ?? 0) - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <StarSvg size={size} className="absolute inset-0 text-white/15" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <StarSvg size={size} className="text-amber-500" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function StarSvg({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
    </svg>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, accent = "brand" }) {
  const accents = {
    brand: "border-t-brand-500 text-brand-300",
    emerald: "border-t-emerald-500 text-emerald-300",
    amber: "border-t-amber-500 text-amber-300",
    cyan: "border-t-cyan-400 text-cyan-300",
    rose: "border-t-rose-500 text-rose-300",
  };
  const [bar, tone] = accents[accent].split(" ");
  return (
    <Card className={cn("relative overflow-hidden border-t-[3px] p-4 sm:p-5", bar)}>
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold sm:text-3xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn("hidden size-9 shrink-0 place-items-center rounded-md sm:grid bg-white/[0.04]", tone)}>
            <Icon className="size-5" />
          </span>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-muted">
          <Icon className="size-5" />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-fg">
      <span>{children}</span>
      {hint && <span className="font-normal text-subtle">{hint}</span>}
    </label>
  );
}

/** Label + control + error. `error` comes from the API's `fields` map. */
export function Field({ label, name, error, hint, className, children }) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={name} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

export function Input({ className, error, ...props }) {
  return <input id={props.name} aria-invalid={error ? true : undefined} className={cn("field", className)} {...props} />;
}

export function Select({ className, error, children, ...props }) {
  return (
    <select id={props.name} aria-invalid={error ? true : undefined} className={cn("field", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, error, ...props }) {
  return <textarea id={props.name} aria-invalid={error ? true : undefined} className={cn("field min-h-24 resize-y", className)} {...props} />;
}

export function Alert({ tone = "rose", children, className }) {
  if (!children) return null;
  const tones = {
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    brand: "border-brand-500/30 bg-brand-500/10 text-brand-50",
  };
  return (
    <div role={tone === "rose" ? "alert" : "status"} className={cn("rounded-md border border-l-4 px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function Table({ children, className }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }) {
  return <th className={cn("whitespace-nowrap bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-muted", className)}>{children}</th>;
}

export function Td({ children, className }) {
  return <td className={cn("px-5 py-3.5 align-middle", className)}>{children}</td>;
}

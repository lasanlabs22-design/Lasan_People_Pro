import { cn } from "./ui";

export function Logo({ className, withText = true }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-600 to-cyan-500 shadow-glow">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 4v12a4 4 0 0 0 4 4h10" />
          <circle cx="16" cy="9" r="3" />
        </svg>
      </span>
      {withText && (
        <span className="font-display text-[17px] font-semibold tracking-tight">
          Lasan<span className="text-muted font-normal"> People</span>
          <span className="ml-1.5 inline-block rounded-md bg-gradient-to-r from-brand-400 to-cyan-400 px-1.5 py-0.5 align-[2px] text-[10px] font-bold uppercase tracking-wider text-ink-950">
            Pro
          </span>
        </span>
      )}
    </span>
  );
}

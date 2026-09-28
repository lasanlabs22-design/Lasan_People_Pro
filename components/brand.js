import { cn } from "./ui";

export function Logo({ className, withText = true }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 place-items-center rounded-md bg-brand-500">
        <svg viewBox="0 0 24 24" className="size-5 text-on-brand" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 4v12a4 4 0 0 0 4 4h10" />
          <circle cx="16" cy="9" r="3" />
        </svg>
      </span>
      {withText && (
        <span className="text-[17px] font-semibold">
          Lasan<span className="text-muted font-normal"> People</span>
          <span className="ml-1.5 inline-block rounded-sm border border-brand-500 px-1 py-px align-[2px] text-[10px] font-bold uppercase tracking-wider text-brand-300">
            Pro
          </span>
        </span>
      )}
    </span>
  );
}

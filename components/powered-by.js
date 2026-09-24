import { cn } from "./ui";

/** Footer credit shown at the bottom of every page. */
export function PoweredBy({ className }) {
  return (
    <footer className={cn("flex items-center justify-center gap-1.5 py-6 text-xs text-subtle", className)}>
      <span>Powered by</span>
      <span className="font-display font-semibold tracking-tight text-gradient">Lasan Labs</span>
    </footer>
  );
}

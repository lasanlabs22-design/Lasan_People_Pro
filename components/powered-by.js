import { cn } from "./ui";

/** Footer credit shown at the bottom of every page. */
export function PoweredBy({ className }) {
  return (
    // Baseline, not centre: the two words use different fonts, so centring their boxes left
    // "Lasan Labs" sitting higher than "Powered by".
    <footer className={cn("flex items-baseline justify-center gap-1.5 py-6 text-xs text-subtle", className)}>
      <span>Powered by</span>
      <span className="lasan-signature font-semibold">Lasan Labs</span>
    </footer>
  );
}

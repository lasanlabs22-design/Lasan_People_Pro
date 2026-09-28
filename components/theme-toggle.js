"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/theme";
import { cn } from "./ui";

const subscribe = (onChange) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.dataset.theme === "dark";

export function ThemeToggle({ className, withLabel = false }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !dark;
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // Storage blocked (private window): the theme still switches for this visit.
    }
  }

  const label = dark ? "Switch to white theme" : "Switch to black theme";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-white/15 bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-white/[0.05] hover:text-fg",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {withLabel && <span>{dark ? "White theme" : "Black theme"}</span>}
    </button>
  );
}

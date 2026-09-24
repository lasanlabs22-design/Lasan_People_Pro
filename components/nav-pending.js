"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * Put inside a <Link>. While that link's page is opening, shows the glowing bar at the top of
 * the screen and, with `spinner`, a small spinner in place. Both fade in after a short delay,
 * so fast navigations don't flash.
 */
export function NavPending({ spinner = false, className }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span className="nav-progress" aria-hidden />
      {spinner && (
        <Loader2
          aria-hidden
          className={`size-3.5 shrink-0 animate-spin text-brand-300 opacity-0 [animation:spin_1s_linear_infinite,nav-progress-in_0.2s_ease_80ms_forwards] ${className ?? ""}`}
        />
      )}
    </>
  );
}

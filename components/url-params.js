"use client";

import { useEffect } from "react";

/**
 * Drops a one-shot query param (?new=1 that opened a dialog, ?welcome=1 after first sign-in)
 * once it has done its job, so a refresh or a shared link doesn't replay it. Next.js keeps its
 * router in sync with history.replaceState.
 */
export function useConsumeSearchParam(name, present) {
  useEffect(() => {
    if (!present) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(name);
    window.history.replaceState(null, "", url);
  }, [name, present]);
}

export function ConsumeSearchParam({ name }) {
  useConsumeSearchParam(name, true);
  return null;
}

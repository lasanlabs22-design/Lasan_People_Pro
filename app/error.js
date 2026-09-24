"use client";

import { RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui";
import { PoweredBy } from "@/components/powered-by";

export default function Error({ error, reset }) {
  return (
    <main className="flex min-h-dvh flex-col px-5">
      <div className="glass m-auto max-w-md rounded-2xl p-8 text-center">
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
          <ServerCrash className="size-5" />
        </span>
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          {error?.message?.includes("reach the") ? error.message : "We couldn't load this page. It's usually temporary."}
        </p>
        <Button className="mt-6" onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </div>
      <PoweredBy />
    </main>
  );
}

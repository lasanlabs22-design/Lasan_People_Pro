export function PageSkeleton() {
  const block = "rounded-2xl bg-white/[0.04] animate-pulse";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 rounded bg-white/[0.05] animate-pulse" />
        <div className="h-8 w-72 rounded-lg bg-white/[0.06] animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-28 ${block}`} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className={`h-80 ${block}`} />
        <div className={`h-80 ${block}`} />
      </div>
    </div>
  );
}

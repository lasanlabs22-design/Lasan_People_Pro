// Shared rendering for the legal pages: a title block, a table of contents and numbered sections.
// Each section is { id, title, body: [paragraph | { list: [...] }] }.
export function LegalDocument({ eyebrow, title, updated, intro, sections }) {
  return (
    <article>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-subtle">Last updated: {updated}</p>
      <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-muted">
        {intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <nav className="mt-8 rounded-md border border-white/10 bg-white/[0.02] p-5" aria-label="Contents">
        <p className="text-sm font-semibold">Contents</p>
        <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1.5 pl-5 text-sm sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-brand-300 hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((s, n) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className="text-xl font-semibold">
              {n + 1}. {s.title}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">
              {s.body.map((b, i) =>
                typeof b === "string" ? (
                  <p key={i}>{b}</p>
                ) : (
                  <ul key={i} className="list-disc space-y-1.5 pl-5">
                    {b.list.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

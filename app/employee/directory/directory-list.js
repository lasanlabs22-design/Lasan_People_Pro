"use client";

import { useMemo, useState } from "react";
import { Mail, Search, UsersRound } from "lucide-react";
import { Badge, Card, EmptyState, cn } from "@/components/ui";
import { initials } from "@/lib/format";

const ALL = "";

export function DirectoryList({ people, meId }) {
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState(ALL);

  const departments = useMemo(
    () => [...new Set(people.map((p) => p.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [people],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter(
      (p) =>
        (department === ALL || p.department === department) &&
        (!needle ||
          [p.name, p.email, p.employeeCode, p.designation, p.department].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [people, q, department]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            id="directory-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, ID, title or department"
            aria-label="Search the directory"
            className="field pl-9"
          />
        </div>
        {departments.length > 0 && (
          <select
            id="directory-department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Filter by department"
            className="field sm:w-60"
          >
            <option value={ALL}>All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-3 text-sm text-muted">
        {shown.length === people.length ? `${people.length} people` : `${shown.length} of ${people.length} people`}
      </p>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={UsersRound} title="No one matches" description="Try a different name or clear the department filter." />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full items-start gap-3.5 p-4">
                <Photo person={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-semibold">{p.name}</p>
                    {p.id === meId && <Badge tone="brand">You</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted">{p.designation || (p.role === "admin" ? "Administrator" : "Team member")}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
                    {p.department && <span className="rounded-sm bg-white/[0.05] px-1.5 py-0.5 text-muted">{p.department}</span>}
                    <span className="font-mono">{p.employeeCode}</span>
                  </p>
                  <a
                    href={`mailto:${p.email}`}
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm text-brand-300 hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </a>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Photos load one by one as they scroll into view; people without one get their initials.
function Photo({ person }) {
  const [failed, setFailed] = useState(false);
  const base = "size-12 shrink-0 rounded-full";
  if (person.hasPhoto && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own route; next/image adds nothing here
      <img
        src={`/profile-photo/${person.id}`}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(base, "object-cover ring-1 ring-white/15")}
      />
    );
  }
  return <span className={cn(base, "grid place-items-center bg-brand-500 text-sm font-semibold text-on-brand")}>{initials(person.name)}</span>;
}

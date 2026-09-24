"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

/** Filters the list as you type (after a short pause); Enter still searches right away. */
export function EmployeeSearch({ q, status }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();
  const timer = useRef(null);

  const search = (next) => {
    clearTimeout(timer.current);
    const params = new URLSearchParams({ q: next.trim(), status });
    startTransition(() => router.replace(`/admin/employees?${params}`, { scroll: false }));
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <form
      role="search"
      className="relative w-full sm:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        search(value);
      }}
    >
      {/* Same top-of-screen bar the app shows for link navigations. */}
      {pending && <span className="nav-progress" aria-hidden />}
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle" />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      )}
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(next), 300);
        }}
        placeholder="Search name, ID, email, team…"
        aria-label="Search employees"
        className="field pl-9"
      />
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";

/** Date input that navigates to ?date=… as soon as a day is picked. */
export function DateJump({ value, max }) {
  const router = useRouter();
  return (
    <input
      type="date"
      aria-label="Pick a date"
      defaultValue={value}
      max={max}
      onChange={(e) => e.target.value && router.push(`?date=${e.target.value}`)}
      className="field h-9 w-40 py-1"
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { SubmitButton, useFormAction } from "./client";
import { Alert, Field, Input, Select, Textarea, cn } from "./ui";
import { fmtDays } from "@/lib/format";
import { todayIso } from "@/lib/dates";

/**
 * Leave type + dates + reason, with a live "this uses N days" preview.
 * Employees apply through it (minDate = today); admins record leave on someone's behalf (any date).
 */
export function LeaveForm({ balances, onDone, submit, preview: previewFn, minDate, submitLabel = "Submit request", reasonPlaceholder }) {
  const today = todayIso();
  const [form, setForm] = useState({ leaveTypeId: balances[0]?.leaveTypeId ?? "", startDate: today, endDate: today, halfDay: "none" });
  // Each preview remembers the inputs it was computed for, so an answer for
  // the previous dates is never shown as if it were for the current ones.
  const [preview, setPreview] = useState(null);
  const formKey = JSON.stringify(form);
  const current =
    form.startDate && form.endDate && form.endDate < form.startDate
      ? { ok: false, error: "The end date must be on or after the start date" }
      : preview?.key === formKey
        ? preview
        : null;
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await submit(prev, fd);
    if (res.ok) onDone();
    return res;
  });

  const type = balances.find((b) => b.leaveTypeId === form.leaveTypeId);
  const single = form.startDate === form.endDate;
  const set = (k) => (e) =>
    setForm((f) => {
      const next = { ...f, [k]: e.target.value };
      if (k === "startDate" && next.endDate < next.startDate) next.endDate = next.startDate;
      if (next.startDate !== next.endDate) next.halfDay = "none";
      return next;
    });

  // Ask the API how many days this will cost (skips weekends/holidays) as the form changes.
  useEffect(() => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate || form.endDate < form.startDate) return;
    let stale = false;
    const key = JSON.stringify(form);
    const t = setTimeout(async () => {
      const res = await previewFn(form);
      if (!stale) setPreview({ ...res, key });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [form, previewFn]);

  // The dry run already knows this would be refused (past dates, overlap, not enough balance…).
  const blocked = Boolean(current && (!current.ok || !current.sufficient));
  const f = state?.fields ?? {};
  if (balances.length === 0) return <Alert tone="amber">No leave types are available yet. Contact your admin.</Alert>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert>{state?.error}</Alert>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">Leave type</legend>
        <div className="grid grid-cols-2 gap-2">
          {balances.map((b) => (
            <label
              key={b.leaveTypeId}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-colors",
                form.leaveTypeId === b.leaveTypeId ? "border-transparent" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
              )}
              style={form.leaveTypeId === b.leaveTypeId ? { background: `${b.color}1f`, boxShadow: `inset 0 0 0 1.5px ${b.color}` } : undefined}
            >
              <input type="radio" name="leaveTypeId" value={b.leaveTypeId} checked={form.leaveTypeId === b.leaveTypeId} onChange={set("leaveTypeId")} className="sr-only" />
              <span className="block text-sm font-medium">{b.name}</span>
              <span className="text-xs text-muted">{fmtDays(b.available)} left</span>
            </label>
          ))}
        </div>
        {f.leaveTypeId && <p className="mt-1.5 text-xs text-rose-300">{f.leaveTypeId}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From" name="startDate" error={f.startDate}>
          <Input name="startDate" type="date" required min={minDate} value={form.startDate} onChange={set("startDate")} error={f.startDate} />
        </Field>
        <Field label="To" name="endDate" error={f.endDate}>
          <Input name="endDate" type="date" required min={form.startDate} value={form.endDate} onChange={set("endDate")} error={f.endDate} />
        </Field>
      </div>

      {single && type?.allowHalfDay && (
        <Field label="Duration" name="halfDay" error={f.halfDay}>
          <Select name="halfDay" value={form.halfDay} onChange={set("halfDay")}>
            <option value="none">Full day</option>
            <option value="first_half">First half</option>
            <option value="second_half">Second half</option>
          </Select>
        </Field>
      )}
      {!(single && type?.allowHalfDay) && <input type="hidden" name="halfDay" value="none" />}

      <div
        aria-live="polite"
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
          blocked ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-brand-500/25 bg-brand-500/10 text-brand-50",
        )}
      >
        {current ? <Info className="size-4 shrink-0" /> : <Loader2 className="size-4 shrink-0 animate-spin" />}
        <span>
          {!current
            ? "Calculating…"
            : current.ok
              ? current.sufficient
                ? `This uses ${fmtDays(current.days)} · ${fmtDays(current.available - current.days)} will remain`
                : `This needs ${fmtDays(current.days)} but only ${fmtDays(current.available)} are available`
              : current.error}
        </span>
      </div>

      <Field label="Reason" name="reason" error={f.reason}>
        <Textarea name="reason" required minLength={3} placeholder={reasonPlaceholder} error={f.reason} />
      </Field>

      <SubmitButton pending={pending} className="w-full" pendingText="Submitting…" disabled={blocked}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

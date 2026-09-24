"use client";

import { useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { deleteHoliday, saveHoliday } from "@/app/actions/admin";
import { ActionButton, Modal, SubmitButton, useFormAction } from "@/components/client";
import { Legend, MonthCalendar, MonthNav } from "@/components/calendar";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { todayIso } from "@/lib/dates";

export function HolidayPlanner({ month, holidays, weekendDays }) {
  const [editing, setEditing] = useState(null); // { date, holiday? }
  const byDate = Object.fromEntries(holidays.map((h) => [h.date, h]));
  const year = month.slice(0, 4);
  const today = todayIso();
  const upcoming = holidays.filter((h) => h.date >= today).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card className="p-5 animate-fade-up">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Legend items={[{ label: "Holiday", color: "#67e8f9" }]} />
          <MonthNav month={month} basePath="/admin/holidays" />
        </div>
        <MonthCalendar
          month={month}
          holidays={byDate}
          weekendDays={weekendDays}
          onSelect={(date) => setEditing({ date, holiday: byDate[date] })}
          selected={editing?.date}
        />
      </Card>

      <Card className="h-fit">
        <CardHeader
          title={`${year} holidays`}
          subtitle={`${holidays.length} total · ${upcoming} upcoming`}
          icon={CalendarDays}
          action={
            <Button size="sm" onClick={() => setEditing({ date: `${month}-01` })}>
              <Plus className="size-3.5" /> Add
            </Button>
          }
        />
        <ul className="mt-3 max-h-[560px] space-y-1 overflow-y-auto px-3 pb-4">
          {holidays.length === 0 && <EmptyState icon={CalendarDays} title="No holidays yet" description="Pick a date on the calendar to add one." />}
          {holidays.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => setEditing({ date: h.date, holiday: h })}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04] ${h.date < today ? "opacity-50" : ""}`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-center leading-tight">
                  <span className="font-display text-sm font-semibold text-cyan-200">{h.date.slice(8)}</span>
                  <span className="text-[9px] uppercase text-cyan-200/70">{fmtDate(h.date, { month: "short" })}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.name}</span>
                  <span className="block text-xs text-muted">{fmtDate(h.date, { weekday: "long" })}</span>
                </span>
                {h.isOptional && <Badge>Optional</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.holiday ? "Edit holiday" : "Add holiday"}
        description={editing && fmtDate(editing.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      >
        {editing && <HolidayForm key={editing.date} {...editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function HolidayForm({ date, holiday, onDone }) {
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await saveHoliday(holiday?.id ?? null, prev, fd);
    if (res.ok) onDone();
    return res;
  });
  const f = state?.fields ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Field label="Name" name="name" error={f.name}>
        <Input name="name" required autoFocus defaultValue={holiday?.name} placeholder="Diwali" error={f.name} />
      </Field>
      <Field label="Date" name="date" error={f.date}>
        <Input name="date" type="date" required defaultValue={date} error={f.date} />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
        <input type="checkbox" name="isOptional" defaultChecked={holiday?.isOptional} className="mt-0.5 size-4 accent-brand-500" />
        <span>
          Optional / restricted holiday
          <span className="block text-xs text-muted">Shown on calendars but still counted as a working day for leave.</span>
        </span>
      </label>
      <div className="flex gap-2">
        <SubmitButton pending={pending} className="flex-1" pendingText="Saving…">
          {holiday ? "Save changes" : "Add holiday"}
        </SubmitButton>
        {holiday && (
          <ActionButton
            variant="danger"
            action={deleteHoliday.bind(null, holiday.id)}
            confirmText={`Delete ${holiday.name}?`}
            onDone={onDone}
            aria-label={`Delete ${holiday.name}`}
            title="Delete holiday"
          >
            <Trash2 className="size-4" />
          </ActionButton>
        )}
      </div>
    </form>
  );
}

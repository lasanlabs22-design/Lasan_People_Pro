"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Camera, CameraOff, KeyRound, Pencil, ShieldOff, ShieldCheck, SlidersHorizontal } from "lucide-react";
import {
  previewRecordedLeave,
  rateEmployee,
  recordLeave,
  reinstateEmployee,
  resetEmployeePassword,
  revokeEmployee,
  setAllocation,
  setPhotoPunch,
  updateEmployee,
} from "@/app/actions/admin";
import { ActionButton, Modal, SubmitButton, useFormAction } from "@/components/client";
import { CredentialsCard } from "@/components/credentials";
import { LeaveForm } from "@/components/leave-form";
import { Alert, Button, Field, Input, Textarea, cn } from "@/components/ui";
import { EmployeeFields } from "../add-employee";

export function AccessActions({ employee }) {
  const [editOpen, setEditOpen] = useState(false);
  const [creds, setCreds] = useState(null);
  const active = employee.status === "active";

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="size-3.5" /> Edit
      </Button>
      <ActionButton
        variant="secondary"
        size="sm"
        action={resetEmployeePassword.bind(null, employee.id)}
        confirmText={`Reset ${employee.name}'s password? They'll be signed out everywhere.`}
        onDone={(res) => setCreds(res)}
      >
        <KeyRound className="size-3.5" /> Reset password
      </ActionButton>
      {employee.role !== "admin" &&
        (employee.photoPunch ? (
          <ActionButton
            variant="success"
            size="sm"
            action={setPhotoPunch.bind(null, employee.id, false)}
            confirmText={`Stop requiring a photo from ${employee.name}? They'll punch with location only.`}
            title="Photo punch is on: every check-in and check-out needs a live camera photo"
          >
            <Camera className="size-3.5" /> Photo punch on
          </ActionButton>
        ) : (
          <ActionButton
            variant="secondary"
            size="sm"
            action={setPhotoPunch.bind(null, employee.id, true)}
            confirmText={`Require ${employee.name} to take a live camera photo at every check-in and check-out?`}
            title="Require a live camera photo at every check-in and check-out"
          >
            <CameraOff className="size-3.5" /> Photo punch off
          </ActionButton>
        ))}
      {active ? (
        <ActionButton
          variant="danger"
          size="sm"
          action={revokeEmployee.bind(null, employee.id)}
          confirmText={`Revoke ${employee.name}'s access? They'll be signed out immediately and pending requests will be cancelled.`}
        >
          <ShieldOff className="size-3.5" /> Revoke access
        </ActionButton>
      ) : (
        <ActionButton variant="success" size="sm" action={reinstateEmployee.bind(null, employee.id)}>
          <ShieldCheck className="size-3.5" /> Reinstate
        </ActionButton>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit employee">
        {editOpen && <EditForm employee={employee} onDone={() => setEditOpen(false)} />}
      </Modal>
      <Modal open={!!creds} onClose={() => setCreds(null)} title="New temporary password">
        {creds && (
          <CredentialsCard name={employee.name} workspace={creds.workspace} loginId={employee.employeeCode} password={creds.tempPassword} />
        )}
      </Modal>
    </div>
  );
}

function EditForm({ employee, onDone }) {
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await updateEmployee(employee.id, prev, fd);
    if (res.ok) onDone();
    return res;
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <EmployeeFields state={state} defaults={employee} />
      <SubmitButton pending={pending} className="w-full" pendingText="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function RatingForm({ employeeId }) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await rateEmployee(employeeId, prev, fd);
    if (res.ok) {
      setScore(0);
      setFormKey((k) => k + 1);
    }
    return res;
  });
  const f = state?.fields ?? {};
  const shown = hover || score;
  const LABELS = ["", "Needs improvement", "Below expectations", "Meets expectations", "Exceeds expectations", "Outstanding"];

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-4">
      <Alert>{state?.error}</Alert>
      {state?.ok && <Alert tone="emerald">Rating saved.</Alert>}
      <input type="hidden" name="score" value={score} />
      <div>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setScore(i)}
              onMouseEnter={() => setHover(i)}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              className="rounded-md p-0.5 transition-transform hover:scale-110"
            >
              <svg viewBox="0 0 24 24" className={cn("size-8 transition-colors", i <= shown ? "text-amber-300 drop-shadow-[0_0_8px_rgb(252_211_77/0.6)]" : "text-white/15")} fill="currentColor">
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
              </svg>
            </button>
          ))}
        </div>
        <p className="mt-1.5 h-4 text-xs text-muted">{LABELS[shown]}</p>
        {f.score && <p className="text-xs text-rose-300">{f.score}</p>}
      </div>
      <Field label="Period" name="period" error={f.period} hint="YYYY, YYYY-MM or YYYY-Q1">
        <Input name="period" defaultValue={currentPeriod()} required error={f.period} />
      </Field>
      <Field label="Comment" name="comment" hint="Optional">
        <Textarea name="comment" placeholder="What went well, what to work on…" />
      </Field>
      <SubmitButton pending={pending} disabled={!score} className="w-full" pendingText="Saving…">
        Save rating
      </SubmitButton>
    </form>
  );
}

/** Log leave for an employee who asks — including days already taken. Saved as approved. */
export function RecordLeave({ employeeId, employeeName, balances, disabled }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const submit = useMemo(() => recordLeave.bind(null, employeeId), [employeeId]);
  const preview = useMemo(() => previewRecordedLeave.bind(null, employeeId), [employeeId]);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <CalendarPlus className="size-3.5" /> Record leave
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Record leave for ${employeeName}`}
        description="For leave the employee asked you to log, including past days. It's saved as approved and deducted from their balance."
      >
        <LeaveForm
          key={key}
          balances={balances}
          onDone={() => setOpen(false)}
          submit={submit}
          preview={preview}
          submitLabel="Record approved leave"
          reasonPlaceholder="e.g. Sick on Monday, told us by phone"
        />
      </Modal>
    </>
  );
}

export function AllocationEditor({ employeeId, year, balance }) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await setAllocation(employeeId, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  });
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-brand-300"
      >
        <SlidersHorizontal className="size-3" />
        {balance.overridden ? "Custom quota · adjust" : "Adjust quota"}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${balance.name} quota for ${year}`}
        description="Override the company default for this employee, e.g. pro-rata for mid-year joiners. Leave blank to reset."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Alert>{state?.error}</Alert>
          <input type="hidden" name="leaveTypeId" value={balance.leaveTypeId} />
          <input type="hidden" name="year" value={year} />
          <Field label="Days" name="days" error={state?.fields?.days}>
            <Input name="days" type="number" step="0.5" min="0" max="366" defaultValue={balance.overridden ? balance.quota : ""} placeholder={`Default: ${balance.quota}`} />
          </Field>
          <Field label="Note" name="note" hint="Optional">
            <Input name="note" placeholder="Joined mid-year" />
          </Field>
          <SubmitButton pending={pending} className="w-full">
            Save quota
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}

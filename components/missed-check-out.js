"use client";

import { useState } from "react";
import { Clock3 } from "lucide-react";
import { setCheckOut } from "@/app/actions/admin";
import { fmtDate, fmtTime } from "@/lib/format";
import { Alert, Badge, Field, Input } from "./ui";
import { Modal, SubmitButton, useFormAction } from "./client";

/** "Missed check-out" badge; admins can click it to record the time the employee left. */
export function MissedCheckOut({ record, editable }) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await setCheckOut(record.id, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  });

  if (!editable) return <Badge tone="amber" className="normal-case!">Missed check-out</Badge>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        title="Set the check-out time"
      >
        <Badge tone="amber" className="cursor-pointer normal-case! hover:brightness-125">
          Missed check-out · set
        </Badge>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Set check-out time"
        description={`${fmtDate(record.date, { weekday: "long", day: "numeric", month: "long" })} · checked in at ${fmtTime(record.checkInAt)}`}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Alert>{state?.error}</Alert>
          <Field label="Checked out at" name="time" error={state?.fields?.time} hint="Office time zone">
            <Input name="time" type="time" required error={state?.fields?.time} />
          </Field>
          <SubmitButton pending={pending} className="w-full" pendingText="Saving…">
            <Clock3 className="size-4" /> Save check-out
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}

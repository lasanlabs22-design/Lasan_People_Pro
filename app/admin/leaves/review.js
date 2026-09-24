"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { approveLeave, rejectLeave } from "@/app/actions/admin";
import { Modal, SubmitButton, useFormAction } from "@/components/client";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { fmtDays, fmtRange } from "@/lib/format";

export function ReviewButtons({ leave }) {
  const [mode, setMode] = useState(null);
  const close = () => setMode(null);
  const summary = `${leave.employee.name} · ${leave.leaveType.name} · ${fmtRange(leave.startDate, leave.endDate)} (${fmtDays(leave.days)})`;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="success" onClick={() => setMode("approve")}>
          <Check className="size-4" /> Approve
        </Button>
        <Button variant="danger" onClick={() => setMode("reject")}>
          <X className="size-4" /> Reject
        </Button>
      </div>
      <Modal open={mode === "approve"} onClose={close} title="Approve leave" description={summary}>
        {mode === "approve" && <ReviewForm leave={leave} kind="approve" onDone={close} />}
      </Modal>
      <Modal open={mode === "reject"} onClose={close} title="Reject leave" description={summary}>
        {mode === "reject" && <ReviewForm leave={leave} kind="reject" onDone={close} />}
      </Modal>
    </>
  );
}

function ReviewForm({ leave, kind, onDone }) {
  const approve = kind === "approve";
  const [state, onSubmit, pending] = useFormAction(async (prev, fd) => {
    const res = await (approve ? approveLeave : rejectLeave)(leave.id, prev, fd);
    if (res.ok) onDone();
    return res;
  });
  const name = approve ? "comment" : "reason";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Field label={approve ? "Comment" : "Reason for rejection"} name={name} hint={approve ? "Optional" : "Required · shown to the employee"} error={state?.fields?.[name]}>
        <Textarea
          name={name}
          required={!approve}
          minLength={approve ? undefined : 3}
          autoFocus
          placeholder={approve ? "Enjoy your time off!" : "e.g. Release week — could you move this to the following week?"}
          error={state?.fields?.[name]}
        />
      </Field>
      <SubmitButton pending={pending} variant={approve ? "primary" : "danger"} className="w-full" pendingText={approve ? "Approving…" : "Rejecting…"}>
        {approve ? "Approve request" : "Reject request"}
      </SubmitButton>
    </form>
  );
}

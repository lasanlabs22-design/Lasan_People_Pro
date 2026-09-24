"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { applyLeave, previewLeave } from "@/app/actions/employee";
import { Modal } from "@/components/client";
import { LeaveForm } from "@/components/leave-form";
import { Button } from "@/components/ui";
import { todayIso } from "@/lib/dates";

export function ApplyLeave({ balances, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [key, setKey] = useState(0);
  return (
    <>
      <Button
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <CalendarPlus className="size-4" /> Apply for leave
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Apply for leave"
        description="Your admin will be notified and can approve or reject it. For days you've already taken, ask your admin to record them."
      >
        <LeaveForm
          key={key}
          balances={balances}
          onDone={() => setOpen(false)}
          submit={applyLeave}
          preview={previewLeave}
          minDate={todayIso()}
          reasonPlaceholder="A short note for your admin"
        />
      </Modal>
    </>
  );
}

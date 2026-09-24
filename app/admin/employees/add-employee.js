"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { createEmployee } from "@/app/actions/admin";
import { Modal, SubmitButton, useFormAction } from "@/components/client";
import { CredentialsCard } from "@/components/credentials";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function AddEmployee({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  // Remount the form on each open so the last result doesn't linger.
  const [key, setKey] = useState(0);
  return (
    <>
      <Button
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <UserPlus className="size-4" /> Add employee
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add employee" description="They'll get a login ID and a temporary password.">
        <AddEmployeeForm key={key} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function EmployeeFields({ state, defaults = {} }) {
  const f = state?.fields ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" name="name" error={f.name} className="sm:col-span-2">
        <Input name="name" required defaultValue={defaults.name} placeholder="Priya Sharma" error={f.name} />
      </Field>
      <Field label="Employee ID" name="employeeCode" error={f.employeeCode} hint="Used to sign in">
        <Input name="employeeCode" required defaultValue={defaults.employeeCode} placeholder="LS001" className="font-mono uppercase" error={f.employeeCode} />
      </Field>
      <Field label="Gender" name="gender" error={f.gender} hint="Decides leave eligibility">
        <Select name="gender" required defaultValue={defaults.gender ?? ""} error={f.gender}>
          <option value="" disabled>
            Select…
          </option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Work email" name="email" error={f.email} className="sm:col-span-2">
        <Input name="email" type="email" required defaultValue={defaults.email} placeholder="priya@lasan.in" error={f.email} />
      </Field>
      <Field label="Designation" name="designation" error={f.designation}>
        <Input name="designation" defaultValue={defaults.designation ?? ""} placeholder="Software Engineer" />
      </Field>
      <Field label="Department" name="department" error={f.department}>
        <Input name="department" defaultValue={defaults.department ?? ""} placeholder="Engineering" />
      </Field>
      <Field label="Date of joining" name="dateOfJoining" error={f.dateOfJoining}>
        <Input name="dateOfJoining" type="date" defaultValue={defaults.dateOfJoining ?? ""} error={f.dateOfJoining} />
      </Field>
    </div>
  );
}

function AddEmployeeForm({ onDone }) {
  const [state, onSubmit, pending] = useFormAction(createEmployee);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <CredentialsCard
          name={state.employee.name}
          workspace={state.workspace}
          loginId={state.employee.employeeCode}
          password={state.tempPassword}
        />
        <Button variant="ghost" className="w-full" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  const f = state?.fields ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <EmployeeFields state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Access" name="role">
          <Select name="role" defaultValue="employee">
            <option value="employee">Employee</option>
            <option value="admin">Administrator</option>
          </Select>
        </Field>
        <Field label="Temporary password" name="password" error={f.password} hint="Optional">
          <Input name="password" placeholder="Auto-generate" autoComplete="off" error={f.password} />
        </Field>
      </div>
      <SubmitButton pending={pending} className="w-full" pendingText="Creating…">
        Create & get login
      </SubmitButton>
    </form>
  );
}

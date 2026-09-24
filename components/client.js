"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { Button, cn } from "./ui";

/**
 * useActionState wired through onSubmit instead of <form action>, so React
 * doesn't reset the fields — a validation error keeps what the user typed.
 * When a submit comes back with an error, the message is scrolled into view:
 * in a tall dialog it would otherwise sit above the fold and the button would
 * look like it did nothing.
 */
export function useFormAction(fn, initial = null) {
  const [state, dispatch, pending] = useActionState(fn, initial);
  const formRef = useRef(null);
  const onSubmit = (e) => {
    e.preventDefault();
    formRef.current = e.currentTarget;
    const fd = new FormData(e.currentTarget, e.nativeEvent.submitter);
    startTransition(() => dispatch(fd));
  };
  useEffect(() => {
    if (!state || state.ok !== false) return;
    const target = formRef.current?.querySelector('[role="alert"], [aria-invalid="true"]');
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);
  return [state, onSubmit, pending];
}

export function SubmitButton({ children, pendingText, pending: pendingProp, disabled, ...props }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function Modal({ open, onClose, title, description, children, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose?.()}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-0 text-fg shadow-2xl backdrop:bg-transparent open:animate-fade-up",
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/**
 * One-click server action button with optional confirm() and inline error.
 * `action` is a bound server action returning { ok, error }.
 */
export function ActionButton({ action, confirmText, children, onDone, ...props }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const res = await action();
            if (res && res.ok === false) setError(res.error);
            else onDone?.(res);
          });
        }}
        {...props}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {children}
      </Button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </span>
  );
}

"use client";

import { useState } from "react";
import { fmtDate, fmtTime } from "@/lib/format";
import { Modal } from "./client";
import { cn } from "./ui";

const LABEL = { in: "Check-in", out: "Check-out" };
export const photoUrl = (record, kind) => `/attendance-photo/${record.id}/${kind}`;

/** Small in/out selfie thumbnails for an attendance row; click one to see it full size. */
export function PunchPhotos({ record, size = 28, className }) {
  const [open, setOpen] = useState(null);
  const kinds = record?.photos ?? [];
  if (!kinds.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => setOpen(k)}
          title={`${LABEL[k]} photo`}
          className="shrink-0 overflow-hidden rounded-md ring-1 ring-white/15 transition hover:ring-brand-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          style={{ width: size, height: size }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private, session-authenticated image */}
          <img src={photoUrl(record, k)} alt={`${LABEL[k]} photo`} loading="lazy" className="size-full object-cover" />
        </button>
      ))}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${LABEL[open]} photo` : ""}
        description={
          open &&
          `${fmtDate(record.date, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(open === "in" ? record.checkInAt : record.checkOutAt)}`
        }
      >
        {open && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, session-authenticated image */}
            <img src={photoUrl(record, open)} alt={`${LABEL[open]} photo`} className="w-full rounded-xl border border-white/10" />
            {kinds.length > 1 && (
              <div className="flex justify-center gap-2">
                {kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOpen(k)}
                    className={cn("rounded-lg px-3 py-1.5 text-xs", k === open ? "bg-white/10 text-fg" : "text-muted hover:text-fg")}
                  >
                    {LABEL[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </span>
  );
}

"use client";

import { useState } from "react";
import { updateDeliveryMode } from "@/app/dashboard/admin/courses/[id]/roster-actions";
import { DELIVERY_MODE_OPTIONS, DELIVERY_MODE_IMPACT, type DeliveryMode } from "@/lib/delivery-mode";

const TONE_CLASS: Record<"default" | "warning" | "danger", string> = {
  default: "text-ink",
  warning: "text-status-warning-text",
  danger: "text-destructive",
};

// design_handoff_trainer_roster, "Delivery mode card": a segmented control
// in a cream tray, one-line note below that follows the mode. Picking a
// segment stages the change; it is only written on Save, with the same
// "what this sets" panel Course Admin shows -- "changing it after setup is
// a real change, not a cosmetic edit" (delivery-mode-picker.tsx), so one
// stray click never re-modes a running course.
export function DeliveryModeCard({ courseId, savedMode }: { courseId: string; savedMode: DeliveryMode }) {
  const [mode, setMode] = useState<DeliveryMode>(savedMode);
  const dirty = mode !== savedMode;
  const option = DELIVERY_MODE_OPTIONS.find((o) => o.value === mode) ?? DELIVERY_MODE_OPTIONS[0];
  const impact = DELIVERY_MODE_IMPACT[mode];

  return (
    <form action={updateDeliveryMode} className="sheet flex flex-col gap-3 px-6 py-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink-warm">Delivery mode</h2>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="delivery_mode" value={mode} />
      <div className="flex gap-1.5 rounded-[10px] bg-card-inset p-1" role="radiogroup" aria-label="Delivery mode">
        {DELIVERY_MODE_OPTIONS.map((o) => {
          const active = o.value === mode;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(o.value)}
              className={`h-8 flex-1 rounded-[7px] text-[12.5px] font-semibold transition-colors ${
                active ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-[12.5px] leading-[1.45] text-muted">{option.description}</p>

      {dirty ? (
        <>
          <div
            className={`flex flex-col gap-2 rounded-[8px] border px-3.5 py-3 ${
              impact.tone === "warning" ? "border-status-warning-text/40 bg-status-warning-bg" : "border-border bg-card-inset"
            }`}
          >
            <p className={`text-[11px] font-semibold tracking-[0.09em] uppercase ${impact.tone === "warning" ? "text-status-warning-text" : "text-muted"}`}>
              {impact.heading}
            </p>
            <div className="flex flex-col gap-1.5">
              {impact.rows.map((row) => (
                <div key={row.what} className="flex items-start gap-2.5">
                  <span className={`w-[100px] shrink-0 text-[11px] font-semibold ${TONE_CLASS[row.tone]}`}>{row.what}</span>
                  <span className="text-xs leading-relaxed text-ink">{row.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setMode(savedMode)} className="text-[12.5px] text-muted hover:text-ink">
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-[8px] px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-[filter] hover:brightness-110"
              style={{ background: "var(--hub-accent)" }}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted">You can change this until the timetable is locked.</p>
      )}
    </form>
  );
}

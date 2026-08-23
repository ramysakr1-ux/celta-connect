"use client";

import { useActionState, useState, useTransition } from "react";
import { updateProvisionalGrade, approveProvisionalGrade, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { PROVISIONAL_SLOTS } from "@/lib/provisional-grade";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

function slotFromRecord(record: Celta5Record | null): string {
  if (!record?.provisional_grade) return "";
  return record.provisional_grade_upper
    ? `${record.provisional_grade}/${record.provisional_grade_upper}`
    : record.provisional_grade;
}

export function ProvisionalGradeForm({
  traineeId,
  record,
  proposedByName,
  isMct,
}: {
  traineeId: string;
  record: Celta5Record | null;
  proposedByName: string | null;
  isMct: boolean;
}) {
  const [state, action, pending] = useActionState(updateProvisionalGrade, initialState);
  const [slot, setSlot] = useState(() => slotFromRecord(record));
  const [approvePending, startApprove] = useTransition();
  const approved = Boolean(record?.provisional_approved_at);

  return (
    <div className="flex flex-col gap-2 rounded-[6px] border border-border-faint p-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="trainee_id" value={traineeId} />
        <input type="hidden" name="provisional_slot" value={slot} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Provisional grade</span>
          {PROVISIONAL_SLOTS.map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={slot === opt}
              onClick={() => setSlot((prev) => (prev === opt ? "" : opt))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                slot === opt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted trainer-hover hover:text-ink"
              }`}
            >
              {opt}
            </button>
          ))}
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainer-hover disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>

      {record?.provisional_grade ? (
        <div className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint bg-surface-muted/40 px-3 py-2">
          <span className="text-xs text-ink">
            {proposedByName ? `Proposed by ${proposedByName}` : "Proposed"}
          </span>
          {isMct ? (
            <button
              type="button"
              disabled={approved || approvePending}
              onClick={() => {
                const fd = new FormData();
                fd.set("trainee_id", traineeId);
                startApprove(async () => {
                  await approveProvisionalGrade(fd);
                });
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold disabled:cursor-default ${
                approved ? "bg-primary/10 text-primary" : "bg-status-warning-bg text-status-warning-text hover:bg-status-warning-bg/80"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {approvePending ? "Approving…" : approved ? "MCT approved" : "Awaiting MCT approval — approve"}
            </button>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                approved ? "bg-primary/10 text-primary" : "bg-status-warning-bg text-status-warning-text"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {approved ? "MCT approved" : "Awaiting MCT approval"}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { setProvisionalGradesDueDate, type FormState } from "@/app/dashboard/trainer/celta5-actions";

const initialState: FormState = { error: null };

function formatDue(dueAt: string | null): string {
  if (!dueAt) return "";
  return new Date(dueAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// MCT sets this directly from the real timetable -- not computed from the
// assessor visit date. Ramy, 2026-08-17: "the assessor visit falls on a bun
// day... maybe Friday will be appropriate, but maybe it doesn't."
export function ProvisionalDeadlineBanner({ dueAt, isMct, approvedCount, totalCount }: { dueAt: string | null; isMct: boolean; approvedCount: number; totalCount: number }) {
  const [state, action, pending] = useActionState(setProvisionalGradesDueDate, initialState);
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 rounded-[6px] border border-gold/30 bg-gold/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink">
          {dueAt ? `Provisional grades due to the assessor — ${formatDue(dueAt)}` : "Provisional grades due date not set yet"}
        </p>
        {isMct ? (
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs font-medium text-primary hover:underline">
            {editing ? "Cancel" : dueAt ? "Change date" : "Set date"}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Each TP tutor proposes for their own group, the MCT proposes for theirs, then the MCT approves all before
        it&apos;s sent and recorded on the assessor visit page.
        {totalCount > 0 ? ` ${approvedCount} of ${totalCount} MCT-approved.` : ""}
      </p>
      {isMct && editing ? (
        <form action={action} className="mt-1 flex items-center gap-2">
          <input
            type="date"
            name="due_date"
            defaultValue={dueAt ? dueAt.slice(0, 10) : ""}
            className="h-8 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-8 rounded-[6px] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}

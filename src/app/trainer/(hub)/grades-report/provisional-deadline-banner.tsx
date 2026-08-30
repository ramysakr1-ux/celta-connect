"use client";

import { useActionState, useState } from "react";
import { setProvisionalGradesDueDate, type FormState } from "@/app/dashboard/trainer/celta5-actions";

const initialState: FormState = { error: null };

function formatDue(dueAt: string | null): string {
  if (!dueAt) return "";
  return new Date(dueAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// The MCT still sets this. Ramy, 2026-08-17: "the assessor visit falls on a
// bank holiday... maybe Friday will be appropriate, but maybe it doesn't" --
// so it was left entirely manual, and the consequence was that most courses
// had no date at all.
//
// His Grades Report design then stated a rule: "two days before the 30 Nov
// visit (the prior Friday when that lands on a weekend)". Both hold at once
// if the rule only fills a blank -- a date the MCT typed always wins, and a
// course that would otherwise show nothing gets the derivable answer,
// labelled as derived so nobody mistakes it for something the centre agreed
// with its assessor. See src/lib/provisional-deadline.ts.
export function ProvisionalDeadlineBanner({
  dueAt,
  derived,
  isMct,
  approvedCount,
  totalCount,
}: {
  dueAt: string | null;
  derived?: boolean;
  isMct: boolean;
  approvedCount: number;
  totalCount: number;
}) {
  const [state, action, pending] = useActionState(setProvisionalGradesDueDate, initialState);
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 rounded-[6px] border border-status-warning-text/30 bg-status-warning-bg px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink">
          {dueAt ? `Provisional grades due to the assessor — ${formatDue(dueAt)}` : "Provisional grades due date not set yet"}
        </p>
        {dueAt && derived ? (
          <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">
            Suggested
          </span>
        ) : null}
        {isMct ? (
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs font-medium text-primary hover:underline">
            {editing ? "Cancel" : dueAt ? "Change date" : "Set date"}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        {derived && dueAt
          ? "Two working days before the assessor visit — nobody has set a date, so this is the working assumption until someone does. "
          : ""}
        Each TP tutor proposes for their own half, the MCT proposes for theirs, then the MCT confirms them all before
        it&apos;s sent and recorded on the assessor visit page.
        {totalCount > 0 ? ` ${approvedCount} of ${totalCount} confirmed by the MCT.` : ""}
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

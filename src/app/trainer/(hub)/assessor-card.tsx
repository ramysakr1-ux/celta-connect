"use client";

import { useActionState, useState } from "react";
import { updateAssessorContact, type AssessorContactState } from "@/app/trainer/assessor-actions";

const initialState: AssessorContactState = { error: null };

// for-claude-code-course-admin-landing-and-admissions.md §4: the MCT-side
// half of the shared assessor field -- Course Admin's own Assessor card
// (dashboard/admin/courses/[id]/page.tsx) writes the same columns. Whoever
// sets it first is what the other side sees; this card just lets the MCT
// confirm/correct it and add the visit date once they know it, mirroring
// FeedbackAssistCard's edit/display toggle -- including holding the
// editable fields in local state rather than the initial* props, since
// after a save there is no server round-trip that re-renders this client
// component with fresh props.
export function AssessorCard({
  initialName,
  initialEmail,
  initialVisitDate,
}: {
  initialName: string | null;
  initialEmail: string | null;
  initialVisitDate: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [visitDate, setVisitDate] = useState(initialVisitDate ?? "");
  const [state, formAction, pending] = useActionState<AssessorContactState, FormData>(async (_prev, formData) => {
    const result = await updateAssessorContact(_prev, formData);
    if (!result.error) setEditing(false);
    return result;
  }, initialState);

  return (
    <div className="flex flex-col gap-4 rounded-[8px] border border-border border-t-[3px] border-t-gold bg-card px-[22px] py-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Assessor</p>
          <p className="text-xs leading-[1.5] text-muted text-pretty">
            Shared with Course Admin -- whichever side sets this first is what the other sees.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (editing) {
              setName(initialName ?? "");
              setEmail(initialEmail ?? "");
              setVisitDate(initialVisitDate ?? "");
            }
            setEditing((v) => !v);
          }}
          className="trainer-hover-fill h-8 shrink-0 rounded-[6px] border border-border bg-card px-3.5 text-[12.5px] font-medium text-ink"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        <form action={formAction} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="mct_assessor_name" className="text-[11px] text-muted">
              Name
            </label>
            <input
              id="mct_assessor_name"
              name="assessor_name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="mct_assessor_email" className="text-[11px] text-muted">
              Email
            </label>
            <input
              id="mct_assessor_email"
              name="assessor_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="mct_assessor_visit_date" className="text-[11px] text-muted">
              Visit date (if known)
            </label>
            <input
              id="mct_assessor_visit_date"
              name="assessor_visit_date"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          <div className="mt-1 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="h-[30px] rounded-[6px] bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-1 text-[12.5px] leading-[1.5]">
          <p className="text-ink">{name || <span className="text-muted italic">Not set yet</span>}</p>
          {email ? <p className="text-muted">{email}</p> : null}
          <p className="text-muted">{visitDate ? `Visit date: ${visitDate}` : "Visit date not set yet."}</p>
        </div>
      )}
    </div>
  );
}

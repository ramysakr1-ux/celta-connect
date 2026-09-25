"use client";

import { useActionState } from "react";
import { updateFinalReportFields, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { CopyField } from "@/app/trainer/(hub)/grades-report/report-cards";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

/* The two headings here are Appian's own, read off the centre's screen on
   25 Sep 2026 -- not the Handbook's, which calls the first "update on
   strengths and areas for development". Appian says "action points", and the
   form a centre fills in wins. The evidence heading is deliberately NOT the
   provisional one: "evidence NEEDED for a Pass / Higher Grade" before the
   assessment, "what evidence WAS PROVIDED for a Higher Grade" after it.
   Ramy, same day: "just get everything from Appian, don't worry about the
   handbook." */
const initialState: FormState = { error: null };

// Plain textareas here, not the tone-rewriting one used elsewhere in the
// trainer hub. Ramy, 30 Aug 2026: "we also don't need the direct tone,
// supportive tone here -- this is between trainers and assessors." The tone
// rewriter exists for feedback a candidate reads.

// The right-hand column of the Grade form -- everything the ASSESSOR submits,
// as opposed to the left column, which the centre submits.
//
// That split is not a layout choice. The Appian User Guidelines' process flow
// has the centre submit the Centre Grade form with the provisionals 2-3 days
// before the visit, and the assessor submit the Assessor Report with the
// final grades after the course ends. Handbook 14.4 is what passes between
// them: "The course tutor must contact the assessor to confirm the final
// recommended grade for each candidate, providing an update on strengths and
// areas for development for each candidate and a rationale for each final
// grade."
//
// Three fields, and one copy button rather than three, because 14.4 has the
// tutor hand all of it over in a single contact.
export function FinalReportFields({
  record,
  editable,
  isBorderline,
}: {
  record: Celta5Record;
  editable: boolean;
  /** Handbook 15.2's "borderline" -- see the call site for what counts. */
  isBorderline: boolean;
}) {
  const [state, action, pending] = useActionState(updateFinalReportFields, initialState);

  // Both columns exist in the database (0255, 0257) but not in the generated
  // types -- the codebase's established pattern for a migration Ramy runs by
  // hand is to cast at the read site rather than hand-edit generated types.
  const r = record as Celta5Record & {
    final_update_notes?: string | null;
    final_higher_grade_evidence?: string | null;
  };
  const update = r.final_update_notes ?? "";
  const evidence = r.final_higher_grade_evidence ?? "";

  // What the assessor pastes: the whole hand-over, in the order 14.4 lists
  // it, with only the parts that exist.
  const handover = [
    record.final_recommended_grade ? `RECOMMENDED GRADE: ${record.final_recommended_grade}` : null,
    update ? `UPDATE ON STRENGTHS AND AREAS FOR DEVELOPMENT:\n${update}` : null,
    isBorderline && evidence ? `WHAT EVIDENCE WAS PROVIDED FOR A PASS/HIGHER:\n${evidence}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!editable) {
    // The assessor's own read of it. Nothing here is theirs to edit, and the
    // copy button is the point: this is the material that goes into their
    // Appian report.
    return (
      <div className="flex flex-col gap-3.5 rounded-[6px] border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-label font-bold tracking-[0.1em] text-gold uppercase">Recommended grade</span>
          {record.final_recommended_grade ? (
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-label font-bold text-card">
              {record.final_recommended_grade}
            </span>
          ) : (
            <span className="text-meta text-muted italic">Not yet recorded</span>
          )}
        </div>
        <ReadBlock label="Update on strengths and action points" value={update} required />
        {isBorderline ? (
          <ReadBlock label="What evidence was provided for a Higher Grade (if applicable)" value={evidence} />
        ) : null}
        {handover ? (
          <div className="flex justify-start">
            <CopyField value={handover} label="Copy for the Assessor Report" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5 rounded-[6px] border border-border bg-card p-5">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />

      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`grd-${record.trainee_id}`} className="text-label font-bold tracking-[0.1em] text-gold uppercase">
          Recommended grade
        </label>
        <select
          id={`grd-${record.trainee_id}`}
          name="final_recommended_grade"
          defaultValue={record.final_recommended_grade ?? ""}
          className="appearance-none rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-center text-meta text-ink outline-none focus:border-primary"
        >
          <option value="">Not yet decided</option>
          <option value="Pass">Pass</option>
          <option value="Pass B">Pass B</option>
          <option value="Pass A">Pass A</option>
          <option value="Fail">Fail</option>
          <option value="Withdrawn">Withdrawn</option>
          <option value="Extension">Extension</option>
          <option value="Deferral">Deferral</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`upd-${record.trainee_id}`} className="text-label font-bold tracking-[0.1em] text-gold uppercase">
          Update on strengths and action points
        </label>
        <p className="text-label leading-[1.45] text-muted">
          Required on the Assessor Report for every candidate &mdash; including extensions, deferrals and withdrawals
          (Handbook 15.2).
        </p>
        <textarea
          id={`upd-${record.trainee_id}`}
          name="final_update_notes"
          rows={5}
          defaultValue={update}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-meta text-ink outline-none focus:border-primary"
        />
      </div>

      {/* Appian puts this beside the update, on every candidate, and lets its
          own "(if applicable)" do the conditional work -- so it is shown here
          the same way rather than gated on a borderline (Ramy, 25 Sep 2026:
          same structure, same logic as the form). The hint still says when it
          is wanted, so a straight pass leaves it empty. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`evi-${record.trainee_id}`} className="text-label font-bold tracking-[0.1em] text-gold uppercase">
          What evidence was provided for a Higher Grade (if applicable)
        </label>
        <p className="text-label leading-[1.45] text-muted">
          {isBorderline
            ? "Answers the conditions set at the provisional stage \u2014 this candidate was borderline, so the final grade needs a recorded justification."
            : "Leave empty where the grade did not move."}
        </p>
        <textarea
          id={`evi-${record.trainee_id}`}
          name="final_higher_grade_evidence"
          rows={3}
          defaultValue={evidence}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-meta text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-body text-destructive">{state.error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        {handover ? <CopyField value={handover} label="Copy for the Assessor Report" /> : <span />}
        <button
          type="submit"
          disabled={pending}
          className="wash self-start rounded-[6px] border border-border px-3 py-1.5 text-meta text-ink disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function ReadBlock({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label font-bold tracking-[0.1em] text-gold uppercase">{label}</span>
      {value ? (
        <p className="rounded-[6px] border border-border bg-card-inset px-3 py-2.5 text-meta leading-[1.55] whitespace-pre-wrap text-ink">
          {value}
        </p>
      ) : (
        <p className="text-meta text-muted italic">
          {required ? "Not written yet -- Appian will not accept the report without it." : "Not written yet."}
        </p>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { updateFinalReportFields, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { CopyField } from "@/app/trainer/(hub)/grades-report/report-cards";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

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
  const rationale = record.overall_notes ?? "";

  // What the assessor pastes: the whole hand-over, in the order 14.4 lists
  // it, with only the parts that exist.
  const handover = [
    record.final_recommended_grade ? `RECOMMENDED GRADE: ${record.final_recommended_grade}` : null,
    update ? `UPDATE ON STRENGTHS AND AREAS FOR DEVELOPMENT:\n${update}` : null,
    isBorderline && evidence ? `WHAT EVIDENCE WAS PROVIDED FOR A PASS/HIGHER:\n${evidence}` : null,
    rationale ? `RATIONALE:\n${rationale}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!editable) {
    // The assessor's own read of it. Nothing here is theirs to edit, and the
    // copy button is the point: this is the material that goes into their
    // Appian report.
    return (
      <div className="flex flex-col gap-3.5 rounded-[6px] border border-border bg-card p-5">
        <ReadBlock label="Update on strengths and areas for development" value={update} required />
        {isBorderline ? (
          <ReadBlock label="What evidence was provided for a pass/higher" value={evidence} />
        ) : null}
        <ReadBlock label="Rationale for the final grade" value={rationale} />
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`upd-${record.trainee_id}`} className="text-[11px] font-bold tracking-[0.1em] text-gold uppercase">
          Update on strengths and areas for development
        </label>
        <p className="text-[11px] leading-[1.45] text-muted">
          Required on the Assessor Report for every candidate &mdash; including extensions, deferrals and withdrawals
          (Handbook 15.2).
        </p>
        <textarea
          id={`upd-${record.trainee_id}`}
          name="final_update_notes"
          rows={5}
          defaultValue={update}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>

      {isBorderline ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`evi-${record.trainee_id}`} className="text-[11px] font-bold tracking-[0.1em] text-gold uppercase">
            What evidence was provided for a pass/higher
          </label>
          <p className="text-[11px] leading-[1.45] text-muted">
            Answers the conditions set at the provisional stage. Optional in Appian, but 15.2 asks for it on any borderline
            candidate so the final grade has a recorded justification.
          </p>
          <textarea
            id={`evi-${record.trainee_id}`}
            name="final_higher_grade_evidence"
            rows={3}
            defaultValue={evidence}
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
      ) : (
        /* Not borderline, so the field is not asked for -- but the value must
           still survive a save, or a candidate who was borderline and later
           was not would silently lose what the tutor wrote. */
        <input type="hidden" name="final_higher_grade_evidence" value={evidence} />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`rat-${record.trainee_id}`} className="text-[11px] font-bold tracking-[0.1em] text-gold uppercase">
          Rationale for the final grade
        </label>
        <p className="text-[11px] leading-[1.45] text-muted">
          Handbook 14.4 asks for one per candidate. Enforced here only on a slashed grade.
        </p>
        <textarea
          id={`rat-${record.trainee_id}`}
          name="overall_notes"
          rows={3}
          defaultValue={rationale}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        {handover ? <CopyField value={handover} label="Copy for the Assessor Report" /> : <span />}
        <button
          type="submit"
          disabled={pending}
          className="trainer-hover-fill self-start rounded-[6px] border border-border px-3 py-1.5 text-[13px] text-ink disabled:opacity-60"
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
      <span className="text-[11px] font-bold tracking-[0.1em] text-gold uppercase">{label}</span>
      {value ? (
        <p className="rounded-[6px] border border-border bg-card-inset px-3 py-2.5 text-[12px] leading-[1.55] whitespace-pre-wrap text-ink">
          {value}
        </p>
      ) : (
        <p className="text-[12px] text-muted italic">
          {required ? "Not written yet -- Appian will not accept the report without it." : "Not written yet."}
        </p>
      )}
    </div>
  );
}

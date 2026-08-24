"use client";

import { useActionState, useState } from "react";
import { saveConcernNote, openCase, type FormState } from "@/app/trainer/(hub)/malpractice/actions";

const initialState: FormState = { error: null };

// Verbatim from Malpractice.dc.html's own KINDS constant, not paraphrased.
const KINDS = [
  {
    value: "unattributed_source",
    label: "Unattributed source",
    hint: "Text taken from a book, website or model answer without acknowledgement.",
  },
  {
    value: "collaboration",
    label: "Collaboration beyond preparation",
    hint: "Two submissions substantially similar. Joint preparation and discussion are allowed; substantially similar assignments are not.",
  },
  {
    value: "undeclared_ai",
    label: "Undeclared AI use",
    hint: "Generated text where no declaration was made, or the conversation cannot be produced.",
  },
  { value: "other", label: "Something else", hint: "Impersonation, falsified attendance, or anything not covered above." },
] as const;

// Malpractice.dc.html "1b Raising it" -- the manual concern-intake step,
// separate from FindingsBand's per-scanner-finding "Open a case" button
// (that one already has its own matched-passage context and doesn't need
// this form layered on top). Two buttons share one set of fields: "Save as
// a note, no case" (saveConcernNote, stays on this page) and "Open a case"
// (openCase, navigates to the new case's record page) -- each its own
// useActionState so pending/error track independently even though both
// read the same kind/findings.
export function RaiseConcernForm({
  assignmentId,
  round,
  ownSubmissionLabel,
  aiDeclared,
}: {
  assignmentId: string;
  round: "first" | "resubmission";
  ownSubmissionLabel: string;
  aiDeclared: boolean;
}) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"] | "">("");
  const [noteState, noteAction, notePending] = useActionState(saveConcernNote, initialState);
  const [caseState, caseAction, casePending] = useActionState(openCase, initialState);

  if (noteState.saved) {
    return (
      <div className="sheet flex flex-col gap-1">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Concern noted</p>
        <p className="text-sm text-muted">
          Saved against this assignment. No case was opened, and nothing else changed.
        </p>
      </div>
    );
  }

  return (
    <form className="sheet flex flex-col gap-4">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="kind" value={kind} />

      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Raise a concern</p>
        <p className="text-xs text-muted">Most concerns turn out to be nothing -- save a note if you're not sure, or open a case if you are.</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">What kind of concern is this?</p>
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`flex flex-col gap-0.5 rounded-[6px] border p-3 text-left ${
              kind === k.value ? "border-primary bg-accent/30" : "border-border hover:border-primary/50"
            }`}
          >
            <span className="text-sm font-medium text-ink">{k.label}</span>
            <span className="text-xs text-muted">{k.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">What have you found?</label>
        <textarea
          name="findings"
          rows={4}
          className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          placeholder="What you noticed, and where..."
        />
      </div>

      <div className="flex flex-col gap-1.5 rounded-[6px] border border-border-faint bg-surface-muted/40 p-3">
        <p className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">Evidence</p>
        <p className="text-xs text-ink">{ownSubmissionLabel}</p>
        <p className="text-xs text-ink">AI declaration: {aiDeclared ? "used" : "not used"}</p>
      </div>

      {noteState.error ? <p className="text-sm text-destructive">{noteState.error}</p> : null}
      {caseState.error ? <p className="text-sm text-destructive">{caseState.error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          formAction={noteAction}
          disabled={notePending || casePending || !kind}
          className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          {notePending ? "Saving…" : "Save as a note, no case"}
        </button>
        <button
          type="submit"
          formAction={caseAction}
          disabled={notePending || casePending || !kind}
          className="rounded-[6px] bg-destructive px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {casePending ? "Opening…" : "Open a case"}
        </button>
      </div>
    </form>
  );
}

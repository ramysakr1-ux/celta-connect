"use client";

import { useActionState, useState } from "react";
import { recordCandidateAccount, decideCase, type FormState } from "@/app/trainer/(hub)/malpractice/actions";

const initialState: FormState = { error: null };

export function CandidateAccountForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(recordCandidateAccount, initialState);
  return (
    <form action={action} className="sheet flex flex-col gap-3">
      <input type="hidden" name="case_id" value={caseId} />
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Candidate&apos;s account</p>
      <p className="text-xs text-muted">
        Put to the candidate in person, not by a status changing overnight. Record what they said, in their own
        words -- a case cannot be decided without it.
      </p>
      <textarea
        name="candidate_account"
        rows={6}
        required
        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        placeholder="What the candidate said, in their own words..."
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save account"}
      </button>
    </form>
  );
}

export function DecisionForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(decideCase, initialState);
  const [outcome, setOutcome] = useState<"upheld" | "not_upheld" | "">("");

  return (
    <form action={action} className="sheet flex flex-col gap-3">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="outcome" value={outcome} />
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Decision</p>
      <p className="text-xs text-muted">
        The decision comes from your own malpractice policy -- Connect never invents a penalty.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOutcome("not_upheld")}
          className={`rounded-[6px] border p-3 text-left text-sm font-medium ${
            outcome === "not_upheld" ? "border-primary bg-accent/30 text-ink" : "border-border text-ink hover:border-primary/50"
          }`}
        >
          Not upheld
          <span className="mt-1 block text-xs font-normal text-muted">
            Leaves no other mark -- marking resumes normally on the original submission.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOutcome("upheld")}
          className={`rounded-[6px] border p-3 text-left text-sm font-medium ${
            outcome === "upheld" ? "border-destructive bg-destructive/10 text-ink" : "border-border text-ink hover:border-primary/50"
          }`}
        >
          Upheld
          <span className="mt-1 block text-xs font-normal text-muted">
            Fails the assignment (their one resubmission chance, or a hard fail if already spent) and creates the
            Plagiarism Reflection task.
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Decision notes</label>
        <textarea
          name="decision_notes"
          rows={4}
          className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          placeholder="Which policy clause, and why -- this is what goes in the case record."
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending || !outcome}
        className={`self-start rounded-[6px] px-4 py-2 text-sm font-medium text-card disabled:opacity-60 ${
          outcome === "upheld" ? "bg-destructive" : "bg-primary"
        }`}
      >
        {pending ? "Recording…" : "Record decision"}
      </button>
    </form>
  );
}

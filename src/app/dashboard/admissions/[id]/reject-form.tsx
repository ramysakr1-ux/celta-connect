"use client";

import { useActionState, useState } from "react";
import { rejectApplicant, type FormState } from "@/app/dashboard/admissions/actions";

const initialState: FormState = { error: null };

// "Both require a human-written reason before they can be sent, and
// neither is ever generated." Sending the actual email is Phase E; this
// records the decision and the reason now.
export function RejectForm({ applicantId }: { applicantId: string }) {
  const [state, action, pending] = useActionState(rejectApplicant, initialState);
  const [stage, setStage] = useState<"rejected_before_interview" | "rejected_after_interview">("rejected_before_interview");

  return (
    <form action={action} className="card flex flex-col gap-3 p-6">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <h2 className="font-serif text-lg text-ink">Reject</h2>
      <div className="flex gap-4 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="stage"
            value="rejected_before_interview"
            checked={stage === "rejected_before_interview"}
            onChange={() => setStage("rejected_before_interview")}
          />
          Before interview
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="stage"
            value="rejected_after_interview"
            checked={stage === "rejected_after_interview"}
            onChange={() => setStage("rejected_after_interview")}
          />
          After interview
        </label>
      </div>
      <textarea
        name="rejection_reason"
        rows={3}
        required
        placeholder="Name the specific gap. The applicant may ask, and the assessor may look."
        className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-60 admin-hover-fill"
      >
        {pending ? "Saving..." : "Record rejection"}
      </button>
    </form>
  );
}

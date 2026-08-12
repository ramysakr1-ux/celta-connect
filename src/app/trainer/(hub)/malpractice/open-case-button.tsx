"use client";

import { useActionState } from "react";
import { openCase, type FormState } from "@/app/trainer/(hub)/malpractice/actions";

const initialState: FormState = { error: null };

export function OpenCaseButton({
  assignmentId,
  round,
  findingId,
}: {
  assignmentId: string;
  round: "first" | "resubmission";
  findingId?: string;
}) {
  const [state, action, pending] = useActionState(openCase, initialState);

  return (
    <form action={action} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="round" value={round} />
      {findingId ? <input type="hidden" name="finding_id" value={findingId} /> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open a plagiarism case"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

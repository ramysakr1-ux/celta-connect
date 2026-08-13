"use client";

import { useActionState } from "react";
import { generateGradeQueryReply, type FormState } from "@/app/trainer/(hub)/grade-query-reply/actions";

const initialState: FormState = { error: null };

export function GenerateReplyButton({ traineeId }: { traineeId: string }) {
  const [state, action, pending] = useActionState(generateGradeQueryReply, initialState);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Assembling evidence..." : "Generate a new reply"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

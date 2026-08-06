"use client";

import { useActionState } from "react";
import { assignTpRound, type FormState } from "@/app/trainer/(hub)/rotation/actions";

const initialState: FormState = { error: null };

export function AssignButton({ subgroupId, tpNumber }: { subgroupId: string; tpNumber: number }) {
  const [state, action, pending] = useActionState(assignTpRound, initialState);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="subgroup_id" value={subgroupId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] border border-primary px-3 py-1 text-sm font-medium text-primary disabled:opacity-60"
      >
        {pending ? "Assigning..." : `Assign TP${tpNumber}`}
      </button>
      {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
    </form>
  );
}

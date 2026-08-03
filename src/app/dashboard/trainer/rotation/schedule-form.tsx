"use client";

import { useActionState } from "react";
import { setTpSchedule, type FormState } from "@/app/dashboard/trainer/rotation-actions";

const initialState: FormState = { error: null };

export function ScheduleForm({
  tpNumber,
  coursebooks,
  currentCoursebookId,
}: {
  tpNumber: number;
  coursebooks: { id: string; title: string; level: string }[];
  currentCoursebookId: string | null;
}) {
  const [state, action, pending] = useActionState(setTpSchedule, initialState);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="tp_number" value={tpNumber} />
      <span className="w-14 text-ink">TP{tpNumber}</span>
      <select
        name="tp_coursebook_id"
        defaultValue={currentCoursebookId ?? ""}
        className="flex-1 appearance-none rounded-[6px] border border-border bg-card px-2 py-1 text-center text-sm text-ink outline-none focus:border-primary"
      >
        <option value="">No coursebook scheduled</option>
        {coursebooks.map((cb) => (
          <option key={cb.id} value={cb.id}>
            {cb.title} ({cb.level})
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] bg-primary px-3 py-1 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
    </form>
  );
}

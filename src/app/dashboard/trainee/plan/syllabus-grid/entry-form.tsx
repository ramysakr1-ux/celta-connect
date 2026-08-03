"use client";

import { useActionState } from "react";
import { saveSyllabusPlanningEntry, type FormState } from "@/app/dashboard/trainee/plan/syllabus-grid/actions";

const initialState: FormState = { error: null };

export function SyllabusEntryForm({
  tpNumber,
  mainAim,
  subAim,
  material,
  locked,
}: {
  tpNumber: 7 | 8;
  mainAim: string | null;
  subAim: string | null;
  material: string | null;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSyllabusPlanningEntry, initialState);

  if (locked) {
    return (
      <p className="text-sm text-muted">
        Your lesson plan for TP{tpNumber} is already submitted -- ask your trainer to reopen it to change the topic.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="tp_number" value={tpNumber} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Main aim</label>
        <input
          name="main_aim"
          type="text"
          defaultValue={mainAim ?? ""}
          required
          className="rounded-[6px] border border-border bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Sub aim (optional)</label>
        <input
          name="sub_aim"
          type="text"
          defaultValue={subAim ?? ""}
          className="rounded-[6px] border border-border bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Material</label>
        <input
          name="material"
          type="text"
          defaultValue={material ?? ""}
          required
          className="rounded-[6px] border border-border bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-3 py-1 text-xs text-ink hover:border-primary disabled:opacity-50"
      >
        {pending ? "Saving…" : material ? "Update" : "Save"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateStage1, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

export function Stage1Form({ record }: { record: Celta5Record }) {
  const [state, action, pending] = useActionState(updateStage1, initialState);

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <h2 className="font-serif text-lg text-ink">
        Stage One -- first third of the course
      </h2>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="stage1_tutorial_given"
          defaultChecked={record.stage1_tutorial_given}
        />
        Tutorial given
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Hours taught so far</label>
        <input
          name="stage1_hours_taught"
          type="number"
          step="0.1"
          defaultValue={record.stage1_hours_taught ?? ""}
          className="w-32 rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Strengths</label>
        <textarea
          name="stage1_strengths"
          rows={3}
          defaultValue={record.stage1_strengths ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Action plan for the next stage</label>
        <textarea
          name="stage1_action_plan"
          rows={3}
          defaultValue={record.stage1_action_plan ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="stage1_completed"
          defaultChecked={!!record.stage1_completed_at}
        />
        Stage One complete
      </label>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

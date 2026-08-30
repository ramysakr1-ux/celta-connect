"use client";

import { useActionState } from "react";
import { updateUpgradeConditions, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

// The design's "In order to achieve a [grade], they need to..." box --
// ("achieve", not the design file's "deserve" -- Ramy, 30 Aug.)
// one condition per line, the tutor's own working note. Explicitly not
// shown to the candidate until the final report is released.
export function UpgradeConditionsForm({ traineeId, record }: { traineeId: string; record: Celta5Record | null }) {
  const [state, action, pending] = useActionState(updateUpgradeConditions, initialState);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-[6px] border border-border-faint p-3">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <label className="text-xs text-muted">In order to achieve a pass or a higher grade, they need to (one per line)</label>
      <TrainerFeedbackTextarea
        name="provisional_upgrade_conditions"
        rows={3}
        defaultValue={record?.provisional_upgrade_conditions ?? ""}
        className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <p className="text-xs italic text-muted">Shown to the candidate only after the final report is released.</p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainer-hover-fill disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { releaseFinalReport, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

// Deliberately separate from FinalizeRecordForm -- finalizing is an
// internal act at course end, this is the later, distinct moment the
// trainee actually gets their own copy. See migration 0038.
export function ReleaseFinalReportForm({ record }: { record: Celta5Record }) {
  const [state, action, pending] = useActionState(releaseFinalReport, initialState);

  return (
    <form action={action} className="sheet flex flex-col gap-3 p-6">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <h2 className="font-serif text-lg text-ink">Release final report to trainee</h2>
      <p className="text-sm text-muted">
        The trainee never sees this during the course. Release it once Cambridge has actually
        confirmed the result -- typically about a week after the course ends, not the moment
        this record is finalized above.
      </p>

      {record.final_report_released_at ? (
        <p className="text-sm text-ink">
          Released {new Date(record.final_report_released_at).toLocaleString()}.
        </p>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {pending ? "Releasing..." : "Release final report to trainee"}
        </button>
      )}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

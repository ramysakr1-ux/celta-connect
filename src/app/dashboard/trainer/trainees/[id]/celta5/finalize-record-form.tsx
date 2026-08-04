"use client";

import { useActionState } from "react";
import { finalizeRecord, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

export function FinalizeRecordForm({ record }: { record: Celta5Record }) {
  const [state, action, pending] = useActionState(finalizeRecord, initialState);

  return (
    <form action={action} className="sheet flex flex-col gap-3 p-6">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <h2 className="font-serif text-lg text-ink">Final sign-off</h2>
      <p className="text-sm text-muted">
        Reveals Stage Three (if applicable), the final grade, and your overall notes to the
        trainee, and lets them add their own final sign-off.
      </p>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="finalized"
          defaultChecked={!!record.trainer_signoff_final_at}
        />
        Finalize and reveal to trainee
      </label>

      {record.trainer_signoff_final_at ? (
        <p className="text-xs text-muted">
          Finalized {new Date(record.trainer_signoff_final_at).toLocaleString()}.
        </p>
      ) : null}
      {record.trainee_signoff_final_at ? (
        <p className="text-xs text-muted">
          Trainee signed off {new Date(record.trainee_signoff_final_at).toLocaleString()}.
        </p>
      ) : null}

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

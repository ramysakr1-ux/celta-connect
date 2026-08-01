"use client";

import { useActionState } from "react";
import { updateFinalGrade, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { GRADE_DESCRIPTORS } from "@/lib/celta-criteria";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

export function FinalGradeForm({ record }: { record: Celta5Record }) {
  const [state, action, pending] = useActionState(updateFinalGrade, initialState);

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <h2 className="font-serif text-lg text-ink">Final recommended grade</h2>

      <details className="rounded-[6px] border border-border p-3 text-sm text-muted">
        <summary className="cursor-pointer text-ink">
          Performance descriptors (reference)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {GRADE_DESCRIPTORS.dimensions.map((d) => (
            <div key={d.name}>
              <p className="font-medium text-ink">{d.name}</p>
              <p>
                <span className="text-ink">Pass:</span> {d.Pass}
              </p>
              <p>
                <span className="text-ink">Pass B:</span> {d["Pass B"]}
              </p>
              <p>
                <span className="text-ink">Pass A:</span> {d["Pass A"]}
              </p>
            </div>
          ))}
          <p>
            <span className="text-ink">Fail:</span> {GRADE_DESCRIPTORS.fail}
          </p>
          <ul className="list-disc pl-5">
            {GRADE_DESCRIPTORS.eligibility.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </details>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Final recommended grade</label>
        <select
          name="final_recommended_grade"
          defaultValue={record.final_recommended_grade ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        >
          <option value="">Not yet decided</option>
          <option value="Pass">Pass</option>
          <option value="Pass B">Pass B</option>
          <option value="Pass A">Pass A</option>
          <option value="Fail">Fail</option>
          <option value="Withdrawn">Withdrawn</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Overall notes</label>
        <textarea
          name="overall_notes"
          rows={4}
          defaultValue={record.overall_notes ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

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

"use client";

import { useActionState } from "react";
import { updateProvisionalGrade, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

const GRADE_OPTIONS = ["Pass", "Pass B", "Pass A", "Fail", "Withdrawn"] as const;

export function ProvisionalGradeForm({
  traineeId,
  record,
}: {
  traineeId: string;
  record: Celta5Record | null;
}) {
  const [state, action, pending] = useActionState(updateProvisionalGrade, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-[6px] border border-border-faint p-3">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">Provisional grade</label>
        <select
          name="provisional_grade"
          defaultValue={record?.provisional_grade ?? ""}
          className="appearance-none rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">Not set</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">Or in doubt, up to</label>
        <select
          name="provisional_grade_upper"
          defaultValue={record?.provisional_grade_upper ?? ""}
          className="appearance-none rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">-- (not slashed)</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {state.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { saveMarkingScheme, type FormState } from "@/app/dashboard/admissions/actions";
import type { Database } from "@/lib/supabase/types";

type Applicant = Database["public"]["Tables"]["applicants"]["Row"];

const ROWS = [
  { key: "language_awareness", label: "Language awareness" },
  { key: "accuracy", label: "Accuracy" },
  { key: "organisation", label: "Organisation" },
  { key: "range", label: "Range" },
  { key: "substance", label: "Substance" },
] as const;

const initialState: FormState = { error: null };

export function MarkingForm({ applicant }: { applicant: Applicant }) {
  const [state, action, pending] = useActionState(saveMarkingScheme, initialState);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(ROWS.map((r) => [r.key, (applicant[`marking_${r.key}` as keyof Applicant] as string | null) ?? ""]))
  );

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="applicant_id" value={applicant.id} />
      <h2 className="font-serif text-lg text-ink">Marking scheme -- selection task</h2>
      <p className="text-sm text-muted">Same shape as the Standard of English criterion on the assignment cover sheets.</p>

      <div className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <div key={row.key} className="flex flex-col gap-1.5 border-b border-border-faint pb-3 last:border-none">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`marking_${row.key}`} className="text-sm text-ink">
                {row.label}
              </label>
              <select
                id={`marking_${row.key}`}
                name={`marking_${row.key}`}
                value={values[row.key]}
                onChange={(e) => setValues((v) => ({ ...v, [row.key]: e.target.value }))}
                className="h-8 rounded-[6px] border border-input bg-card px-2 text-sm text-ink"
              >
                <option value="">Not marked</option>
                <option value="above">Above standard</option>
                <option value="at">At standard</option>
                <option value="below">Below standard</option>
              </select>
            </div>
            {values[row.key] === "below" ? (
              <input
                type="text"
                name={`marking_${row.key}_note`}
                placeholder="Note required for a Below standard mark"
                required
                defaultValue={(applicant[`marking_${row.key}_note` as keyof Applicant] as string | null) ?? ""}
                className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
              />
            ) : null}
          </div>
        ))}
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save marking"}
      </button>
    </form>
  );
}

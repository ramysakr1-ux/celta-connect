"use client";

import { useActionState, useState } from "react";
import { signOffFinal, type FormState } from "@/app/dashboard/trainee/actions";

const initialState: FormState = { error: null };

// Verbatim wording from the real CELTA5 booklet's final-day page -- do not
// paraphrase (see project_content_architecture_spec memory, 2026-08-04).
const CHECKLIST_ITEMS = [
  {
    key: "checklist_tp",
    label: "I have completed six hours of assessed teaching practice at at least two levels.",
  },
  {
    key: "checklist_observations",
    label: "I have completed six hours of observation of experienced teachers.",
  },
  { key: "checklist_assignments", label: "I have completed four written assignments." },
  { key: "checklist_own_work", label: "The written assignments are my own work." },
  { key: "checklist_all_records", label: "I have completed all records." },
] as const;

export function FinalChecklistForm() {
  const [state, action, pending] = useActionState(signOffFinal, initialState);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = CHECKLIST_ITEMS.every((item) => checked[item.key]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">
          To be completed on the final day of the course
        </p>
        <p className="mt-1 text-sm text-ink">
          Please tick the appropriate boxes and sign. In handing in this portfolio for
          assessment purposes, I confirm that:
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item.key}>
            <label className="flex items-start gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name={item.key}
                checked={checked[item.key] ?? false}
                onChange={(e) => setChecked((c) => ({ ...c, [item.key]: e.target.checked }))}
                className="mt-0.5"
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={!allChecked || pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Signing..." : "Candidate's signature -- confirm and sign off"}
      </button>
    </form>
  );
}

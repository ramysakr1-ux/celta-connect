"use client";

import { useActionState } from "react";
import {
  addMalpracticeOutcomeOption,
  deleteMalpracticeOutcomeOption,
  type FormState,
} from "@/app/dashboard/admin/settings/actions";
import type { Database } from "@/lib/supabase/types";

type OutcomeOption = Database["public"]["Tables"]["malpractice_outcome_options"]["Row"];

const initialState: FormState = { error: null };

// for-claude-code-malpractice-outcomes.md: "however many outcomes the
// centre's own policy defines," not a fixed list -- this is a plain add/
// delete list, same shape as FeedbackStyleExamplesManager next to it, not a
// picker over a hardcoded set.
export function MalpracticeOutcomesManager({ options }: { options: OutcomeOption[] }) {
  return (
    <div className="flex flex-col gap-3">
      {options.length === 0 ? (
        <p className="text-sm text-muted">
          No outcomes configured yet -- cases fall back to a plain Upheld / Not upheld decision.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {options.map((option) => (
            <OutcomeRow key={option.id} option={option} />
          ))}
        </ul>
      )}
      <AddOutcomeForm />
    </div>
  );
}

function OutcomeRow({ option }: { option: OutcomeOption }) {
  return (
    <li className="admin-hover flex items-center justify-between gap-3 rounded-[6px] border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{option.label}</p>
        <p className="text-xs text-muted">
          {[option.fails_assignment ? "fails the assignment" : null, option.flagged_for_referral ? "referred" : null]
            .filter(Boolean)
            .join(" · ") || "no automatic consequence"}
        </p>
      </div>
      <form action={deleteMalpracticeOutcomeOption}>
        <input type="hidden" name="id" value={option.id} />
        <button type="submit" className="shrink-0 text-xs text-destructive hover:underline">
          Delete
        </button>
      </form>
    </li>
  );
}

function AddOutcomeForm() {
  const [state, action, pending] = useActionState(addMalpracticeOutcomeOption, initialState);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-[6px] border border-border p-3">
      <label className="text-sm text-muted">Add an outcome</label>
      <input
        name="label"
        type="text"
        placeholder="e.g. Upheld, referred to the centre's malpractice procedure"
        className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="fails_assignment" />
          Fails the assignment
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="flagged_for_referral" />
          Referred to your procedure
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="admin-hover-fill self-start rounded-[6px] bg-primary px-3 py-1.5 text-xs font-medium text-card disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import {
  addAssignmentCriterion,
  toggleAssignmentCriterionActive,
  type FormState,
} from "@/app/dashboard/admin/settings/actions";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { Database } from "@/lib/supabase/types";

type Criterion = Database["public"]["Tables"]["centre_assignment_criteria"]["Row"];

const ASSIGNMENT_TYPES = ["Focus on Learner", "LRT", "Skills", "LfC", "Plagiarism Reflection"] as const;

const initialState: FormState = { error: null };

// build-spec.md: assignment criteria are "centre settings imported at
// setup, with defaults supplied" -- the "centre judgment" grey area
// (as opposed to the fixed brief/word-count instructions, which stay as
// they are). Seeded from the shipped defaults (migration 0177); this is
// where a centre diverges from them. Deactivate, never delete -- a
// trainee's already-recorded marks are keyed by `key`.
export function AssignmentCriteriaManager({ criteria }: { criteria: Criterion[] }) {
  const byType = new Map<string, Criterion[]>();
  for (const c of criteria) {
    const list = byType.get(c.assignment_type) ?? [];
    list.push(c);
    byType.set(c.assignment_type, list);
  }
  for (const list of byType.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex flex-col gap-5">
      {ASSIGNMENT_TYPES.map((type) => (
        <div key={type} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">{ASSIGNMENT_INFO[type]?.title ?? type}</h3>
          <ul className="flex flex-col gap-1.5">
            {(byType.get(type) ?? []).map((c) => (
              <CriterionRow key={c.id} criterion={c} />
            ))}
          </ul>
          <AddCriterionForm assignmentType={type} />
        </div>
      ))}
    </div>
  );
}

function CriterionRow({ criterion }: { criterion: Criterion }) {
  return (
    <li
      className={`admin-hover flex items-center justify-between gap-3 rounded-[6px] border px-3 py-2 ${
        criterion.active ? "border-border" : "border-border-faint opacity-60"
      }`}
    >
      <p className="min-w-0 text-sm text-ink">{criterion.criterion_text}</p>
      <form action={toggleAssignmentCriterionActive}>
        <input type="hidden" name="id" value={criterion.id} />
        <input type="hidden" name="active" value={String(criterion.active)} />
        <button type="submit" className="shrink-0 text-xs text-muted hover:text-ink">
          {criterion.active ? "Deactivate" : "Reactivate"}
        </button>
      </form>
    </li>
  );
}

function AddCriterionForm({ assignmentType }: { assignmentType: string }) {
  const [state, action, pending] = useActionState(addAssignmentCriterion, initialState);
  const [text, setText] = useState("");

  return (
    <form
      action={action}
      className="flex items-end gap-2"
      onSubmit={() => setText("")}
    >
      <input type="hidden" name="assignment_type" value={assignmentType} />
      <input
        name="criterion_text"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a criterion"
        className="h-9 flex-1 rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        className="admin-hover-fill h-9 shrink-0 rounded-[6px] border border-border px-3 text-xs font-medium text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateAssignment, type FormState } from "@/app/dashboard/trainer/actions";
import type { Database } from "@/lib/supabase/types";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];

const initialState: FormState = { error: null };

const STATUS_OPTIONS = [
  { value: "not_submitted", label: "Not submitted" },
  { value: "pending", label: "Pending review" },
  { value: "submitted", label: "Submitted" },
  { value: "resubmission_required", label: "Resubmission required" },
  { value: "approved", label: "Approved" },
] as const;

export function AssignmentForm({ assignment }: { assignment: Assignment }) {
  const [state, action, pending] = useActionState(updateAssignment, initialState);

  return (
    <form action={action} className="card flex flex-col gap-3 p-4">
      <input type="hidden" name="assignment_id" value={assignment.id} />
      <input type="hidden" name="trainee_id" value={assignment.trainee_id} />

      <h3 className="font-serif text-ink">{assignment.assignment_type}</h3>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">First submission status</label>
        <select
          name="first_status"
          defaultValue={assignment.first_status}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Resubmission status</label>
        <select
          name="resubmission_status"
          defaultValue={assignment.resubmission_status}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Final grade</label>
        <input
          name="final_grade"
          type="text"
          defaultValue={assignment.final_grade ?? ""}
          placeholder="e.g. Pass"
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

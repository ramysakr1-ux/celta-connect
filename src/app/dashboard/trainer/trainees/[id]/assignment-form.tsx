"use client";

import Link from "next/link";
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

const GRADE_OPTIONS = [
  { value: "", label: "Not yet graded" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
] as const;

export function AssignmentForm({ assignment }: { assignment: Assignment }) {
  const [state, action, pending] = useActionState(updateAssignment, initialState);

  return (
    <form action={action} className="card flex flex-col gap-4 p-4">
      <input type="hidden" name="assignment_id" value={assignment.id} />
      <input type="hidden" name="trainee_id" value={assignment.trainee_id} />

      <div className="flex items-center justify-between">
        <h3 className="font-serif text-ink">{assignment.assignment_type}</h3>
        <Link
          href={`/dashboard/trainer/trainees/${assignment.trainee_id}/assignments/${assignment.id}`}
          className="text-sm text-primary hover:underline"
        >
          Review responses
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">First submission status</label>
        <select
          name="first_status"
          defaultValue={assignment.first_status}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted">
        Must pass both content and standard of English to pass the assignment overall.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Content grade</label>
          <select
            name="first_content_grade"
            defaultValue={assignment.first_content_grade ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            {GRADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">English grade</label>
          <select
            name="first_english_grade"
            defaultValue={assignment.first_english_grade ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            {GRADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-border-faint pt-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Resubmission status</label>
          <select
            name="resubmission_status"
            defaultValue={assignment.resubmission_status}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Resubmission content</label>
            <select
              name="resubmission_content_grade"
              defaultValue={assignment.resubmission_content_grade ?? ""}
              className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            >
              {GRADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Resubmission English</label>
            <select
              name="resubmission_english_grade"
              defaultValue={assignment.resubmission_english_grade ?? ""}
              className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            >
              {GRADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Final grade note</label>
        <input
          name="final_grade"
          type="text"
          defaultValue={assignment.final_grade ?? ""}
          placeholder="e.g. Pass (on resubmission)"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
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

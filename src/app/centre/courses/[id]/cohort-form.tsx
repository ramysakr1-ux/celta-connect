"use client";

import { useActionState } from "react";
import { updateCourseCohortSize, type FormState } from "@/app/centre/courses/[id]/actions";

const initialState: FormState = { error: null };

/**
 * The cohort cap, changeable after the course exists.
 *
 * Ramy, 18 Sep 2026: "if it's a course of 12, I can go back and make it a
 * course of 18 if I want to." Sits inside the Cohort card rather than in a
 * card of its own, because the number it changes is the one printed there.
 */
export function CohortForm({ courseId, cohortSize }: { courseId: string; cohortSize: number | null }) {
  const [state, action, pending] = useActionState(updateCourseCohortSize, initialState);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="cohort_size" className="text-label font-semibold text-ink">
          Maximum
        </label>
        <input
          id="cohort_size"
          name="cohort_size"
          type="number"
          min="1"
          max="24"
          defaultValue={cohortSize ?? ""}
          placeholder="not set"
          className="h-9 w-24 rounded-[8px] border border-border bg-card px-2.5 text-body text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="wash h-9 rounded-[8px] border border-border px-3 text-meta font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error ? <p className="w-full text-label text-garnet">{state.error}</p> : null}
    </form>
  );
}

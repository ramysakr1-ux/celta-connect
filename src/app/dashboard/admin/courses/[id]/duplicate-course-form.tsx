"use client";

import { useActionState, useState } from "react";
import { duplicateCourse, type FormState } from "@/app/dashboard/admin/actions";

const initialState: FormState = { error: null };

export function DuplicateCourseForm({
  courseId,
  suggestedName,
}: {
  courseId: string;
  suggestedName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(duplicateCourse, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="admin-hover-fill rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
      >
        Duplicate this course
      </button>
    );
  }

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="source_course_id" value={courseId} />
      <h2 className="font-serif text-lg text-ink">Duplicate this course</h2>
      <p className="text-sm text-muted">
        Copies the timetable and any course-specific Resource Hub files onto a new course with
        new dates -- fully editable afterward. Your centre-wide TP Points Library and assignment
        briefs are already shared automatically, nothing to copy there. Trainees, records,
        grades, and anything already sent to your centre&apos;s Drive are never carried over.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dup_name" className="text-sm text-muted">
          New course name
        </label>
        <input
          id="dup_name"
          name="name"
          type="text"
          required
          defaultValue={suggestedName}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="dup_start" className="text-sm text-muted">
            Start date
          </label>
          <input
            id="dup_start"
            name="start_date"
            type="date"
            required
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="dup_end" className="text-sm text-muted">
            End date
          </label>
          <input
            id="dup_end"
            name="end_date"
            type="date"
            required
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="admin-hover-fill self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {pending ? "Duplicating..." : "Duplicate"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="admin-hover-fill self-start rounded-[6px] px-4 py-2 text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

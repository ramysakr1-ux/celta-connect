"use client";

import { useActionState } from "react";
import { createCourse, type FormState } from "@/app/dashboard/admin/actions";

const initialState: FormState = { error: null };

export function CreateCourseForm() {
  const [state, action, pending] = useActionState(createCourse, initialState);

  return (
    <form action={action} className="card mt-4 flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">New course</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-muted">
          Course name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. September 2026 CELTA"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="start_date" className="text-sm text-muted">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="end_date" className="text-sm text-muted">
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 font-medium text-card disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create course"}
      </button>
    </form>
  );
}

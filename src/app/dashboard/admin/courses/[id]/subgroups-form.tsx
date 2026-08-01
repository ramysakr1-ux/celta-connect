"use client";

import { useActionState } from "react";
import {
  createSubgroup,
  addSubgroupMember,
  type FormState,
} from "@/app/dashboard/admin/courses/[id]/subgroup-actions";

const initialState: FormState = { error: null };

export function CreateSubgroupForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(createSubgroup, initialState);

  return (
    <form action={action} className="flex items-end gap-3">
      <input type="hidden" name="course_id" value={courseId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-muted">
          New subgroup name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Mon/Wed/Fri"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create subgroup"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function AddMemberForm({
  courseId,
  subgroupId,
  availableTrainees,
}: {
  courseId: string;
  subgroupId: string;
  availableTrainees: { id: string; full_name: string }[];
}) {
  const [state, action, pending] = useActionState(addSubgroupMember, initialState);

  if (availableTrainees.length === 0) {
    return <p className="text-sm text-muted">No unassigned trainees left to add.</p>;
  }

  return (
    <form action={action} className="flex items-end gap-3">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="subgroup_id" value={subgroupId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`trainee_id__${subgroupId}`} className="text-sm text-muted">
          Add trainee
        </label>
        <select
          id={`trainee_id__${subgroupId}`}
          name="trainee_id"
          required
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">Choose...</option>
          {availableTrainees.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import {
  createSubgroup,
  addSubgroupMember,
  pairSubgroups,
  unpairTpGroup,
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
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
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

// checkpoint 3 -- pairs two currently-unpaired subgroups into a TP group
// (halves of three, alternating real TP days). Only shown once at least 2
// unpaired subgroups exist -- there's nothing to pair otherwise.
export function PairSubgroupsForm({
  courseId,
  unpairedSubgroups,
}: {
  courseId: string;
  unpairedSubgroups: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(pairSubgroups, initialState);

  if (unpairedSubgroups.length < 2) return null;

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-border-faint pt-4">
      <p className="text-sm font-semibold text-ink">Pair two subgroups into a TP group</p>
      <input type="hidden" name="course_id" value={courseId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tp_group_name" className="text-sm text-muted">
            TP group name
          </label>
          <input
            id="tp_group_name"
            name="name"
            type="text"
            required
            placeholder="e.g. Group ABC"
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="first_subgroup_id" className="text-sm text-muted">
            Half A
          </label>
          <select
            id="first_subgroup_id"
            name="first_subgroup_id"
            required
            className="appearance-none rounded-[6px] border border-border bg-card-inset px-3 py-2 text-center text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Choose...</option>
            {unpairedSubgroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="second_subgroup_id" className="text-sm text-muted">
            Half B
          </label>
          <select
            id="second_subgroup_id"
            name="second_subgroup_id"
            required
            className="appearance-none rounded-[6px] border border-border bg-card-inset px-3 py-2 text-center text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Choose...</option>
            {unpairedSubgroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {pending ? "Pairing..." : "Pair as TP group"}
        </button>
      </div>
      <p className="text-xs text-muted">
        The two halves will alternate which real TP day (from the course timetable) they teach on.
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function UnpairButton({ courseId, tpGroupId }: { courseId: string; tpGroupId: string }) {
  return (
    <form action={unpairTpGroup}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="tp_group_id" value={tpGroupId} />
      <button type="submit" className="text-xs text-muted hover:text-destructive">
        Unpair
      </button>
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
          className="appearance-none rounded-[6px] border border-border bg-card-inset px-3 py-2 text-center text-sm text-ink outline-none focus:border-primary"
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

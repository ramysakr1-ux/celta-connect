"use client";

import { useActionState, useState } from "react";
import { assignExistingTutor, type AssignTutorState } from "./assign-tutor-actions";
import { TUTOR_ROLE_LABEL, DEFAULT_INVITE_TUTOR_ROLE } from "@/lib/tutor-roles";

const initial: AssignTutorState = { error: null };

export interface AssignableTrainer {
  id: string;
  name: string;
  email: string;
  currentCourseLabel: string | null;
}

/**
 * Add a tutor who already has a Connect account (from another course at this
 * centre) to this one -- for-claude-code-concurrent-course-checks.md /
 * course_tutors' own migration comment (0051): "there is no 'add an existing
 * tutor to a new course' flow anywhere in the app." This is that flow. It
 * adds, it never moves -- their access to whatever course they came from is
 * untouched (for-claude-code-course-switcher.md).
 */
export function AssignTutorPanel({ courseId, trainers }: { courseId: string; trainers: AssignableTrainer[] }) {
  const [state, action, pending] = useActionState(assignExistingTutor, initial);
  const [tutorRole, setTutorRole] = useState<string>(DEFAULT_INVITE_TUTOR_ROLE);

  if (trainers.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="font-serif text-lg text-ink">Add an existing tutor</h2>
      <p className="mt-1 text-sm text-muted">
        For a tutor who already has an account from another course at this centre. It adds this course to their
        assignments -- it doesn&apos;t remove them from the other one.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="course_id" value={courseId} />

        <div className="flex flex-1 min-w-[220px] flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Tutor</label>
          <select
            name="profile_id"
            required
            defaultValue=""
            className="h-9 w-full rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="" disabled>
              Choose a tutor
            </option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.email}){t.currentCourseLabel ? ` -- currently on ${t.currentCourseLabel}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Role on this course</label>
          <select
            name="tutor_role"
            value={tutorRole}
            onChange={(e) => setTutorRole(e.target.value)}
            className="h-9 rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
          >
            {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[6px] bg-ink-warm px-4 text-sm font-semibold text-card disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to this course"}
        </button>
      </form>

      {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
      {!state.error && state.warning ? <p className="mt-2 text-sm text-status-warning-text">{state.warning}</p> : null}
      {!state.error && !state.warning && state.assigned ? (
        <p className="mt-2 text-sm text-primary">{state.assigned} added to this course.</p>
      ) : null}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { changeTutorRole, type InviteState } from "./invitation-actions";
import { TUTOR_ROLE_LABEL } from "@/lib/tutor-roles";

const initial: InviteState = { error: null };


/**
 * Change a tutor's role, including handing the MCT to someone else.
 *
 * Ramy, 2026-08-16: "There's a possibility that the MCT can no longer work,
 * and then the ACT becomes the MCT. So there should be an option in the course
 * admin page to reverse it or choose another MCT."
 *
 * Submits on change rather than behind a Save button. There is one field and
 * the consequence is immediate; a Save step would only add a way to think you
 * had changed it when you hadn't.
 */
export function TutorRoleControl({
  courseTutorId,
  courseId,
  current,
}: {
  courseTutorId: string;
  courseId: string;
  current: string | null;
}) {
  const [state, action, pending] = useActionState(changeTutorRole, initial);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="course_tutor_id" value={courseTutorId} />
      <input type="hidden" name="course_id" value={courseId} />
      <select
        name="tutor_role"
        defaultValue={current ?? ""}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary disabled:opacity-60"
      >
        <option value="">Role not set</option>
        {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {state.error ? <span className="text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

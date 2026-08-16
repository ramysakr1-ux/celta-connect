"use client";

import { useActionState } from "react";
import { setTpGroupTutor } from "./subgroup-actions";
import type { FormState } from "./subgroup-actions";

const initial: FormState = { error: null };

/**
 * The tutor and meeting days shown under a group's name in the design
 * ("Nadia Farouk · odd days"), made editable in place.
 *
 * Meeting days is free text because the design's own example is a rotation
 * pattern rather than weekdays, and centres say it differently — "odd days",
 * "Mon/Wed/Fri", "mornings". Nothing computes against it, so forcing one
 * vocabulary would only make it wrong for somebody.
 */
export function GroupTutorForm({
  groupId,
  courseId,
  tutors,
  currentTutorId,
  currentMeetingDays,
}: {
  groupId: string;
  courseId: string;
  tutors: { id: string; name: string }[];
  currentTutorId: string | null;
  currentMeetingDays: string | null;
}) {
  const [state, action, pending] = useActionState(setTpGroupTutor, initial);

  return (
    <form action={action} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="course_id" value={courseId} />

      <select
        name="tutor_profile_id"
        defaultValue={currentTutorId ?? ""}
        disabled={pending}
        className="h-8 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary disabled:opacity-60"
      >
        <option value="">No tutor assigned</option>
        {tutors.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <input
        name="meeting_days"
        type="text"
        defaultValue={currentMeetingDays ?? ""}
        placeholder="odd days"
        disabled={pending}
        className="h-8 w-28 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary disabled:opacity-60"
      />

      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-[6px] border border-border px-2.5 text-xs font-semibold text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>

      {state.error ? <span className="w-full text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

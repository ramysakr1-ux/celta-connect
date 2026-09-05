"use client";

import { useActionState, useRef, useState } from "react";
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
 *
 * EXCEPT once the course is running. Ramy, 31 Aug 2026: "serious changes to a
 * course that already started and is running should be somewhat guarded or
 * flagged... there should be a warning in case someone does change something
 * by accident." Submit-on-change is precisely the shape that makes that
 * accident easy: one stray click on a select and the course has a different
 * Main Course Tutor, with no step in between.
 *
 * So while the course runs, the change is staged and named back to the person
 * before it is sent -- and the message says who else will hear about it, since
 * the tutors on the course get a notification. Before the course starts,
 * nothing is disturbed: a change made during setup is just setup.
 *
 * The select is reverted on cancel rather than left showing the abandoned
 * choice, so what is on screen never disagrees with what is stored.
 */
export function TutorRoleControl({
  courseTutorId,
  courseId,
  current,
  courseRunning = false,
  tutorName,
  selectClassName,
}: {
  courseTutorId: string;
  courseId: string;
  current: string | null;
  /** Whether the course has already started and has not yet ended. */
  courseRunning?: boolean;
  /** Whose role this is, so the confirmation can name them. */
  tutorName?: string | null;
  /** Styling override for the select (the trainer hub's roster uses its own sizes). */
  selectClassName?: string;
}) {
  const [state, action, pending] = useActionState(changeTutorRole, initial);
  const [staged, setStaged] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const cancel = () => {
    setStaged(null);
    if (selectRef.current) selectRef.current.value = current ?? "";
  };

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="course_tutor_id" value={courseTutorId} />
      <input type="hidden" name="course_id" value={courseId} />
      <select
        ref={selectRef}
        name="tutor_role"
        defaultValue={current ?? ""}
        disabled={pending}
        onChange={(e) => {
          if (!courseRunning) {
            e.currentTarget.form?.requestSubmit();
            return;
          }
          setStaged(e.currentTarget.value);
        }}
        className={selectClassName ?? "h-8 rounded-[6px] border border-input bg-card-inset px-2 text-xs text-ink outline-none focus:border-primary disabled:opacity-60"}
      >
        <option value="">Role not set</option>
        {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      {staged !== null ? (
        <div className="flex flex-col gap-1.5 rounded-[6px] border border-status-warning-text/40 bg-status-warning-bg/40 p-2">
          <p className="text-[11.5px] leading-relaxed text-ink">
            This course is running.{" "}
            {staged === "main_course_tutor"
              ? `Make ${tutorName ?? "this tutor"} the main course tutor? The current main course tutor becomes an assistant course tutor.`
              : `Change ${tutorName ?? "this tutor"} to ${(TUTOR_ROLE_LABEL[staged as keyof typeof TUTOR_ROLE_LABEL] ?? "no role").toLowerCase()}?`}
          </p>
          <p className="text-[11px] text-muted">Everyone teaching on this course is notified, and the change is recorded against your name.</p>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              onClick={() => setStaged(null)}
              className="rounded-[6px] border border-border px-2.5 py-1 text-[11.5px] text-ink admin-hover-fill disabled:opacity-60"
            >
              {pending ? "Changing..." : "Yes, change it"}
            </button>
            <button type="button" onClick={cancel} className="text-[11px] text-muted hover:underline">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {state.error ? <span className="text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

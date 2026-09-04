"use client";

import { useActionState } from "react";
import { addTpGroupTutorAssignment, removeTpGroupTutorAssignment, setTpGroupTutor } from "./subgroup-actions";
import type { FormState } from "./subgroup-actions";

const initial: FormState = { error: null };

export interface TutorAssignmentView {
  id: string;
  tutorId: string;
  tutorName: string;
  fromTp: number;
  setByName: string | null;
  setAt: string;
  note: string | null;
}

/**
 * The tutor plan under a group's name: who has it from which TP, and the
 * group's meeting days.
 *
 * Migration 0268: the plan is rows, "Nadia from TP1, Marcus from TP4"; the
 * database derives the group's current tutor from it as the course reaches
 * each TP. Ramy, 5 Sep 2026 -- tutors swap groups mid-course and Connect
 * had no way to know in advance.
 *
 * Meeting days is free text because the design's own example is a rotation
 * pattern rather than weekdays, and centres say it differently -- "odd
 * days", "Mon/Wed/Fri", "mornings". Nothing computes against it.
 */
export function GroupTutorForm({
  groupId,
  courseId,
  tutors,
  assignments,
  currentTutorName,
  currentTp,
  currentMeetingDays,
}: {
  groupId: string;
  courseId: string;
  tutors: { id: string; name: string }[];
  assignments: TutorAssignmentView[];
  currentTutorName: string | null;
  /** The course's current TP number (0 before TP1). */
  currentTp: number;
  currentMeetingDays: string | null;
}) {
  const [addState, addAction, addPending] = useActionState(addTpGroupTutorAssignment, initial);
  const [daysState, daysAction, daysPending] = useActionState(setTpGroupTutor, initial);
  const sorted = [...assignments].sort((a, b) => a.fromTp - b.fromTp);
  const effective = sorted.filter((a) => a.fromTp <= Math.max(currentTp, 1)).at(-1) ?? null;
  const inputClass = "h-8 rounded-[6px] border border-input bg-card-inset px-2 text-xs text-ink outline-none focus:border-primary disabled:opacity-60";

  return (
    <div className="mt-1 flex flex-col gap-2.5">
      <p className="text-sm text-ink">
        <span className="font-semibold">{currentTutorName ?? "No tutor yet"}</span>
        {currentTp > 0 ? <span className="text-muted"> · now, at TP{currentTp}</span> : <span className="text-muted"> · before TP1</span>}
      </p>

      {sorted.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {sorted.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className={`rounded-full px-2 py-[2px] font-semibold ${effective?.id === a.id ? "bg-card-inset text-ink" : "text-muted"}`}>
                From TP{a.fromTp}
              </span>
              <span className="font-medium text-ink">{a.tutorName}</span>
              <span className="text-muted">
                · set{a.setByName ? ` by ${a.setByName}` : ""} {new Date(a.setAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {a.note ? ` · ${a.note}` : ""}
              </span>
              <form action={removeTpGroupTutorAssignment}>
                <input type="hidden" name="assignment_id" value={a.id} />
                <input type="hidden" name="group_id" value={groupId} />
                <input type="hidden" name="course_id" value={courseId} />
                <button type="submit" className="text-[11px] text-muted underline hover:text-ink">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No tutor planned for this group yet.</p>
      )}

      <form action={addAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="course_id" value={courseId} />
        <select name="tutor_profile_id" defaultValue="" disabled={addPending} className={inputClass} required>
          <option value="" disabled>
            Tutor
          </option>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">from</span>
        <select name="from_tp_number" defaultValue={sorted.length === 0 ? "1" : ""} disabled={addPending} className={inputClass} required>
          <option value="" disabled>
            TP
          </option>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              TP{n}
            </option>
          ))}
        </select>
        <input name="note" type="text" placeholder="Why (optional)" disabled={addPending} className={`${inputClass} w-36`} />
        <button
          type="submit"
          disabled={addPending}
          className="admin-hover-fill h-8 rounded-[6px] border border-border px-2.5 text-xs font-semibold text-ink hover:border-primary disabled:opacity-60"
        >
          {addPending ? "Saving…" : sorted.length === 0 ? "Set tutor" : "Add handover"}
        </button>
        {addState.error ? <span className="w-full text-[11px] text-destructive">{addState.error}</span> : null}
      </form>

      <form action={daysAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="course_id" value={courseId} />
        <span className="text-xs text-muted">Meets</span>
        <input name="meeting_days" type="text" defaultValue={currentMeetingDays ?? ""} placeholder="odd days" disabled={daysPending} className={`${inputClass} w-28`} />
        <button
          type="submit"
          disabled={daysPending}
          className="admin-hover-fill h-8 rounded-[6px] border border-border px-2.5 text-xs font-semibold text-ink hover:border-primary disabled:opacity-60"
        >
          {daysPending ? "Saving…" : "Save"}
        </button>
        {daysState.error ? <span className="w-full text-[11px] text-destructive">{daysState.error}</span> : null}
      </form>
    </div>
  );
}

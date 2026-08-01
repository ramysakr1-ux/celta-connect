"use client";

import { useActionState } from "react";
import {
  createTpLesson,
  updateTpLesson,
  type FormState,
} from "@/app/dashboard/trainer/actions";
import { STANDARD_RATING_OPTIONS } from "@/lib/celta-criteria";
import type { Database } from "@/lib/supabase/types";

type TpLesson = Database["public"]["Tables"]["tp_lessons"]["Row"];

const initialState: FormState = { error: null };

export function TpLessonForm({
  traineeId,
  lesson,
}: {
  traineeId: string;
  lesson?: TpLesson;
}) {
  const action = lesson ? updateTpLesson : createTpLesson;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card flex flex-col gap-3 p-4">
      <input type="hidden" name="trainee_id" value={traineeId} />
      {lesson ? <input type="hidden" name="lesson_id" value={lesson.id} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Date</label>
          <input
            name="lesson_date"
            type="date"
            defaultValue={lesson?.lesson_date ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Length (minutes)</label>
          <input
            name="length_minutes"
            type="number"
            defaultValue={lesson?.length_minutes ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Level</label>
          <input
            name="level"
            type="text"
            defaultValue={lesson?.level ?? ""}
            placeholder="e.g. Upper-Int"
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Learners</label>
          <input
            name="learner_count"
            type="number"
            defaultValue={lesson?.learner_count ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Lesson focus</label>
        <input
          name="lesson_focus"
          type="text"
          defaultValue={lesson?.lesson_focus ?? ""}
          placeholder="e.g. Grammar and speaking"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Tutor assessment</label>
        <select
          name="tutor_assessment"
          defaultValue={lesson?.tutor_assessment ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">Not yet assessed</option>
          {STANDARD_RATING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Tutor comments</label>
        <textarea
          name="tutor_comments"
          rows={2}
          defaultValue={lesson?.tutor_comments ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : lesson ? "Save" : "Add lesson"}
      </button>
    </form>
  );
}

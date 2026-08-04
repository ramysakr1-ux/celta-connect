"use client";

import { useActionState } from "react";
import {
  createTpLesson,
  updateTpLesson,
  type FormState,
} from "@/app/dashboard/trainer/actions";
import { STANDARD_RATING_OPTIONS } from "@/lib/celta-criteria";
import { CEFR_LEVELS } from "@/lib/levels";
import { CriteriaTagsEditor } from "@/app/dashboard/trainer/trainees/[id]/criteria-tags-editor";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import type { Database } from "@/lib/supabase/types";

type TpLesson = Database["public"]["Tables"]["tp_lessons"]["Row"];
type Tag = Database["public"]["Tables"]["tp_lesson_criteria_tags"]["Row"];

const initialState: FormState = { error: null };

export function TpLessonForm({
  traineeId,
  lesson,
  tags = [],
  suggestedTpNumber,
}: {
  traineeId: string;
  lesson?: TpLesson;
  tags?: Tag[];
  suggestedTpNumber?: number | null;
}) {
  const action = lesson ? updateTpLesson : createTpLesson;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="trainee_id" value={traineeId} />
        {lesson ? <input type="hidden" name="lesson_id" value={lesson.id} /> : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">TP number</label>
          <select
            name="tp_number"
            defaultValue={lesson?.tp_number ?? suggestedTpNumber ?? ""}
            className="appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-center text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Not part of rotation</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                TP{n}
              </option>
            ))}
          </select>
        </div>

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
            <select
              name="level"
              defaultValue={lesson?.level ?? ""}
              className="appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="">Select a level</option>
              {CEFR_LEVELS.map((l) => (
                <option key={l.code} value={`${l.name} (${l.code})`}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
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
            className="appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-center text-sm text-ink outline-none focus:border-primary"
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
          <TrainerFeedbackTextarea
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

      {lesson ? (
        <CriteriaTagsEditor lessonId={lesson.id} traineeId={traineeId} tags={tags} />
      ) : null}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { updateCourseGradeFormField, type CourseGradeField } from "@/app/dashboard/admin/courses/[id]/grade-form-actions";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";

const initialState: { error: string | null } = { error: null };

// The course-level half of the Cambridge Centre Grade Form, in the form's own
// order and words (read off the live form in Appian, 25 Sep 2026). All four are
// required there, and they describe the course rather than any candidate --
// which is why they sit above the cohort here, as they do on Cambridge's form,
// and why one tutor writing them writes them for everyone.
const FIELDS: { field: CourseGradeField; heading: string; hint: string }[] = [
  {
    field: "grade_form_teaching_practice",
    heading: "Teaching Practice",
    hint: "How teaching practice was organised: the groups, the levels, the hours, who taught when.",
  },
  {
    field: "grade_form_tp_supervision",
    heading: "Teaching Practice Supervision and Feedback",
    hint: "Who observed, how feedback ran, and what candidates were asked to do with it.",
  },
  {
    field: "grade_form_tutorials",
    heading: "Tutorials",
    hint: "When tutorials were held, who held them, and what they covered.",
  },
  {
    field: "grade_form_additional_comments",
    heading: "Additional Comments",
    hint: "Anything else the assessor should know about how the course ran.",
  },
];

const LIMIT = 2000;

function Field({
  courseId,
  field,
  heading,
  hint,
  value,
  editable,
}: {
  courseId: string;
  field: CourseGradeField;
  heading: string;
  hint: string;
  value: string;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(updateCourseGradeFormField, initialState);

  if (!editable) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-bold tracking-[0.12em] text-muted uppercase">{heading}</span>
        {value ? (
          <p className="whitespace-pre-wrap text-body text-ink">{value}</p>
        ) : (
          <p className="text-meta text-muted">Not yet written by the centre.</p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="field" value={field} />
      <span className="text-label font-bold tracking-[0.12em] text-muted uppercase">{heading}</span>
      <TrainerFeedbackTextarea
        name="value"
        rows={4}
        maxLength={LIMIT}
        defaultValue={value}
        className="rounded-[6px] border border-border bg-card px-3 py-2 text-body text-ink outline-none focus:border-primary"
      />
      <p className="text-label italic text-muted">{hint} Required on the Cambridge form; {LIMIT} characters.</p>
      {state.error ? <p className="text-body text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-3 py-1.5 text-body text-ink wash disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

export function CourseGradeFormFields({
  courseId,
  course,
  editable,
}: {
  courseId: string;
  course: Record<string, unknown> | null;
  editable: boolean;
}) {
  return (
    <div className="sheet flex flex-col gap-5">
      <div>
        <h2 className="text-h2 text-ink">Teaching Practice and Tutorials</h2>
        <p className="mt-1 text-body text-muted">
          The course-level half of the centre grade form, which comes before any candidate on Cambridge&rsquo;s own form.
          Four fields, all required, describing how the course ran rather than how anyone taught.
        </p>
      </div>
      {FIELDS.map((f) => (
        <Field
          key={f.field}
          courseId={courseId}
          field={f.field}
          heading={f.heading}
          hint={f.hint}
          value={((course?.[f.field] as string | null) ?? "") || ""}
          editable={editable}
        />
      ))}
    </div>
  );
}

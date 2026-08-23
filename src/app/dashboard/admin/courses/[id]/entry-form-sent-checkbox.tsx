"use client";

// for-claude-code-course-admin-landing-and-admissions.md §3: "'Mark as
// sent' -- a checkbox Course Admin ticks manually once they've actually
// submitted it in Appian." Reuses the existing entry_form_sent_at column
// and action unchanged -- this just swaps the old date-input UI for a
// checkbox, submitting today's date when checked and clearing it when
// unchecked, since the field only ever needed to answer "has this
// happened," not "on what exact date."
export function EntryFormSentCheckbox({
  action,
  courseId,
  fieldName,
  sent,
}: {
  action: (formData: FormData) => void;
  courseId: string;
  fieldName: string;
  sent: boolean;
}) {
  return (
    <form
      action={action}
      onChange={(e) => e.currentTarget.requestSubmit()}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name={fieldName} value={sent ? "" : new Date().toISOString().slice(0, 10)} />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" defaultChecked={sent} />
        Mark as sent
      </label>
    </form>
  );
}

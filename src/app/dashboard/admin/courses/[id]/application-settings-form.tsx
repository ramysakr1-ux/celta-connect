"use client";

import { updateApplicationSettings } from "@/app/dashboard/admin/courses/[id]/roster-actions";

// "The intake dropdown shows real availability" -- a course must be
// explicitly opened for applications with a real cap before /apply will
// list it. Restored here (2026-08-23) after being cut in the 4-panel
// rebuild: the new Course Admin landing list's "Interviewing now" vs
// "Launching soon" grouping reads accepting_applications directly, so it
// needs a real control, not just a column nobody can set.
export function ApplicationSettingsForm({
  courseId,
  accepting,
  applicationCap,
}: {
  courseId: string;
  accepting: boolean;
  applicationCap: number | null;
}) {
  return (
    <form
      action={updateApplicationSettings}
      className="flex flex-wrap items-center gap-4 border-t border-border-faint pt-3"
    >
      <input type="hidden" name="course_id" value={courseId} />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="accepting_applications" defaultChecked={accepting} />
        Accepting applications
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        Cap
        <input
          name="application_cap"
          type="number"
          min={1}
          defaultValue={applicationCap ?? ""}
          placeholder="No limit"
          className="h-8 w-20 rounded-[6px] border border-border bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary"
        />
      </label>
      <button type="submit" className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink hover:border-primary">
        Save
      </button>
    </form>
  );
}

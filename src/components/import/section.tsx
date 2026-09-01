import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/import/import-wizard";
import { UndoImportButton } from "@/components/import/undo-import-button";
import { VolunteerImportWizard } from "@/components/import/volunteer-import-wizard";
import { UndoVolunteerImportButton } from "@/components/import/undo-volunteer-import-button";
import { UNDO_WINDOW_DAYS, isWithinUndoWindow, undoDeadline } from "@/lib/spreadsheet-import";

/**
 * Bulk-loading people from a spreadsheet, rendered inside whichever room
 * owns the people it creates.
 *
 * This used to be one "Import" tab in Centre Management offering a choice of
 * Applicants or Volunteers. Ramy, 1 Sep 2026, working out where each room's
 * doors belong: applicants are the Admissions room's business and volunteers
 * are the Volunteer pool's, so the choice was between two things that were
 * never in the same room to begin with. "Import goes where the thing lives."
 *
 * Splitting it also dissolves a permission wrinkle that needed a special
 * case before: a course administrator holds volunteers.manage but not
 * import.run, so the single page had to admit either capability and gate
 * each half separately. Now each half is a page with one capability.
 *
 * Deliberately NOT a general "bring things in from Drive". It writes rows
 * into applicants and volunteer_students, and nothing else -- the column
 * matcher only offers people-fields. Drive is a file browser here, exactly
 * equivalent to uploading the same sheet from your desktop; the connection
 * it uses is the one made once in Centre settings.
 */
export async function SpreadsheetImportSection({
  kind,
  centerId,
}: {
  kind: "applicants" | "volunteers";
  centerId: string;
}) {
  const supabase = await createClient();

  // Ramy, 27 Aug 2026: none of these depend on each other, and the
  // existing-emails lookup used to sit in an async child rendered after
  // this batch resolved -- a whole extra sequential round trip.
  const [{ data: courses }, { data: imports }, { data: applicantEmailRows }] = await Promise.all([
    supabase.from("courses").select("id, name, end_date").eq("center_id", centerId).order("name"),
    supabase
      .from("spreadsheet_imports")
      .select("id, source_filename, tallies, created_at, undone_at, kind")
      .eq("center_id", centerId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(5),
    kind === "applicants"
      ? supabase.from("applicants").select("email").eq("center_id", centerId)
      : Promise.resolve({ data: [] as { email: string }[] }),
  ]);

  const courseList = courses ?? [];

  return (
    <div className="flex flex-col gap-6">
      {courseList.length === 0 ? (
        <div className="sheet text-sm text-muted">
          There are no courses in this centre yet. An import has to land on a specific course, so create one first.
        </div>
      ) : kind === "applicants" ? (
        <ImportWizard courses={courseList} existingEmails={(applicantEmailRows ?? []).map((a) => a.email.toLowerCase())} />
      ) : (
        <VolunteerImportSection courses={courseList} />
      )}

      {(imports ?? []).length > 0 ? (
        <div className="sheet flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Recent imports</p>
          {(imports ?? []).map((imp, i) => {
            const tallies = (imp.tallies ?? {}) as { willImport?: number };
            const undoable = !imp.undone_at && isWithinUndoWindow(imp.created_at);
            return (
              <div key={imp.id} className={`admin-hover flex items-center justify-between gap-3 py-2 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-ink">{imp.source_filename}</p>
                  <p className="text-xs text-muted">
                    {tallies.willImport ?? 0} imported &middot; {new Date(imp.created_at).toLocaleDateString("en-GB")}
                    {imp.undone_at
                      ? " · undone"
                      : undoable
                        ? ` · undo until ${undoDeadline(imp.created_at).toLocaleDateString("en-GB")}`
                        : ` · older than ${UNDO_WINDOW_DAYS} days, now ordinary data`}
                  </p>
                </div>
                {undoable ? kind === "applicants" ? <UndoImportButton importId={imp.id} /> : <UndoVolunteerImportButton importId={imp.id} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

async function VolunteerImportSection({ courses }: { courses: { id: string; name: string; end_date: string }[] }) {
  const supabase = await createClient();
  const courseIds = courses.map((c) => c.id);
  const { data: volunteers } =
    courseIds.length > 0 ? await supabase.from("volunteer_students").select("course_id, email").in("course_id", courseIds) : { data: [] };

  // Scoped per-course, not flattened across the whole centre -- the wizard's
  // duplicate check needs "already on THIS course", not "already anywhere
  // at this centre" (which would wrongly block someone simply new to a
  // different course).
  const existingEmailsByCourse: Record<string, string[]> = {};
  for (const v of volunteers ?? []) {
    if (!v.email) continue;
    (existingEmailsByCourse[v.course_id] ??= []).push(v.email.toLowerCase());
  }

  return <VolunteerImportWizard courses={courses} existingEmailsByCourse={existingEmailsByCourse} />;
}

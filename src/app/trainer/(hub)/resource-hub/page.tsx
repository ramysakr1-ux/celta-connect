import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ResourceCategoryManager } from "@/app/trainer/(hub)/resource-hub/resource-category-manager";
import { CoursebooksSection } from "@/app/portfolio/[traineeId]/resources/coursebooks-section";

// specs/build-spec.md "Replace the Audio Library tab with a Resource hub
// tab... six sections: TP points, coursebooks, multimedia, assignment
// briefs, input sessions, centre documents." Three of those (TP points,
// multimedia, assignment briefs) already have solid, working, dedicated
// pages -- this links out to them rather than duplicating that UI. The
// other three render inline: Coursebooks is a new lightweight section,
// Input sessions and Centre documents are the two genuinely new
// resources-table-backed sections (upload, incl. live HTML for input
// sessions, per-item trainee visibility).
export default async function TrainerResourceHubPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const courseId = trainer.course_id;

  const { data: scheduledCoursebookIds } = courseId
    ? await supabase.from("course_tp_schedule").select("tp_coursebook_id").eq("course_id", courseId)
    : { data: [] };
  const coursebookIds = [...new Set((scheduledCoursebookIds ?? []).map((s) => s.tp_coursebook_id))];

  const [{ data: coursebooks }, { data: inputSessionResources }, { data: centreDocResources }] = await Promise.all([
    coursebookIds.length > 0
      ? supabase.from("tp_coursebooks").select("id, title, level, access_notes").in("id", coursebookIds).order("title")
      : Promise.resolve({ data: [] }),
    supabase
      .from("resources")
      .select("*")
      .eq("center_id", trainer.center_id)
      .eq("category", "input_sessions")
      .or(courseId ? `course_id.eq.${courseId},course_id.is.null` : "course_id.is.null")
      .order("created_at", { ascending: false }),
    supabase
      .from("resources")
      .select("*")
      .eq("center_id", trainer.center_id)
      .eq("category", "centre_documents")
      .or(courseId ? `course_id.eq.${courseId},course_id.is.null` : "course_id.is.null")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="sheet p-6">
        <h1 className="font-serif text-xl text-ink">Resource hub</h1>
        <p className="mt-2 text-muted">
          Everything a candidate or tutor needs to find during the course, in one place. Trainees see a filtered
          version of this from their own portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/trainer/coursebooks" className="sheet flex flex-col gap-1 p-5 hover:border-primary/40">
          <p className="font-serif text-lg text-ink">TP points library →</p>
          <p className="text-xs text-muted">The staged point-by-point content. Trainer-only -- never shown to trainees.</p>
        </Link>
        <Link href="/trainer/audio" className="sheet flex flex-col gap-1 p-5 hover:border-primary/40">
          <p className="font-serif text-lg text-ink">Multimedia →</p>
          <p className="text-xs text-muted">Coursebook audio tracks. Manage uploads here; trainees can play them from their portfolio.</p>
        </Link>
        <Link href="/dashboard/trainer/assignment-briefs" className="sheet flex flex-col gap-1 p-5 hover:border-primary/40">
          <p className="font-serif text-lg text-ink">Assignment briefs →</p>
          <p className="text-xs text-muted">Upload and publish briefs. Trainees browse published sections from their portfolio.</p>
        </Link>
      </div>

      <div id="coursebooks">
        {(coursebooks ?? []).length > 0 ? (
          <CoursebooksSection coursebooks={coursebooks ?? []} isEditableStaff />
        ) : (
          <div className="sheet p-6">
            <h3 className="font-serif text-lg text-ink">Coursebooks</h3>
            <p className="mt-2 text-sm text-muted">
              Nothing scheduled yet -- set a coursebook for at least one TP number on the{" "}
              <Link href="/trainer/rotation" className="text-primary">
                Rotation
              </Link>{" "}
              page, then it&apos;ll appear here for candidates to see how to access it.
            </p>
          </div>
        )}
      </div>

      <div id="input-sessions">
        <h2 className="font-serif text-lg text-ink">Input sessions</h2>
        <p className="mt-1 text-sm text-muted">
          Materials for each input session -- a link, a file, or a self-contained interactive .html shown live.
        </p>
        <div className="mt-3">
          <ResourceCategoryManager category="input_sessions" centerId={trainer.center_id} resources={inputSessionResources ?? []} />
        </div>
      </div>

      <div id="centre-documents">
        <h2 className="font-serif text-lg text-ink">Centre documents</h2>
        <p className="mt-1 text-sm text-muted">
          Policies, blank forms, the syllabus. Defaults to trainer-only -- mark specific items visible to trainees
          (e.g. the appeals procedure) individually.
        </p>
        <div className="mt-3">
          <ResourceCategoryManager category="centre_documents" centerId={trainer.center_id} resources={centreDocResources ?? []} />
        </div>
      </div>
    </div>
  );
}

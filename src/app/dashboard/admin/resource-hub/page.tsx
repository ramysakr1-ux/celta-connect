import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { getCambridgeDocuments } from "@/lib/cambridge-documents";
import type { ResourceCategory } from "@/lib/supabase/types";
import { RoomHead } from "@/components/room-head";
import { ResourceCategoryManager } from "@/app/trainer/(hub)/resource-hub/resource-category-manager";
import { CambridgeDocumentsShelf } from "@/app/trainer/(hub)/resource-hub/cambridge-documents-shelf";
import { CoursebooksSection } from "@/app/portfolio/[traineeId]/resources/coursebooks-section";

// The centre's own Resource Hub.
//
// Ramy, 18 Sep 2026, walking Course administration as a course admin: every
// tile in that row opened a centre screen in his own shell except Resource
// hub, which sent him into the tutor hub -- Today, Roster, Timetable and the
// rest across the top, a navigation bar for a job he does not do. One tile in
// a row of tiles landing in somebody else's building.
//
// Deliberately NOT a copy of the hub's page (457 lines, and most of it is
// course-scoped: the TP material pool, this course's coursebook schedule,
// which TP points this course has used). A course admin has no course, so all
// of that would render empty. This is the centre-level shelf, which is what
// the tile counts and what the job needs -- built from the SAME section
// components the hub uses, so a section can never look like two different
// things depending on who opened it.
export const metadata = { title: "Resource hub" };

export default async function CentreResourceHubPage() {
  const admin = await requireRole("admin");
  const supabase = createAdminClient();
  const centerId = admin.center_id;
  if (!centerId) {
    return <div className="sheet text-body text-muted">No centre assigned.</div>;
  }

  const ctx = await getCentreRoleContext(admin);
  const cambridgeEditable = can(ctx.roles, "centre.settings.edit", ctx.overrides);

  const byCategory = (category: NonNullable<ResourceCategory>) =>
    supabase
      .from("resources")
      .select("*")
      // single-centre: a resource belongs to the branch that uploaded it, and
      // this shelf is what THIS branch keeps -- the same rule the coursebook
      // shelf next door follows. A branch showing another branch's documents
      // would be a leak, not a convenience.
      .eq("center_id", centerId)
      .eq("category", category)
      .is("course_id", null)
      .order("created_at", { ascending: false });

  const [
    { data: inputSessionResources },
    { data: formResources },
    { data: centreDocResources },
    { data: coursebooks },
    { data: centre },
  ] = await Promise.all([
    byCategory("input_sessions"),
    byCategory("forms"),
    byCategory("centre_documents"),
    // single-centre: per-centre coursebook shelf; a branch owns its own
    supabase.from("tp_coursebooks").select("id, title, level, access_notes").eq("center_id", centerId).order("title"),
    supabase.from("centers").select("organisation_id").eq("id", centerId).maybeSingle(),
  ]);

  const cambridgeDocsRaw = await getCambridgeDocuments(supabase, centerId, centre?.organisation_id ?? null);
  const cambridgeDocs = await Promise.all(
    cambridgeDocsRaw.map(async (doc) => ({
      ...doc,
      signedUrl: doc.storagePath
        ? ((await supabase.storage.from("resource-hub-files").createSignedUrl(doc.storagePath, 3600)).data?.signedUrl ?? null)
        : null,
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      <RoomHead
        eyebrow="Connect · course administration"
        title="Resource hub"
        lede={
          <>
            Everything the centre keeps for its courses, in one place: the coursebook shelf, the input sessions,
            the forms and the centre&apos;s own documents. A course carries these into every intake, so they are
            set here once rather than per course.
          </>
        }
      />

      {/* The two shelves that already have centre pages of their own keep
          them; pointing at them beats a second copy of either. */}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-5">
        <p className="text-body text-muted">Also the centre&apos;s, on their own pages:</p>
        <Link href="/dashboard/admin/coursebooks" className="text-body font-semibold text-primary hover:underline">
          TP Points Library
        </Link>
        <Link href="/dashboard/admin/assignment-briefs" className="text-body font-semibold text-primary hover:underline">
          Assignment briefs
        </Link>
      </div>

      {(coursebooks ?? []).length > 0 ? (
        <div className="card flex flex-col gap-4 p-5">
          <div>
            <h2 className="font-serif text-h3 font-semibold text-ink">Coursebooks</h2>
            <p className="mt-1 text-body text-muted">
              The shelf every course draws its teaching practice material from. Edit the shelf itself in the TP
              Points Library.
            </p>
          </div>
          <CoursebooksSection coursebooks={coursebooks ?? []} isEditableStaff />
        </div>
      ) : null}

      <div className="card flex flex-col gap-4 p-5">
        <h2 className="font-serif text-h3 font-semibold text-ink">Input sessions</h2>
        <ResourceCategoryManager
          category="input_sessions"
          centerId={centerId}
          resources={inputSessionResources ?? []}
          readOnly={false}
        />
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <h2 className="font-serif text-h3 font-semibold text-ink">Forms and documents</h2>
        <ResourceCategoryManager category="forms" centerId={centerId} resources={formResources ?? []} readOnly={false} />
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <h2 className="font-serif text-h3 font-semibold text-ink">Centre documents</h2>
        <ResourceCategoryManager
          category="centre_documents"
          centerId={centerId}
          resources={centreDocResources ?? []}
          readOnly={false}
        />
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <h2 className="font-serif text-h3 font-semibold text-ink">Cambridge documents</h2>
        <CambridgeDocumentsShelf docs={cambridgeDocs} editable={cambridgeEditable} />
      </div>

      <Link href="/dashboard/admin" className="text-body text-muted underline">
        Back to course administration
      </Link>
    </div>
  );
}

import { hubReadClient } from "@/lib/supabase/hub-read";
import Link from "next/link";
import { PageHead, HUB_BUTTON, HUB_PRIMARY, HUB_PRIMARY_STYLE } from "@/app/trainer/(hub)/page-head";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId, isAssessorTourMode } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { ResourceCategoryManager } from "@/app/trainer/(hub)/resource-hub/resource-category-manager";
import { CoursebooksSection } from "@/app/portfolio/[traineeId]/resources/coursebooks-section";
import { SectionsRail } from "@/app/trainer/(hub)/resource-hub/sections-rail";
import { ResourceHubSearch, type ResourceHubSearchItem } from "@/components/resource-hub-search";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { getCambridgeDocuments } from "@/lib/cambridge-documents";
import { CambridgeDocumentsShelf } from "@/app/trainer/(hub)/resource-hub/cambridge-documents-shelf";
import { MaterialPoolShelf } from "@/app/trainer/(hub)/resource-hub/material-pool-shelf";
import { MaterialPoolToggleCard } from "@/app/dashboard/admin/courses/[id]/material-pool-toggle-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";

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
  // for-claude-code-assessor-tour-mode.md: this page was trainer/admin-only
  // (requireRole threw for a cookie-only assessor session). A touring
  // assessor gets read access the same way roster/page.tsx and the other
  // widened pages already do -- try a real session first, fall back to the
  // assessor course, and only a plain (non-touring) assessor cookie is
  // still turned away, since resource-hub was never part of the base pack.
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  const tourMode = assessorCourseId ? await isAssessorTourMode() : false;
  if (!trainer && !tourMode) redirect("/login");

  const courseId = trainer?.course_id ?? assessorCourseId;
  const supabase = trainer && courseId ? hubReadClient(trainer, courseId) : createAdminClient();
  // UI visibility only, matching roster.tsx/grades-report.tsx's own isMct --
  // admin bypasses at the action layer (updateTpMaterialPoolEnabled), not
  // here, same split as every other MCT-gated section in the trainer hub.
  const isMct = trainer?.tutor_role === "main_course_tutor";

  const cambridgeAdmin = createAdminClient();
  // A trainer/admin session already carries center_id on their profile; an
  // assessor's cookie only ever resolves to a course_id (getAssessorCourseId),
  // so touring needs one extra lookup to get from there to the centre.
  const centerId =
    trainer?.center_id ?? (courseId ? (await cambridgeAdmin.from("courses").select("center_id").eq("id", courseId).maybeSingle()).data?.center_id : null) ?? null;
  if (!centerId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  // remaining-compliance.md §5 -- readable by everyone, editable only by
  // whoever can already edit centre settings (a trainer has no centre-role
  // context at all, so this is false for them regardless).
  const centreRoleCtx = trainer?.role === "admin" ? await getCentreRoleContext(trainer) : null;
  const cambridgeEditable = centreRoleCtx ? can(centreRoleCtx.roles, "centre.settings.edit") : false;
  const { data: cambridgeCentre } = await cambridgeAdmin.from("centers").select("organisation_id").eq("id", centerId).maybeSingle();
  const cambridgeDocsRaw = await getCambridgeDocuments(cambridgeAdmin, centerId, cambridgeCentre?.organisation_id ?? null);
  const cambridgeDocs = await Promise.all(
    cambridgeDocsRaw.map(async (doc) => ({
      ...doc,
      signedUrl: doc.storagePath ? (await cambridgeAdmin.storage.from("resource-hub-files").createSignedUrl(doc.storagePath, 3600)).data?.signedUrl ?? null : null,
    }))
  );

  const { data: scheduledCoursebookIds } = courseId
    ? await supabase.from("course_tp_schedule").select("tp_coursebook_id").eq("course_id", courseId)
    : { data: [] };
  const coursebookIds = [...new Set((scheduledCoursebookIds ?? []).map((s) => s.tp_coursebook_id))];

  // connect-spec-corrections-for-claude-code.md item 6 -- the pool is
  // centre/course-optional; skip the queries entirely when this course
  // doesn't use it (some centres keep the main coursebook for TP7/8).
  const { data: courseForMaterialPool } = courseId
    ? await supabase.from("courses").select("tp_material_pool_enabled").eq("id", courseId).maybeSingle()
    : { data: null };
  const materialPoolEnabled = courseForMaterialPool?.tp_material_pool_enabled ?? false;

  const { data: materialItemsRaw } = materialPoolEnabled
    ? await cambridgeAdmin
        .from("tp_material_pool_items")
        .select("*")
        .or(`center_id.is.null,center_id.eq.${centerId}`)
        .order("created_at", { ascending: false })
    : { data: [] };
  const { data: materialClaims } =
    materialPoolEnabled && courseId
      ? await cambridgeAdmin.from("tp_material_pool_claims").select("material_item_id, trainee_id, tp_number").eq("course_id", courseId)
      : { data: [] };
  const claimedTraineeIds = [...new Set((materialClaims ?? []).map((c) => c.trainee_id))];
  const { data: claimants } =
    claimedTraineeIds.length > 0 ? await cambridgeAdmin.from("profiles").select("id, full_name").in("id", claimedTraineeIds) : { data: [] };
  const claimantNameById = new Map((claimants ?? []).map((p) => [p.id, p.full_name]));
  const claimByItemId = new Map((materialClaims ?? []).map((c) => [c.material_item_id, c]));
  const materialItems = await Promise.all(
    (materialItemsRaw ?? []).map(async (item) => {
      const claim = claimByItemId.get(item.id);
      return {
        id: item.id,
        bookTitle: item.book_title,
        level: item.level,
        description: item.description,
        isBaseline: item.center_id === null,
        signedUrl: (await cambridgeAdmin.storage.from("resource-hub-files").createSignedUrl(item.storage_path, 3600)).data?.signedUrl ?? null,
        claimedByLabel: claim ? `${claimantNameById.get(claim.trainee_id) ?? "Someone"}, TP${claim.tp_number}` : null,
      };
    })
  );

  const [
    { data: coursebooks },
    { data: inputSessionResources },
    { data: centreDocResources },
    { data: formResources },
    { count: publishedPointCount },
    { count: multimediaCount },
    { count: videoCount },
    { count: assignmentBriefCount },
    { count: markingGuidanceCount },
    { data: schedule },
  ] = await Promise.all([
    coursebookIds.length > 0
      ? supabase.from("tp_coursebooks").select("id, title, level, access_notes").in("id", coursebookIds).order("title")
      : Promise.resolve({ data: [] }),
    supabase
      .from("resources")
      .select("*")
      .eq("center_id", centerId)
      .eq("category", "input_sessions")
      .or(courseId ? `course_id.eq.${courseId},course_id.is.null` : "course_id.is.null")
      .order("created_at", { ascending: false }),
    supabase
      .from("resources")
      .select("*")
      .eq("center_id", centerId)
      .eq("category", "centre_documents")
      .or(courseId ? `course_id.eq.${courseId},course_id.is.null` : "course_id.is.null")
      .order("created_at", { ascending: false }),
    supabase
      .from("resources")
      .select("*")
      .eq("center_id", centerId)
      .eq("category", "forms")
      .or(courseId ? `course_id.eq.${courseId},course_id.is.null` : "course_id.is.null")
      .order("created_at", { ascending: false }),
    supabase.from("tp_points").select("id", { count: "exact", head: true }).eq("status", "published").eq("center_id", centerId),
    supabase.from("tp_audio_library").select("id", { count: "exact", head: true }).eq("center_id", centerId),
    supabase.from("tp_video_library").select("id", { count: "exact", head: true }).eq("center_id", centerId),
    supabase.from("assignment_templates").select("id", { count: "exact", head: true }).eq("center_id", centerId),
    supabase.from("marking_guidance_entries").select("id", { count: "exact", head: true }).eq("center_id", centerId),
    courseId ? supabase.from("course_tp_schedule").select("tp_number, tp_coursebook_id").eq("course_id", courseId) : Promise.resolve({ data: [] }),
  ]);

  // "TP points" inline panel -- release style / round(s) / source / usage,
  // scoped to the coursebooks actually scheduled on THIS course (the full
  // centre-wide library stays on /trainer/coursebooks, linked above).
  const { data: scopedPoints } =
    coursebookIds.length > 0
      ? await supabase
          .from("tp_points")
          .select("id, tp_coursebook_id, tp_number, short_title, main_lesson_aim, density_tier, status")
          .in("tp_coursebook_id", coursebookIds)
          .eq("status", "published")
          .order("tp_number")
      : { data: [] };

  const { data: usageRows } = courseId
    ? await supabase.from("plan_assignments").select("tp_point_id").eq("course_id", courseId).not("tp_point_id", "is", null)
    : { data: [] };
  const usageByPointId = new Map<string, number>();
  for (const row of usageRows ?? []) {
    if (!row.tp_point_id) continue;
    usageByPointId.set(row.tp_point_id, (usageByPointId.get(row.tp_point_id) ?? 0) + 1);
  }
  const coursebookTitleById = new Map((coursebooks ?? []).map((c) => [c.id, c.title]));
  // A point can feed more than one round if the same coursebook is
  // scheduled for multiple TP numbers (course_tp_schedule, not tp_points
  // itself, is what maps a coursebook to a round).
  const roundsByCoursebookId = new Map<string, number[]>();
  for (const s of schedule ?? []) {
    const list = roundsByCoursebookId.get(s.tp_coursebook_id) ?? [];
    list.push(s.tp_number);
    roundsByCoursebookId.set(s.tp_coursebook_id, list);
  }
  const tpPointRows = (scopedPoints ?? []).map((p) => ({
    id: p.id,
    title: p.short_title || p.main_lesson_aim,
    releaseStyle: DENSITY_TIER_LABELS[p.density_tier].name,
    rounds: (roundsByCoursebookId.get(p.tp_coursebook_id) ?? [p.tp_number]).sort((a, b) => a - b),
    source: coursebookTitleById.get(p.tp_coursebook_id) ?? "Unknown",
    usageCount: usageByPointId.get(p.id) ?? 0,
  }));

  const searchItems: ResourceHubSearchItem[] = [
    { id: "link-tp-points-library", title: "TP points library", subtitle: "Full centre-wide library", href: "/trainer/coursebooks" },
    { id: "link-multimedia", title: "Multimedia", subtitle: "Coursebook audio tracks", href: "/trainer/audio" },
    { id: "link-video-library", title: "Video Library", subtitle: "Training and observation videos", href: "/trainer/video" },
    { id: "link-assignment-briefs", title: "Assignment briefs", subtitle: "Upload and publish briefs", href: "/trainer/assignment-briefs" },
    { id: "link-marking-guidance", title: "Marking guidance", subtitle: "Centre standardisation reference", href: "/trainer/marking-guidance" },
    ...tpPointRows.map((p) => ({ id: `tp-${p.id}`, title: p.title, subtitle: `TP points -- ${p.source}`, href: "#tp-points" })),
    ...(coursebooks ?? []).map((c) => ({ id: `cb-${c.id}`, title: c.title, subtitle: c.level ? `Coursebook -- ${c.level}` : "Coursebook", href: "#coursebooks" })),
    ...(inputSessionResources ?? []).map((r) => ({ id: `is-${r.id}`, title: r.title, subtitle: "Input sessions", href: "#input-sessions" })),
    ...(formResources ?? []).map((r) => ({ id: `fm-${r.id}`, title: r.title, subtitle: "Forms and documents", href: "#forms-and-documents" })),
    ...(centreDocResources ?? []).map((r) => ({ id: `cd-${r.id}`, title: r.title, subtitle: "Centre documents", href: "#centre-documents" })),
    ...cambridgeDocs.filter((d) => d.url || d.storagePath).map((d) => ({ id: `cam-${d.docType}`, title: d.label, subtitle: "Cambridge documents", href: "#cambridge-documents" })),
  ];

  const sectionCounts = {
    tpPoints: publishedPointCount ?? 0,
    coursebooks: coursebookIds.length,
    multimedia: multimediaCount ?? 0,
    videoLibrary: videoCount ?? 0,
    assignmentBriefs: assignmentBriefCount ?? 0,
    markingGuidance: markingGuidanceCount ?? 0,
    inputSessions: (inputSessionResources ?? []).length,
    centreDocuments: (centreDocResources ?? []).length,
    forms: (formResources ?? []).length,
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[190px_1fr]">
      <SectionsRail
        sections={[
          { href: "/trainer/coursebooks", label: "TP points", count: sectionCounts.tpPoints },
          { href: "#coursebooks", label: "Coursebooks", count: sectionCounts.coursebooks },
          { href: "/trainer/audio", label: "Multimedia", count: sectionCounts.multimedia },
          { href: "/trainer/video", label: "Video Library", count: sectionCounts.videoLibrary },
          { href: "/trainer/assignment-briefs", label: "Assignment briefs", count: sectionCounts.assignmentBriefs },
          { href: "/trainer/marking-guidance", label: "Marking guidance", count: sectionCounts.markingGuidance },
          { href: "#input-sessions", label: "Input sessions", count: sectionCounts.inputSessions },
          { href: "#forms-and-documents", label: "Forms and documents", count: sectionCounts.forms },
          { href: "#centre-documents", label: "Centre documents", count: sectionCounts.centreDocuments },
          { href: "#cambridge-documents", label: "Cambridge documents", count: cambridgeDocs.filter((d) => d.url || d.storagePath).length },
        ]}
      />

      <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Resource hub"
        title="Resource hub"
        lede="Everything a candidate or tutor needs to find during the course, in one place. Trainees see a filtered version of this from their own portfolio."
      >
        {/* for-claude-code-assessor-tour-mode.md: "no functional purpose
            beyond letting them see" -- both of these are write entry
            points a touring assessor shouldn't be invited to click. */}
        {trainer ? (
          <>
            <a href="#input-sessions" className={HUB_BUTTON}>
              Upload
            </a>
            <Link href="/trainer/coursebooks" className={HUB_PRIMARY} style={HUB_PRIMARY_STYLE}>
              New TP point
            </Link>
          </>
        ) : null}
      </PageHead>
      <div className="max-w-sm">
        <ResourceHubSearch items={searchItems} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/trainer/coursebooks" className="trainer-hover sheet flex flex-col gap-1 p-5">
          <p className="font-serif text-lg text-ink">TP points library</p>
          <p className="text-xs text-muted">The staged point-by-point content. Trainer-only -- never shown to trainees.</p>
        </Link>
        <Link href="/trainer/audio" className="trainer-hover sheet flex flex-col gap-1 p-5">
          <p className="font-serif text-lg text-ink">Multimedia</p>
          <p className="text-xs text-muted">Coursebook audio tracks. Manage uploads here; trainees can play them from their portfolio.</p>
        </Link>
        <Link href="/trainer/video" className="trainer-hover sheet flex flex-col gap-1 p-5">
          <p className="font-serif text-lg text-ink">Video Library</p>
          <p className="text-xs text-muted">Training and observation videos, linked not uploaded. Trainees can watch from their portfolio.</p>
        </Link>
        <Link href="/trainer/assignment-briefs" className="trainer-hover sheet flex flex-col gap-1 p-5">
          <p className="font-serif text-lg text-ink">Assignment briefs</p>
          <p className="text-xs text-muted">Upload and publish briefs. Trainees browse published sections from their portfolio.</p>
        </Link>
        <Link href="/trainer/marking-guidance" className="trainer-hover sheet flex flex-col gap-1 p-5">
          <p className="font-serif text-lg text-ink">Marking guidance</p>
          <p className="text-xs text-muted">Where this centre&apos;s line sits per criterion. Tutors and the assessor only -- never trainees.</p>
        </Link>
      </div>

      <div id="tp-points">
        <h2 className="font-serif text-lg text-ink">TP points — this course&apos;s schedule</h2>
        <p className="mt-1 text-sm text-muted">
          Release style, round, source and usage for every point in a coursebook scheduled on this course. The full
          centre-wide library (all coursebooks, all courses) is on the{" "}
          <Link href="/trainer/coursebooks" className="text-primary">
            TP points library
          </Link>
          .
        </p>
        <div className="mt-3 overflow-x-auto rounded-[6px] border border-border">
          {tpPointRows.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              No coursebook is scheduled on this course yet -- set one on the{" "}
              <Link href="/trainer/rotation" className="text-primary">
                Rotation
              </Link>{" "}
              page.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Point</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Release style</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Round(s)</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Source</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Usage</th>
                </tr>
              </thead>
              <tbody>
                {tpPointRows.map((p) => (
                  <tr key={p.id} className="border-b border-border-faint last:border-none">
                    <td className="px-4 py-2.5 text-ink">{p.title}</td>
                    <td className="px-4 py-2.5 text-muted">{p.releaseStyle}</td>
                    <td className="px-4 py-2.5 text-muted">{p.rounds.map((r) => `TP${r}`).join(", ")}</td>
                    <td className="px-4 py-2.5 text-muted">{p.source}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{p.usageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div id="coursebooks">
        {(coursebooks ?? []).length > 0 ? (
          <CoursebooksSection coursebooks={coursebooks ?? []} isEditableStaff={Boolean(trainer)} />
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
        <div className="mt-3 sheet flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink">
            The built-in library of interactive input sessions (lead-in, exercises, trainer notes) lives on its own
            page.
          </p>
          <Link
            href="/input-sessions"
            className="flex h-8 shrink-0 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            Open input sessions
          </Link>
        </div>
        <div className="mt-3">
          <ResourceCategoryManager category="input_sessions" centerId={centerId} resources={inputSessionResources ?? []} readOnly={!trainer} />
        </div>
      </div>

      <div id="forms-and-documents">
        <h2 className="font-serif text-lg text-ink">Forms and documents</h2>
        <p className="mt-1 text-sm text-muted">
          Blank PDFs of the built-in forms -- lesson plan template, self-evaluation form -- for when the platform is
          down or paper is preferred, plus the centre&apos;s wider Cambridge documentation set (admin handbook,
          syllabus, refresher training, and the rest). Use the visible-to-trainee toggle per item -- most of this set
          is trainer-only. The four core Cambridge originals (syllabus, admin handbook, appeals procedure, centre
          authorisation) also have their own dedicated slots in{" "}
          <a href="#cambridge-documents" className="text-primary">
            Cambridge documents
          </a>{" "}
          below.
        </p>
        <div className="mt-3">
          <ResourceCategoryManager category="forms" centerId={centerId} resources={formResources ?? []} readOnly={!trainer} />
        </div>
      </div>

      <div id="centre-documents">
        <h2 className="font-serif text-lg text-ink">Centre documents</h2>
        <p className="mt-1 text-sm text-muted">
          Policies and internal paperwork -- staff-only, never shown on a candidate&apos;s Resources tab regardless
          of the visible-to-trainee setting below. Cambridge&apos;s own documents live in{" "}
          <a href="#cambridge-documents" className="text-primary">
            Cambridge documents
          </a>{" "}
          instead.
        </p>
        <div className="mt-3">
          <ResourceCategoryManager category="centre_documents" centerId={centerId} resources={centreDocResources ?? []} readOnly={!trainer} />
        </div>
      </div>

      <div id="cambridge-documents">
        <h2 className="font-serif text-lg text-ink">Cambridge documents</h2>
        <p className="mt-1 text-sm text-muted">
          The CELTA Syllabus, Administration Handbook and Appeals Procedure -- one copy, read by every course
          {cambridgeCentre?.organisation_id ? " across the organisation" : ""}. The Centre Authorisation Certificate
          is this centre&apos;s own. Visible to candidates, tutors, admins and the assessor alike.
        </p>
        <div className="mt-3">
          <CambridgeDocumentsShelf docs={cambridgeDocs} editable={cambridgeEditable} />
        </div>
      </div>

      {isMct || materialPoolEnabled ? (
        <div id="tp-material-pool">
          <h2 className="font-serif text-lg text-ink">TP7/8 material pool</h2>
          {isMct && courseId ? (
            <div className="mt-3">
              <MaterialPoolToggleCard courseId={courseId} enabled={materialPoolEnabled} />
            </div>
          ) : null}
          {materialPoolEnabled ? (
            <div className="mt-3">
              <MaterialPoolShelf items={materialItems} readOnly={!trainer} />
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  );
}

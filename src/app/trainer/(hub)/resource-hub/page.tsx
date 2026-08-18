import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ResourceCategoryManager } from "@/app/trainer/(hub)/resource-hub/resource-category-manager";
import { CoursebooksSection } from "@/app/portfolio/[traineeId]/resources/coursebooks-section";
import { SectionsRail } from "@/app/trainer/(hub)/resource-hub/sections-rail";
import { ResourceHubSearch, type ResourceHubSearchItem } from "@/components/resource-hub-search";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { getCambridgeDocuments } from "@/lib/cambridge-documents";
import { CambridgeDocumentsShelf } from "@/app/trainer/(hub)/resource-hub/cambridge-documents-shelf";
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
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const courseId = trainer.course_id;

  // remaining-compliance.md §5 -- readable by everyone, editable only by
  // whoever can already edit centre settings (a trainer has no centre-role
  // context at all, so this is false for them regardless).
  const centreRoleCtx = trainer.role === "admin" ? await getCentreRoleContext(trainer) : null;
  const cambridgeEditable = centreRoleCtx ? can(centreRoleCtx.roles, "centre.settings.edit") : false;
  const cambridgeAdmin = createAdminClient();
  const { data: cambridgeCentre } = await cambridgeAdmin.from("centers").select("organisation_id").eq("id", trainer.center_id).maybeSingle();
  const cambridgeDocsRaw = await getCambridgeDocuments(cambridgeAdmin, trainer.center_id, cambridgeCentre?.organisation_id ?? null);
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

  const [
    { data: coursebooks },
    { data: inputSessionResources },
    { data: centreDocResources },
    { data: formResources },
    { count: publishedPointCount },
    { count: multimediaCount },
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
    supabase
      .from("resources")
      .select("*")
      .eq("center_id", trainer.center_id)
      .eq("category", "forms")
      .or(courseId ? `course_id.eq.${courseId},course_id.is.null` : "course_id.is.null")
      .order("created_at", { ascending: false }),
    supabase.from("tp_points").select("id", { count: "exact", head: true }).eq("status", "published").eq("center_id", trainer.center_id),
    supabase.from("tp_audio_library").select("id", { count: "exact", head: true }).eq("center_id", trainer.center_id),
    supabase.from("assignment_templates").select("id", { count: "exact", head: true }).eq("center_id", trainer.center_id),
    supabase.from("marking_guidance_entries").select("id", { count: "exact", head: true }).eq("center_id", trainer.center_id),
    courseId ? supabase.from("course_tp_schedule").select("tp_number, tp_coursebook_id") : Promise.resolve({ data: [] }),
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
    { id: "link-assignment-briefs", title: "Assignment briefs", subtitle: "Upload and publish briefs", href: "/dashboard/trainer/assignment-briefs" },
    { id: "link-marking-guidance", title: "Marking guidance", subtitle: "Centre standardisation reference", href: "/dashboard/trainer/marking-guidance" },
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
          { href: "/dashboard/trainer/assignment-briefs", label: "Assignment briefs", count: sectionCounts.assignmentBriefs },
          { href: "/dashboard/trainer/marking-guidance", label: "Marking guidance", count: sectionCounts.markingGuidance },
          { href: "#input-sessions", label: "Input sessions", count: sectionCounts.inputSessions },
          { href: "#forms-and-documents", label: "Forms and documents", count: sectionCounts.forms },
          { href: "#centre-documents", label: "Centre documents", count: sectionCounts.centreDocuments },
          { href: "#cambridge-documents", label: "Cambridge documents", count: cambridgeDocs.filter((d) => d.url || d.storagePath).length },
        ]}
      />

      <div className="flex flex-col gap-8">
      <div className="sheet p-6">
        <h1 className="font-serif text-xl text-ink">Resource hub</h1>
        <p className="mt-2 text-muted">
          Everything a candidate or tutor needs to find during the course, in one place. Trainees see a filtered
          version of this from their own portfolio.
        </p>
        <div className="mt-4 max-w-sm">
          <ResourceHubSearch items={searchItems} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <Link href="/dashboard/trainer/marking-guidance" className="sheet flex flex-col gap-1 p-5 hover:border-primary/40">
          <p className="font-serif text-lg text-ink">Marking guidance →</p>
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
        <div className="mt-3 sheet flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink">
            The built-in library of interactive input sessions (lead-in, exercises, trainer notes) lives on its own
            page.
          </p>
          <Link
            href="/input-sessions"
            className="flex h-8 shrink-0 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            Open input sessions →
          </Link>
        </div>
        <div className="mt-3">
          <ResourceCategoryManager category="input_sessions" centerId={trainer.center_id} resources={inputSessionResources ?? []} />
        </div>
      </div>

      <div id="forms-and-documents">
        <h2 className="font-serif text-lg text-ink">Forms and documents</h2>
        <p className="mt-1 text-sm text-muted">
          Blank PDFs of the built-in forms -- lesson plan template, self-evaluation form -- for when the platform is
          down or paper is preferred. Shown on every candidate&apos;s own Resources tab. Cambridge&apos;s own
          documents (syllabus, appeals procedure) live in{" "}
          <a href="#cambridge-documents" className="text-primary">
            Cambridge documents
          </a>{" "}
          below.
        </p>
        <div className="mt-3">
          <ResourceCategoryManager category="forms" centerId={trainer.center_id} resources={formResources ?? []} />
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
          <ResourceCategoryManager category="centre_documents" centerId={trainer.center_id} resources={centreDocResources ?? []} />
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
      </div>
    </div>
  );
}

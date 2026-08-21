import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeThisWeekRange } from "@/lib/course-progress";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { toLocalIso } from "@/lib/timetable-grid";
import {
  RESOURCE_CATEGORY_LABELS,
  RESOURCE_CATEGORY_ORDER,
  RESOURCE_TYPE_ICON,
  RESOURCE_TYPE_LABELS,
  TRAINER_ONLY_CATEGORIES,
} from "@/lib/resource-info";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { ResourceComposer } from "@/app/portfolio/[traineeId]/resources/resource-composer";
import { deleteResource } from "@/app/portfolio/[traineeId]/resources/actions";
import { ResourceContentLink } from "@/components/resource-content-link";
import { CoursebooksSection } from "@/app/portfolio/[traineeId]/resources/coursebooks-section";
import { MaterialPoolSection } from "@/app/portfolio/[traineeId]/resources/material-pool-section";
import { MultimediaSection } from "@/app/portfolio/[traineeId]/resources/multimedia-section";
import { VideoLibrarySection } from "@/app/portfolio/[traineeId]/resources/video-library-section";
import { AssignmentBriefsSection } from "@/app/portfolio/[traineeId]/resources/assignment-briefs-section";
import { SectionsRail } from "@/app/trainer/(hub)/resource-hub/sections-rail";
import { ResourceHubSearch, type ResourceHubSearchItem } from "@/components/resource-hub-search";
import { getCambridgeDocuments } from "@/lib/cambridge-documents";
import { CambridgeDocumentsShelf } from "@/app/trainer/(hub)/resource-hub/cambridge-documents-shelf";

// §5 -- Resource Hub, a genuinely new feature (the pre-existing `resources`
// table had zero UI anywhere). Starts empty by design -- no seeded content,
// admins/trainers add real center material over time via the composer
// below. A resource is either course-specific or center-wide
// (course_id null, "share across the whole center").
export default async function ResourceHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId } = await params;
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  // See portfolio/[traineeId]/layout.tsx's previewAsTrainee comment.
  const isEditableStaff = (viewer?.role === "trainer" || viewer?.role === "admin") && preview !== "trainee";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  // Assessor sees the same trainer-only material a trainer does (reviewing
  // for Cambridge); a real trainee, and a staff member previewing as one,
  // sees only what's actually marked visible_to_trainee.
  const canSeeTrainerOnly = isEditableStaff || Boolean(assessorCourseId);

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("center_id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  // remaining-compliance.md §5 -- "visible to candidates, tutors, admins
  // and the assessor alike," read-only here (uploading lives on the
  // trainer Resource Hub only, so there's one edit surface, not two).
  const cambridgeAdmin = createAdminClient();
  const { data: cambridgeCentre } = await cambridgeAdmin.from("centers").select("organisation_id").eq("id", trainee.center_id).maybeSingle();
  const cambridgeDocsRaw = await getCambridgeDocuments(cambridgeAdmin, trainee.center_id, cambridgeCentre?.organisation_id ?? null);
  const cambridgeDocs = await Promise.all(
    cambridgeDocsRaw.map(async (doc) => ({
      ...doc,
      signedUrl: doc.storagePath ? (await cambridgeAdmin.storage.from("resource-hub-files").createSignedUrl(doc.storagePath, 3600)).data?.signedUrl ?? null : null,
    }))
  );

  const query = supabase
    .from("resources")
    .select("*")
    .eq("center_id", trainee.center_id)
    .order("created_at", { ascending: false });
  const { data: resourcesRaw } = trainee.course_id
    ? await query.or(`course_id.eq.${trainee.course_id},course_id.is.null`)
    : await query.is("course_id", null);

  const resources = (resourcesRaw ?? []).filter((r) => {
    if (!canSeeTrainerOnly && TRAINER_ONLY_CATEGORIES.includes(r.category)) return false;
    return r.visible_to_trainee || canSeeTrainerOnly;
  });
  const byCategory = new Map<string, typeof resources>();
  for (const r of resources) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  // The other three hub sections have their own dedicated tables/pages
  // already (TP Points Library, Audio Library, Assignment Briefs) rather
  // than living in `resources` -- TP points stays trainer-only and isn't
  // shown here at all; these two read-only trainee views are new.
  //
  // Coursebooks: deliberately just the ones THIS course's schedule actually
  // uses (course_tp_schedule), not every coursebook in the centre's library
  // -- a centre can have several courses running different books.
  const { data: scheduledCoursebookIds } = trainee.course_id
    ? await supabase.from("course_tp_schedule").select("tp_coursebook_id").eq("course_id", trainee.course_id)
    : { data: [] };
  const coursebookIds = [...new Set((scheduledCoursebookIds ?? []).map((s) => s.tp_coursebook_id))];

  const [{ data: coursebooks }, { data: audioTracks }, { data: videos }, { data: briefs }, { data: course }] = await Promise.all([
    coursebookIds.length > 0
      ? supabase.from("tp_coursebooks").select("id, title, level, access_notes").in("id", coursebookIds).order("title")
      : Promise.resolve({ data: [] }),
    supabase.from("tp_audio_library").select("*").eq("center_id", trainee.center_id).order("coursebook_title"),
    supabase.from("tp_video_library").select("*").eq("center_id", trainee.center_id).order("created_at", { ascending: false }),
    supabase
      .from("assignment_templates")
      .select("id, assignment_type, sections, published_at")
      .eq("center_id", trainee.center_id)
      .not("published_at", "is", null),
    trainee.course_id
      ? supabase.from("courses").select("start_date, tp_material_pool_enabled").eq("id", trainee.course_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // for-claude-code-trainee-interface.md §5: "Fewer sections than the
  // trainer sees" -- a real trainee (or staff/assessor previewing as one)
  // gets the spec's restricted 3-panel layout; a real trainer/admin editing,
  // or the assessor (reviewing for Cambridge, needs the same material a
  // trainer sees), keeps the existing full stacked view with every category
  // and the composer -- this page is still their one management tool for
  // course-specific resources, distinct from the course-wide trainer hub.
  const showTraineeLayout = !canSeeTrainerOnly;

  let thisWeekSessions: {
    id: string;
    title: string;
    event_time: string | null;
    criteria: string[];
    materials: (typeof resources)[number][];
  }[] = [];
  if (showTraineeLayout && trainee.course_id && course?.start_date) {
    const today = toLocalIso(new Date());
    const { weekStart, weekEnd } = computeThisWeekRange(course.start_date, today);
    const { data: weekEvents } = await supabase
      .from("course_timetable_events")
      .select("id, title, event_date, event_time, input_session_criteria")
      .eq("course_id", trainee.course_id)
      .eq("type", "input_session")
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd)
      .order("event_date")
      .order("event_time");
    const inputSessionResources = byCategory.get("input_sessions") ?? [];
    thisWeekSessions = (weekEvents ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      event_time: e.event_time,
      criteria: e.input_session_criteria ?? [],
      // Best-effort real link, not a fabricated one: a materials resource
      // is only shown here when its title exactly matches this session's
      // timetable title (the same name a trainer/admin gave the event).
      // There's no per-session foreign key in the schema to join on
      // instead -- resources.category='input_sessions' is a flat list.
      materials: inputSessionResources.filter((r) => r.title.trim().toLowerCase() === e.title.trim().toLowerCase()),
    }));
  }
  const formResources = byCategory.get("forms") ?? [];

  const coursebookSearchItems: ResourceHubSearchItem[] = (coursebooks ?? []).map((c) => ({
    id: `cb-${c.id}`,
    title: c.title,
    subtitle: c.level ? `Coursebook -- ${c.level}` : "Coursebook",
    href: "#coursebooks",
  }));
  const briefSearchItems: ResourceHubSearchItem[] = (briefs ?? []).map((b) => ({
    id: `br-${b.id}`,
    title: ASSIGNMENT_INFO[b.assignment_type]?.title ?? b.assignment_type,
    subtitle: "Assignment briefs",
    href: "#assignment-briefs",
  }));

  if (showTraineeLayout) {
    // connect-spec-corrections-for-claude-code.md item 6 -- only the real
    // candidate viewing their own page can claim (never staff previewing,
    // never the assessor).
    const canClaimMaterial = viewer?.role === "trainee" && viewer.id === traineeId;
    // connect-spec-corrections-for-claude-code.md item 6 -- centre/course-
    // optional; skip the queries when this course doesn't use the pool.
    const materialPoolEnabled = course?.tp_material_pool_enabled ?? false;
    const { data: materialItemsRaw } = materialPoolEnabled
      ? await supabase
          .from("tp_material_pool_items")
          .select("*")
          .or(`center_id.is.null,center_id.eq.${trainee.center_id}`)
          .order("created_at", { ascending: false })
      : { data: [] };
    const { data: mySubgroupMember } = materialPoolEnabled
      ? await supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle()
      : { data: null };
    const { data: mySubgroup } = mySubgroupMember?.subgroup_id
      ? await supabase.from("course_subgroups").select("tp_group_id").eq("id", mySubgroupMember.subgroup_id).maybeSingle()
      : { data: null };
    const { data: groupClaims } = mySubgroup?.tp_group_id
      ? await supabase.from("tp_material_pool_claims").select("id, material_item_id, trainee_id, tp_number").eq("tp_group_id", mySubgroup.tp_group_id)
      : { data: [] };
    const claimByItemId = new Map((groupClaims ?? []).map((c) => [c.material_item_id, c]));
    const materialItems = await Promise.all(
      (materialItemsRaw ?? []).map(async (item) => {
        const claim = claimByItemId.get(item.id);
        return {
          id: item.id,
          bookTitle: item.book_title,
          level: item.level,
          description: item.description,
          isBaseline: item.center_id === null,
          signedUrl: (await supabase.storage.from("resource-hub-files").createSignedUrl(item.storage_path, 3600)).data?.signedUrl ?? null,
          claimedByOther: Boolean(claim && claim.trainee_id !== traineeId),
          claimedByMe: claim && claim.trainee_id === traineeId ? { id: claim.id, tpNumber: claim.tp_number as 7 | 8 } : null,
        };
      })
    );

    const audioSearchItems: ResourceHubSearchItem[] = [...new Set((audioTracks ?? []).map((t) => t.coursebook_title))].map((title) => ({
      id: `au-${title}`,
      title,
      subtitle: "Multimedia",
      href: "#multimedia",
    }));
    // This-week-only, matching what actually renders under "Input
    // sessions" in this layout -- every other item below points to a
    // section that's fully rendered, so a result here should be too.
    const inputSessionSearchItems: ResourceHubSearchItem[] = thisWeekSessions.flatMap((s) =>
      s.materials.map((m) => ({ id: `is-${m.id}`, title: m.title, subtitle: "Input sessions -- this week", href: "#input-sessions" }))
    );
    const formSearchItems: ResourceHubSearchItem[] = formResources.map((r) => ({
      id: `fm-${r.id}`,
      title: r.title,
      subtitle: "Forms and documents",
      href: "#forms-and-documents",
    }));
    const videoSearchItems: ResourceHubSearchItem[] = (videos ?? []).map((v) => ({
      id: `vi-${v.id}`,
      title: v.title,
      subtitle: "Video library",
      href: "#video-library",
    }));
    const searchItems = [
      ...inputSessionSearchItems,
      ...coursebookSearchItems,
      ...audioSearchItems,
      ...videoSearchItems,
      ...briefSearchItems,
      ...formSearchItems,
    ];
    const railSections = [
      { href: "#input-sessions", label: "Input sessions", count: byCategory.get("input_sessions")?.length ?? 0 },
      { href: "#coursebooks", label: "Coursebooks", count: coursebooks?.length ?? 0 },
      { href: "#multimedia", label: "Multimedia", count: audioTracks?.length ?? 0 },
      { href: "#video-library", label: "Video library", count: videos?.length ?? 0 },
      { href: "#assignment-briefs", label: "Assignment briefs", count: briefs?.length ?? 0 },
      { href: "#forms-and-documents", label: "Forms and documents", count: formResources.length },
      { href: "#cambridge-documents", label: "Cambridge documents", count: cambridgeDocs.filter((d) => d.url || d.storagePath).length },
    ];

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="font-serif text-xl text-ink">Everything the centre has given you</h2>
          <div className="w-full sm:max-w-xs">
            <ResourceHubSearch items={searchItems} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[210px_1fr_1fr] lg:items-start">
          <SectionsRail sections={railSections} />

          <div className="flex flex-col gap-6">
            <div id="input-sessions" className="scroll-mt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Input sessions -- this week</h3>
                <Link href="/input-sessions" className="shrink-0 text-xs font-semibold text-primary">
                  Open session library →
                </Link>
              </div>
              {thisWeekSessions.length === 0 ? (
                <p className="mt-3 sheet border-dashed text-sm text-muted">Nothing scheduled this week.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {thisWeekSessions.map((s) => (
                    <li key={s.id} className="sheet flex flex-col gap-1.5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-ink">{s.title}</p>
                        {s.event_time ? <span className="shrink-0 text-xs tabular-nums text-muted">{s.event_time.slice(0, 5)}</span> : null}
                      </div>
                      {s.criteria.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.criteria.map((code) => (
                            <span key={code} className="badge-solid" title={CRITERIA_LABELS[code] ?? ""}>
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {s.materials.length === 0 ? (
                        <p className="text-xs text-muted">No materials linked yet.</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {s.materials.map((m) => (
                            <li key={m.id}>
                              <ResourceContentLink title={m.title} fileUrl={m.file_url} storagePath={m.storage_path} contentType={m.content_type} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div id="coursebooks" className="scroll-mt-4">
              <CoursebooksSection coursebooks={coursebooks ?? []} isEditableStaff={false} />
            </div>

            {materialPoolEnabled ? (
              <div id="tp-material-pool" className="scroll-mt-4">
                <MaterialPoolSection items={materialItems} canClaim={canClaimMaterial} />
              </div>
            ) : null}

            <div id="multimedia" className="scroll-mt-4">
              <MultimediaSection tracks={audioTracks ?? []} />
            </div>

            {(videos ?? []).length > 0 ? (
              <div id="video-library" className="scroll-mt-4">
                <VideoLibrarySection videos={videos ?? []} />
              </div>
            ) : null}

            <div id="assignment-briefs" className="scroll-mt-4">
              <AssignmentBriefsSection briefs={briefs ?? []} />
            </div>
          </div>

          <div id="forms-and-documents" className="scroll-mt-4">
            <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Forms and documents</h3>
            <p className="mt-1 text-xs text-muted">Blank PDFs for when the platform is down or paper is preferred.</p>
            {formResources.length === 0 ? (
              <p className="mt-3 sheet border-dashed text-sm text-muted">Nothing here yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {formResources.map((resource) => (
                  <li key={resource.id} className="sheet flex flex-col gap-1.5 p-4">
                    <ResourceContentLink
                      title={resource.title}
                      fileUrl={resource.file_url}
                      storagePath={resource.storage_path}
                      contentType={resource.content_type}
                    />
                    {resource.description ? <p className="text-xs leading-relaxed text-muted">{resource.description}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div id="cambridge-documents" className="scroll-mt-4">
            <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Cambridge documents</h3>
            <p className="mt-1 text-xs text-muted">The syllabus, the administration handbook, and the appeals procedure.</p>
            <div className="mt-3">
              <CambridgeDocumentsShelf docs={cambridgeDocs} editable={false} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resourceSearchItems: ResourceHubSearchItem[] = resources.map((r) => ({
    id: `res-${r.id}`,
    title: r.title,
    subtitle: RESOURCE_CATEGORY_LABELS[r.category],
    href: `#${r.category}`,
  }));
  const staffSearchItems = [...resourceSearchItems, ...coursebookSearchItems, ...briefSearchItems];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="font-serif text-xl text-ink">Resource Hub</h2>
        <div className="w-full sm:max-w-xs">
          <ResourceHubSearch items={staffSearchItems} />
        </div>
        <p className="shrink-0 text-xs text-muted">{resources.length} items</p>
      </div>

      {isEditableStaff ? <ResourceComposer traineeId={traineeId} centerId={trainee.center_id} /> : null}

      <div id="coursebooks">
        <CoursebooksSection coursebooks={coursebooks ?? []} isEditableStaff={isEditableStaff} />
      </div>
      <div id="multimedia">
        <MultimediaSection tracks={audioTracks ?? []} />
      </div>
      <div id="video-library">
        <VideoLibrarySection videos={videos ?? []} />
      </div>
      <div id="assignment-briefs">
        <AssignmentBriefsSection briefs={briefs ?? []} />
      </div>
      <div id="cambridge-documents">
        <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Cambridge documents</h3>
        <p className="mt-1 text-xs text-muted">
          The syllabus, the administration handbook and the appeals procedure -- one copy, read by every course.
        </p>
        <div className="mt-3">
          <CambridgeDocumentsShelf docs={cambridgeDocs} editable={false} />
        </div>
      </div>

      {resources.length === 0 && !isEditableStaff ? (
        <p className="sheet text-sm text-muted">No resources yet.</p>
      ) : (
        // Staff sees every category's heading even at zero items -- "the
        // hub with all the same dimensions and headings" was the explicit
        // ask (so the whole shape is visible before any real file is
        // attached); a trainee only ever sees categories that actually
        // have something in them, an empty heading would just read as
        // broken/missing content to them, not "not filled in yet".
        (isEditableStaff ? RESOURCE_CATEGORY_ORDER : RESOURCE_CATEGORY_ORDER.filter((category) => byCategory.has(category))).map(
          (category) => (
          <div key={category} id={category} className="scroll-mt-4">
            {/* Traced live off the Lovable reference 5 Aug 2026: group
                headings are Newsreader (serif), not the app's default
                Karla -- easy to miss since every other overline label in
                the app IS plain Karla; this one specifically isn't. */}
            <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">
              {RESOURCE_CATEGORY_LABELS[category]}
            </h3>
            {!byCategory.has(category) ? (
              <p className="mt-3 sheet border-dashed text-sm text-muted">No items in this category yet.</p>
            ) : (
            <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {byCategory.get(category)!.map((resource) => (
                <li key={resource.id} className="sheet flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
                      {(() => {
                        const Icon = RESOURCE_TYPE_ICON[resource.resource_type];
                        return <Icon className="size-4" aria-hidden="true" />;
                      })()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <ResourceContentLink
                        title={resource.title}
                        fileUrl={resource.file_url}
                        storagePath={resource.storage_path}
                        contentType={resource.content_type}
                      />
                      {resource.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted">{resource.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-block rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                          {RESOURCE_TYPE_LABELS[resource.resource_type]}
                        </span>
                        {!resource.visible_to_trainee && canSeeTrainerOnly ? (
                          <span className="inline-block rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                            Trainer only
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {isEditableStaff ? (
                    <form action={deleteResource}>
                      <input type="hidden" name="resource_id" value={resource.id} />
                      <input type="hidden" name="trainee_id" value={traineeId} />
                      <button type="submit" className="text-xs text-destructive hover:underline">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            )}
          </div>
          )
        )
      )}
    </div>
  );
}

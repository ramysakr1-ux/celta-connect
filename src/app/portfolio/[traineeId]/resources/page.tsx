import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeThisWeekRange } from "@/lib/course-progress";
import { mostRecentFridayBefore } from "@/lib/starts-monday-cron";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_TYPE_ICON, RESOURCE_TYPE_LABELS, TRAINER_ONLY_CATEGORIES } from "@/lib/resource-info";
import { HUB_CATEGORY_ORDER, HUB_CATEGORY_LABELS, HUB_STAFF_ONLY, type HubCategoryKey } from "@/lib/resource-hub-categories";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { Database } from "@/lib/supabase/types";
import { ResourceComposer } from "@/app/portfolio/[traineeId]/resources/resource-composer";
import { deleteResource } from "@/app/portfolio/[traineeId]/resources/actions";
import { ResourceContentLink } from "@/components/resource-content-link";
import { HubCategorySection } from "@/app/portfolio/[traineeId]/resources/hub-category-section";
import { CoursebooksSection } from "@/app/portfolio/[traineeId]/resources/coursebooks-section";
import { MaterialPoolSection } from "@/app/portfolio/[traineeId]/resources/material-pool-section";
import { MultimediaSection } from "@/app/portfolio/[traineeId]/resources/multimedia-section";
import { VideoLibrarySection } from "@/app/portfolio/[traineeId]/resources/video-library-section";
import { AssignmentBriefsSection } from "@/app/portfolio/[traineeId]/resources/assignment-briefs-section";
import { ResourceHubSearch, type ResourceHubSearchItem } from "@/components/resource-hub-search";
import { getCambridgeDocuments } from "@/lib/cambridge-documents";
import { CambridgeDocumentsShelf } from "@/app/trainer/(hub)/resource-hub/cambridge-documents-shelf";
import { markScavengerHuntFound } from "@/lib/scavenger-hunt";

type ResourceRow = Database["public"]["Tables"]["resources"]["Row"];

// Resource Hub.dc.html screen 1b's own item card, exact values -- used for
// every plain resources.category grid (lesson planning, forms, etc).
function ResourceItemCard({ resource, isEditableStaff, traineeId }: { resource: ResourceRow; isEditableStaff: boolean; traineeId: string }) {
  const Icon = RESOURCE_TYPE_ICON[resource.resource_type];
  return (
    <li className="trainee-hover-fill flex flex-col gap-[5px] rounded-[6px] border border-border bg-[oklch(96.4%_0.014_85)] p-[11px_12px]">
      <div className="flex items-start gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <ResourceContentLink title={resource.title} fileUrl={resource.file_url} storagePath={resource.storage_path} contentType={resource.content_type} />
          <p className="mt-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">{RESOURCE_TYPE_LABELS[resource.resource_type]}</p>
        </div>
      </div>
      {resource.description ? <p className="text-[11px] leading-[1.4] text-muted">{resource.description}</p> : null}
      {!resource.visible_to_trainee && isEditableStaff ? (
        <span className="self-start rounded-full border border-border bg-surface-muted px-2 py-[1px] text-[10px] font-semibold text-muted">Trainer only</span>
      ) : null}
      {isEditableStaff ? (
        <form action={deleteResource}>
          <input type="hidden" name="resource_id" value={resource.id} />
          <input type="hidden" name="trainee_id" value={traineeId} />
          <button type="submit" className="self-start text-[11px] text-destructive hover:underline">
            Remove
          </button>
        </form>
      ) : null}
    </li>
  );
}

function PlainCategoryGrid({ resources, isEditableStaff, traineeId }: { resources: ResourceRow[]; isEditableStaff: boolean; traineeId: string }) {
  if (resources.length === 0) return <p className="sheet border-dashed text-sm text-muted">Nothing here yet.</p>;
  return (
    <ul className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 xl:grid-cols-4">
      {resources.map((r) => (
        <ResourceItemCard key={r.id} resource={r} isEditableStaff={isEditableStaff} traineeId={traineeId} />
      ))}
    </ul>
  );
}

// §5 -- Resource Hub. Rebuilt 28 Aug 2026 against Resource Hub.dc.html and
// for-claude-code-pre-course-task-screens.md's "Location -- updated 28 Aug
// 2026" section, after a long conversation nailing down the real 15-category
// structure with Ramy directly. One unified render path for every viewer
// now (was two separate branches) -- staff and trainees see the same
// collapsed-table-of-contents shell, differing only in which categories are
// visible (HUB_STAFF_ONLY) and the per-item "Trainer only" tag.
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
  const isEditableStaff = (viewer?.role === "trainer" || viewer?.role === "admin") && preview !== "trainee";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  const canSeeTrainerOnly = isEditableStaff || Boolean(assessorCourseId);

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("center_id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const timeZone = (await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  if (viewer?.role === "trainee" && trainee.course_id) {
    await markScavengerHuntFound(supabase, trainee.course_id, viewer.id, "syllabus");
  }

  const cambridgeAdmin = createAdminClient();
  const { data: cambridgeCentre } = await cambridgeAdmin.from("centers").select("organisation_id").eq("id", trainee.center_id).maybeSingle();
  const cambridgeDocsRaw = await getCambridgeDocuments(cambridgeAdmin, trainee.center_id, cambridgeCentre?.organisation_id ?? null);
  const cambridgeDocs = await Promise.all(
    cambridgeDocsRaw.map(async (doc) => ({
      ...doc,
      signedUrl: doc.storagePath ? (await cambridgeAdmin.storage.from("resource-hub-files").createSignedUrl(doc.storagePath, 3600)).data?.signedUrl ?? null : null,
    }))
  );

  const query = supabase.from("resources").select("*").eq("center_id", trainee.center_id).order("created_at", { ascending: false });
  const { data: resourcesRaw } = trainee.course_id ? await query.or(`course_id.eq.${trainee.course_id},course_id.is.null`) : await query.is("course_id", null);
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
  const formResources = byCategory.get("forms") ?? [];

  const { data: scheduledCoursebookIds } = trainee.course_id
    ? await supabase.from("course_tp_schedule").select("tp_coursebook_id").eq("course_id", trainee.course_id)
    : { data: [] };
  const coursebookIds = [...new Set((scheduledCoursebookIds ?? []).map((s) => s.tp_coursebook_id))];

  const [{ data: coursebooks }, { data: audioTracks }, { data: videos }, { data: briefs }, { data: course }, { data: precourseSections }, { data: precourseProgress }, { data: huntProgress }] =
    await Promise.all([
      coursebookIds.length > 0 ? supabase.from("tp_coursebooks").select("id, title, level, access_notes").in("id", coursebookIds).order("title") : Promise.resolve({ data: [] }),
      supabase.from("tp_audio_library").select("*").eq("center_id", trainee.center_id).order("coursebook_title"),
      supabase.from("tp_video_library").select("*").eq("center_id", trainee.center_id).order("created_at", { ascending: false }),
      supabase.from("assignment_templates").select("id, assignment_type, sections, published_at").eq("center_id", trainee.center_id).not("published_at", "is", null),
      trainee.course_id ? supabase.from("courses").select("start_date, tp_material_pool_enabled").eq("id", trainee.course_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("pre_course_task_sections").select("id").eq("center_id", trainee.center_id),
      supabase.from("pre_course_task_progress").select("section_id, completed_at").eq("trainee_id", traineeId),
      supabase.from("scavenger_hunt_progress").select("question_key").eq("trainee_id", traineeId),
    ]);

  // Pre-course Task door -- for-claude-code-pre-course-task-screens.md's
  // "Location" update: "shows 'Continue your pre-course task' pre-
  // completion, 'Answer key is live' post-unlock." Same two states the
  // Today hero card already computes, now also the door's own card content.
  const precourseSectionsTotal = precourseSections?.length ?? 0;
  const precourseSectionsDone = (precourseProgress ?? []).filter((p) => p.completed_at).length;
  const precourseAllDone = precourseSectionsTotal > 0 && precourseSectionsDone >= precourseSectionsTotal;
  const answerKeyDate = course?.start_date ? mostRecentFridayBefore(course.start_date) : null;
  const answerKeyLive = precourseAllDone && Boolean(answerKeyDate && today >= answerKeyDate);
  const huntFoundCount = (huntProgress ?? []).length;

  let thisWeekSessions: { id: string; title: string; event_time: string | null; criteria: string[]; materials: (typeof resources)[number][] }[] = [];
  if (trainee.course_id && course?.start_date) {
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
      materials: inputSessionResources.filter((r) => r.title.trim().toLowerCase() === e.title.trim().toLowerCase()),
    }));
  }

  const canClaimMaterial = viewer?.role === "trainee" && viewer.id === traineeId;
  const materialPoolEnabled = course?.tp_material_pool_enabled ?? false;
  const [{ data: materialItemsRaw }, { data: mySubgroupMember }] = await Promise.all([
    materialPoolEnabled
      ? supabase.from("tp_material_pool_items").select("*").or(`center_id.is.null,center_id.eq.${trainee.center_id}`).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    materialPoolEnabled ? supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: mySubgroup } = mySubgroupMember?.subgroup_id
    ? await supabase.from("course_subgroups").select("tp_group_id").eq("id", mySubgroupMember.subgroup_id).maybeSingle()
    : { data: null };
  const { data: groupClaims } = mySubgroup?.tp_group_id
    ? await supabase.from("tp_material_pool_claims").select("id, material_item_id, trainee_id, tp_number").eq("tp_group_id", mySubgroup.tp_group_id)
    : { data: [] };
  const claimByItemId = new Map((groupClaims ?? []).map((c) => [c.material_item_id, c]));
  const materialItems = await Promise.all(
    (materialItemsRaw ?? []).map(async (item) => ({
      id: item.id,
      bookTitle: item.book_title,
      level: item.level,
      description: item.description,
      isBaseline: item.center_id === null,
      signedUrl: (await supabase.storage.from("resource-hub-files").createSignedUrl(item.storage_path, 3600)).data?.signedUrl ?? null,
      claimedByOther: Boolean(claimByItemId.get(item.id) && claimByItemId.get(item.id)!.trainee_id !== traineeId),
      claimedByMe:
        claimByItemId.get(item.id) && claimByItemId.get(item.id)!.trainee_id === traineeId
          ? { id: claimByItemId.get(item.id)!.id, tpNumber: claimByItemId.get(item.id)!.tp_number as 7 | 8 }
          : null,
    }))
  );

  const countByKey: Record<HubCategoryKey, number> = {
    input_sessions: thisWeekSessions.length,
    lesson_planning: byCategory.get("lesson_planning")?.length ?? 0,
    teaching_practice: byCategory.get("teaching_practice")?.length ?? 0,
    tp78_materials: materialItems.length,
    multimedia: (audioTracks?.length ?? 0) + (videos?.length ?? 0),
    coursebooks: coursebooks?.length ?? 0,
    written_assignments: (byCategory.get("written_assignments")?.length ?? 0) + (briefs?.length ?? 0),
    cambridge_documentation: (byCategory.get("cambridge_documentation")?.length ?? 0) + cambridgeDocs.filter((d) => d.url || d.storagePath).length,
    reading: byCategory.get("reading")?.length ?? 0,
    filmed_observations: byCategory.get("filmed_observations")?.length ?? 0,
    precourse_task: precourseSectionsTotal,
    forms: formResources.length,
    centre_documents: byCategory.get("centre_documents")?.length ?? 0,
    admissions: byCategory.get("admissions")?.length ?? 0,
    tp_points: coursebooks?.length ?? 0,
  };
  const visibleCategories = HUB_CATEGORY_ORDER.filter((k) => canSeeTrainerOnly || !HUB_STAFF_ONLY.includes(k));
  const totalItems = visibleCategories.reduce((sum, k) => sum + countByKey[k], 0);

  const coursebookSearchItems: ResourceHubSearchItem[] = (coursebooks ?? []).map((c) => ({ id: `cb-${c.id}`, title: c.title, subtitle: "Coursebooks", href: "#coursebooks" }));
  const briefSearchItems: ResourceHubSearchItem[] = (briefs ?? []).map((b) => ({
    id: `br-${b.id}`,
    title: ASSIGNMENT_INFO[b.assignment_type]?.title ?? b.assignment_type,
    subtitle: "Written Assignments",
    href: "#written_assignments",
  }));
  const resourceSearchItems: ResourceHubSearchItem[] = resources.map((r) => ({ id: `res-${r.id}`, title: r.title, subtitle: RESOURCE_CATEGORY_LABELS[r.category], href: `#${r.category}` }));
  const searchItems = [...resourceSearchItems, ...coursebookSearchItems, ...briefSearchItems];

  return (
    <div className="flex flex-col gap-6 rounded-[6px] border border-border bg-[oklch(96.4%_0.014_85)] p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-[22px] font-semibold text-ink">Resource Hub</h2>
        <p className="text-xs text-muted">
          {totalItems} items · {visibleCategories.length} categories
        </p>
      </div>

      <div className="flex h-10 items-center gap-3 rounded-[6px] border border-border bg-card px-[15px]">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="6.6" cy="6.6" r="4.6" stroke="currentColor" strokeWidth="1.6" className="text-muted" />
          <path d="M10.2 10.2 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-muted" />
        </svg>
        <div className="flex-1">
          <ResourceHubSearch items={searchItems} />
        </div>
        <p className="hidden shrink-0 text-[11px] text-muted sm:block">finds files, sessions and forms — not answers</p>
      </div>

      {isEditableStaff ? <ResourceComposer traineeId={traineeId} centerId={trainee.center_id} /> : null}

      <div className="overflow-hidden rounded-[6px] border border-border bg-card">
        {visibleCategories.map((key) => (
          <HubCategorySection key={key} label={HUB_CATEGORY_LABELS[key]} count={`${countByKey[key]} items`} restricted={HUB_STAFF_ONLY.includes(key)}>
            {key === "input_sessions" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted">This week — full library and timetable order coming soon</p>
                  <Link href="/input-sessions" className="shrink-0 text-xs font-semibold text-primary">
                    Open session library →
                  </Link>
                </div>
                {thisWeekSessions.length === 0 ? (
                  <p className="sheet border-dashed text-sm text-muted">Nothing scheduled this week.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {thisWeekSessions.map((s) => (
                      <li key={s.id} className="sheet trainee-hover flex flex-col gap-1.5 p-4">
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
            ) : key === "coursebooks" ? (
              <CoursebooksSection coursebooks={coursebooks ?? []} isEditableStaff={isEditableStaff} />
            ) : key === "tp78_materials" ? (
              materialPoolEnabled ? (
                <MaterialPoolSection items={materialItems} canClaim={canClaimMaterial} />
              ) : (
                <p className="sheet border-dashed text-sm text-muted">Not enabled for this course.</p>
              )
            ) : key === "multimedia" ? (
              <div className="flex flex-col gap-5">
                <MultimediaSection tracks={audioTracks ?? []} />
                {/* Ramy, 28 Aug 2026: "Multimedia could be video and audio
                    for the coursebooks... keep the filmed observations
                    separate." Coursebook-linked video has no real data
                    source yet (tp_video_library has no book/level tie --
                    it's the generic external-link shelf below), so this
                    group is an honest empty state, not invented content. */}
                <div>
                  <h4 className="text-sm font-medium text-ink">Video</h4>
                  <p className="sheet mt-2 border-dashed text-sm text-muted">
                    No coursebook-linked video source built yet — flagged for Ramy, not fabricated.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-ink">Other videos</h4>
                  <VideoLibrarySection videos={videos ?? []} />
                </div>
              </div>
            ) : key === "written_assignments" ? (
              <div className="flex flex-col gap-4">
                <PlainCategoryGrid resources={byCategory.get("written_assignments") ?? []} isEditableStaff={isEditableStaff} traineeId={traineeId} />
                <AssignmentBriefsSection briefs={briefs ?? []} />
              </div>
            ) : key === "cambridge_documentation" ? (
              <div className="flex flex-col gap-4">
                <PlainCategoryGrid resources={byCategory.get("cambridge_documentation") ?? []} isEditableStaff={isEditableStaff} traineeId={traineeId} />
                <CambridgeDocumentsShelf docs={cambridgeDocs} editable={false} />
              </div>
            ) : key === "precourse_task" ? (
              <Link
                href={`/portfolio/${traineeId}/pre-course-task`}
                className="sheet-accent trainee-hover flex flex-col gap-2 rounded-[8px] p-5"
                style={{ background: "color-mix(in oklab, var(--color-accent) 40%, var(--color-card))" }}
              >
                <p className="text-[10.5px] font-semibold tracking-[0.12em] text-primary uppercase">{answerKeyLive ? "Answer key live" : "In progress"}</p>
                <p className="font-serif text-lg font-semibold text-ink-warm">Pre-course Task</p>
                <p className="text-sm text-ink-warm">
                  {answerKeyLive
                    ? `All ${precourseSectionsTotal} sections done, and the Friday-before date has arrived — same door, flipped state. Compare your own answers at your own pace; nothing to submit here.`
                    : `${precourseSectionsDone} of ${precourseSectionsTotal} sections done. Answer key stays hidden — it unlocks cohort-wide on the Friday before the course starts, not on completion. Find your way around: ${huntFoundCount} of 6 found.`}
                </p>
                <span className="mt-1 self-start rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
                  {answerKeyLive ? "Open answer key" : "Continue"}
                </span>
              </Link>
            ) : key === "tp_points" ? (
              <Link href="/trainer/coursebooks" className="sheet trainee-hover flex flex-col gap-1 p-4">
                <p className="text-sm font-semibold text-ink">TP Points Library</p>
                <p className="text-xs text-muted">Staff-only — opens the trainer's coursebooks & TP points management.</p>
              </Link>
            ) : key === "forms" ? (
              <PlainCategoryGrid resources={formResources} isEditableStaff={isEditableStaff} traineeId={traineeId} />
            ) : (
              <PlainCategoryGrid resources={byCategory.get(key) ?? []} isEditableStaff={isEditableStaff} traineeId={traineeId} />
            )}
          </HubCategorySection>
        ))}
      </div>
    </div>
  );
}

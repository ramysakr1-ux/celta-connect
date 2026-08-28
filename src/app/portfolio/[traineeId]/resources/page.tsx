import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { TIMETABLE_TITLE_TO_INPUT_SESSION_SLUG } from "@/lib/input-session-registry-links";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_TYPE_ICON, RESOURCE_TYPE_LABELS, TRAINER_ONLY_CATEGORIES } from "@/lib/resource-info";
import { MonitorPlay, CalendarClock } from "lucide-react";
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

// Same box as ResourceItemCard above -- Ramy, 28 Aug 2026: "small sort of
// box with the title... a little icon maybe to indicate what kind of input
// it is... that hovering effect, the green teal" -- the timetable's input
// sessions were still on an old plain stacked-list layout instead of this
// shared card. MonitorPlay marks a session that links out to one of the 21
// real interactive Connect Native sessions; CalendarClock marks a real
// scheduled session with no interactive match yet -- never a guess either
// way, driven only by TIMETABLE_TITLE_TO_INPUT_SESSION_SLUG.
function InputSessionCard({
  session,
  canSeeTrainerOnly,
  traineeId,
}: {
  session: { id: string; title: string; event_date: string; event_time: string | null; criteria: string[]; registrySlug: string | null; materials: ResourceRow[] };
  canSeeTrainerOnly: boolean;
  traineeId: string;
}) {
  const Icon = session.registrySlug ? MonitorPlay : CalendarClock;
  const dateLabel = `${new Date(`${session.event_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${
    session.event_time ? ` · ${session.event_time.slice(0, 5)}` : ""
  }`;
  return (
    <li className="trainee-hover-fill flex flex-col gap-[5px] rounded-[6px] border border-border bg-[oklch(96.4%_0.014_85)] p-[11px_12px]">
      <div className="flex items-start gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {session.registrySlug ? (
            <Link
              href={`/input-sessions/${session.registrySlug}?back=${encodeURIComponent(`/portfolio/${traineeId}/resources`)}`}
              className="text-[13px] font-semibold text-ink hover:underline"
            >
              {session.title}
            </Link>
          ) : (
            <p className="text-[13px] font-semibold text-ink">{session.title}</p>
          )}
          <p className="mt-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">{dateLabel}</p>
        </div>
      </div>
      {canSeeTrainerOnly && session.criteria.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {session.criteria.map((code) => (
            <span key={code} className="badge-solid" title={CRITERIA_LABELS[code] ?? ""}>
              {code}
            </span>
          ))}
        </div>
      ) : null}
      {session.materials.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {session.materials.map((m) => (
            <li key={m.id}>
              <ResourceContentLink title={m.title} fileUrl={m.file_url} storagePath={m.storage_path} contentType={m.content_type} />
            </li>
          ))}
        </ul>
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

  const [{ data: coursebooks }, { data: audioTracks }, { data: videos }, { data: briefs }, { data: course }] =
    await Promise.all([
      coursebookIds.length > 0 ? supabase.from("tp_coursebooks").select("id, title, level, access_notes").in("id", coursebookIds).order("title") : Promise.resolve({ data: [] }),
      supabase.from("tp_audio_library").select("*").eq("center_id", trainee.center_id).order("coursebook_title"),
      supabase.from("tp_video_library").select("*").eq("center_id", trainee.center_id).order("created_at", { ascending: false }),
      supabase.from("assignment_templates").select("id, assignment_type, sections, published_at").eq("center_id", trainee.center_id).not("published_at", "is", null),
      trainee.course_id ? supabase.from("courses").select("start_date, tp_material_pool_enabled").eq("id", trainee.course_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

  // Filmed Observations -- Ramy, 28 Aug 2026: caught a real naming
  // collision from earlier tonight, exactly the trap migration
  // 0189_tp_video_library.sql's own comment warns about. This category was
  // wrongly wired to the generic resources.category='filmed_observations'
  // shelf (an empty, unrelated staff document bucket) instead of the real
  // feature: your own cohort's actual filmed lesson, tied 1:1 to a
  // timetable milestone event, with lesson context, a trainer-authored
  // task, and completion feeding the real observation-hours tracker. Same
  // query pattern today-tab.tsx's own filmedObservationReminder already
  // uses, just for every session on the course, not just today's.
  const { data: filmedSessionsRaw } = trainee.course_id
    ? await supabase
        .from("filmed_observation_sessions")
        .select("id, lesson_title, level, learner_count, teacher_name, timetable_event_id")
        .eq("course_id", trainee.course_id)
    : { data: [] };
  const filmedEventIds = (filmedSessionsRaw ?? []).map((s) => s.timetable_event_id);
  const { data: filmedEvents } =
    filmedEventIds.length > 0 ? await supabase.from("course_timetable_events").select("id, event_date, event_time").in("id", filmedEventIds) : { data: [] };
  const filmedEventById = new Map((filmedEvents ?? []).map((e) => [e.id, e]));
  const { data: myFilmedResponses } =
    viewer?.role === "trainee"
      ? await supabase.from("filmed_observation_task_responses").select("task_id, completed_at").eq("trainee_id", traineeId)
      : { data: [] };
  const { data: filmedTasks } =
    (filmedSessionsRaw ?? []).length > 0
      ? await supabase
          .from("filmed_observation_tasks")
          .select("id, session_id")
          .in(
            "session_id",
            (filmedSessionsRaw ?? []).map((s) => s.id)
          )
      : { data: [] };
  const taskIdBySessionId = new Map((filmedTasks ?? []).map((t) => [t.session_id, t.id]));
  const completedTaskIds = new Set((myFilmedResponses ?? []).filter((r) => r.completed_at).map((r) => r.task_id));
  const filmedSessions = (filmedSessionsRaw ?? [])
    .map((s) => {
      const event = filmedEventById.get(s.timetable_event_id);
      const taskId = taskIdBySessionId.get(s.id);
      return {
        id: s.id,
        lessonTitle: s.lesson_title,
        level: s.level,
        learnerCount: s.learner_count,
        teacherName: s.teacher_name,
        eventDate: event?.event_date ?? null,
        eventTime: event?.event_time ?? null,
        completed: taskId ? completedTaskIds.has(taskId) : false,
      };
    })
    .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));


  // Ramy, 28 Aug 2026: "leave all the input sessions, the real ones...
  // put them inside an input session card with my HTML input session and
  // move on." The real timetable's own sessions, every one of them for the
  // whole course (not just this week), never renamed -- linked to the real
  // interactive Connect Native page only where TIMETABLE_TITLE_TO_INPUT_
  // SESSION_SLUG confirms it's genuinely the same session, never guessed.
  let courseInputSessions: { id: string; title: string; event_date: string; event_time: string | null; criteria: string[]; registrySlug: string | null; materials: (typeof resources)[number][] }[] = [];
  if (trainee.course_id) {
    const { data: allInputEvents } = await supabase
      .from("course_timetable_events")
      .select("id, title, event_date, event_time, input_session_criteria")
      .eq("course_id", trainee.course_id)
      .eq("type", "input_session")
      .order("event_date")
      .order("event_time");
    const inputSessionResources = byCategory.get("input_sessions") ?? [];
    courseInputSessions = (allInputEvents ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      event_date: e.event_date,
      event_time: e.event_time,
      criteria: e.input_session_criteria ?? [],
      registrySlug: TIMETABLE_TITLE_TO_INPUT_SESSION_SLUG[e.title] ?? null,
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
    input_sessions: courseInputSessions.length,
    lesson_planning: byCategory.get("lesson_planning")?.length ?? 0,
    teaching_practice: byCategory.get("teaching_practice")?.length ?? 0,
    tp78_materials: materialItems.length,
    multimedia: (audioTracks?.length ?? 0) + (videos?.length ?? 0),
    coursebooks: coursebooks?.length ?? 0,
    written_assignments: (byCategory.get("written_assignments")?.length ?? 0) + (briefs?.length ?? 0),
    cambridge_documentation: (byCategory.get("cambridge_documentation")?.length ?? 0) + cambridgeDocs.filter((d) => d.url || d.storagePath).length,
    reading: byCategory.get("reading")?.length ?? 0,
    filmed_observations: filmedSessions.length,
    forms: formResources.length,
    centre_documents: byCategory.get("centre_documents")?.length ?? 0,
    admissions: byCategory.get("admissions")?.length ?? 0,
    tp_points: coursebooks?.length ?? 0,
  };
  const visibleCategories = HUB_CATEGORY_ORDER.filter((k) => canSeeTrainerOnly || !HUB_STAFF_ONLY.includes(k));
  // Ramy, 28 Aug 2026: "the resource hub sits on top of the pre-course task
  // and the film observations as well" -- Resource Hub (this whole page) >
  // Pre-course Task card + Filmed Observations card, standalone, then
  // Library (the searchable grid) below them for everything else.
  const libraryCategories = visibleCategories.filter((k) => k !== "filmed_observations");
  const totalItems = libraryCategories.reduce((sum, k) => sum + countByKey[k], 0);

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
      </div>

      {/* Ramy, 28 Aug 2026: "this will just sit on its own. It doesn't
          really need to be part of the Resource Hub -- there will be a tab
          for the trainers, and the trainee will get here from their hero
          card." The Pre-course Task door lived here because the task used
          to be a read-only shelf like everything else in the Hub. It is the
          one thing in Connect a candidate writes into now, which makes it a
          poor fit for a library of things you open and look at -- so it is
          reached from the Today hero card (before day one) and from the
          trainer's own tab, not from here. The scavenger hunt stays with it
          on that page rather than moving in here, which is also what the
          workspace email already promises: "both on the Pre-course task
          tab." */}

      {/* Resource Hub.dc.html screen 3a, exact card values -- "Filmed
          Observation... your own cohort's real filmed lesson." Real data
          from filmed_observation_sessions (the actual feature), not the
          generic resources.category='filmed_observations' shelf that was
          wired here by mistake earlier tonight -- see the query comment
          above for the full story. Standalone, next to Pre-course Task,
          not a Library tile: same "you DO this, you don't browse it"
          reasoning. */}
      {filmedSessions.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-[8px] border border-border p-[20px_22px]" style={{ background: "oklch(96.4% 0.014 85)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink">Filmed Observations</p>
            <span
              className="rounded-full px-2 py-[2px] text-[10px] font-bold tracking-[0.05em]"
              style={{ background: "color-mix(in oklab, oklch(60% 0.11 70) 14%, oklch(99.2% 0.005 90))", color: "oklch(60% 0.11 70)" }}
            >
              Task-linked
            </span>
          </div>
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 xl:grid-cols-3">
            {filmedSessions.map((s) => (
              <Link
                key={s.id}
                href={`/portfolio/${traineeId}/filmed-observation/${s.id}`}
                className="trainee-hover flex flex-col gap-2 overflow-hidden rounded-[6px] border border-border"
                style={{ background: "oklch(99.2% 0.005 90)" }}
              >
                <div className="flex items-center justify-center" style={{ aspectRatio: "16/7", background: "oklch(23.5% 0.017 65)" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="oklch(99.2% 0.005 90)" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" fill="oklch(99.2% 0.005 90)" />
                  </svg>
                </div>
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <p className="text-[13px] font-semibold text-ink">{s.lessonTitle ?? "Filmed lesson"}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                    {s.teacherName ? (
                      <span>
                        <span className="font-semibold text-ink">Teacher</span> {s.teacherName}
                      </span>
                    ) : null}
                    {s.level ? (
                      <span>
                        <span className="font-semibold text-ink">Level</span> {s.level}
                      </span>
                    ) : null}
                    {s.learnerCount ? (
                      <span>
                        <span className="font-semibold text-ink">Learners</span> {s.learnerCount}
                      </span>
                    ) : null}
                  </div>
                  {s.eventDate ? (
                    <p className="text-[11px] text-muted">
                      {s.eventDate}
                      {s.eventTime ? ` · ${s.eventTime.slice(0, 5)}` : ""}
                    </p>
                  ) : null}
                  <span
                    className="self-start rounded-full border px-[7px] py-[1px] text-[10px] font-semibold"
                    style={
                      s.completed
                        ? { borderColor: "oklch(88% 0.016 82)", color: "oklch(38% 0.072 195)" }
                        : { borderColor: "oklch(88% 0.016 82)", color: "oklch(51% 0.017 70)" }
                    }
                  >
                    {s.completed ? "Task completed" : "Task not yet done"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-lg font-semibold text-ink">Library</h3>
        <p className="text-xs text-muted">
          {totalItems} items · {libraryCategories.length} categories
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

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {libraryCategories.map((key) => (
          <HubCategorySection key={key} label={HUB_CATEGORY_LABELS[key]} count={`${countByKey[key]} items`} restricted={HUB_STAFF_ONLY.includes(key)}>
            {key === "input_sessions" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted">Full course timetable, in order</p>
                  <Link
                    href={`/input-sessions?back=${encodeURIComponent(`/portfolio/${traineeId}/resources`)}`}
                    className="shrink-0 text-xs font-semibold text-primary"
                  >
                    Connect Native session library →
                  </Link>
                </div>
                {courseInputSessions.length === 0 ? (
                  <p className="sheet border-dashed text-sm text-muted">No input sessions scheduled yet.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 xl:grid-cols-4">
                    {courseInputSessions.map((s) => (
                      <InputSessionCard key={s.id} session={s} canSeeTrainerOnly={canSeeTrainerOnly} traineeId={traineeId} />
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

      {isEditableStaff ? <ResourceComposer traineeId={traineeId} centerId={trainee.center_id} /> : null}
    </div>
  );
}

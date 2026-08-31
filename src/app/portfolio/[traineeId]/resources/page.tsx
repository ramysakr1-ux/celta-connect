import { notFound } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { TIMETABLE_TITLE_TO_INPUT_SESSION_SLUG } from "@/lib/input-session-registry-links";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_TYPE_ICON, RESOURCE_TYPE_LABELS, TRAINER_ONLY_CATEGORIES } from "@/lib/resource-info";
import { MonitorPlay, CalendarClock, Stamp } from "lucide-react";
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
  // Ramy, 29 Aug 2026: "the input session cards, when I click on them they
  // don't open, and I'm not sure why." Two causes, both fixed here.
  //
  // First, the whole card carried the hover fill -- so it promised it was
  // clickable -- while only the title text was ever a link. Clicking the
  // icon, the date or any whitespace did nothing. The whole card is the
  // link now.
  //
  // Second, only 8 of the 22 timetable sessions have a confirmed
  // interactive counterpart, so the other 14 genuinely have nowhere to go.
  // Those now look inert rather than pretending: a calendar icon instead of
  // a screen, no hover lift, and "On your timetable" where the others say
  // "Open session". Making all 22 look alike is what caused the complaint.
  const openable = Boolean(session.registrySlug);
  const Icon = openable ? MonitorPlay : CalendarClock;
  const dateLabel = `${new Date(`${session.event_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${
    session.event_time ? ` · ${session.event_time.slice(0, 5)}` : ""
  }`;

  const body = (
    <>
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-[7px]"
          style={{ background: "oklch(93.5% 0.016 85)" }}
        >
          <Icon className="size-[15px]" style={{ color: openable ? "oklch(38% 0.072 195)" : "oklch(51% 0.017 70)" }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-[1.3] font-semibold text-ink">{session.title}</p>
          <p className="mt-0.5 text-[10.5px] font-bold tracking-[0.06em] text-muted uppercase">{dateLabel}</p>
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
      <div className="mt-auto pt-1">
        {openable ? (
          <span className="text-[11px] font-bold" style={{ color: "oklch(38% 0.072 195)" }}>
            Open session →
          </span>
        ) : (
          <span className="text-[11px] text-muted">On your timetable</span>
        )}
      </div>
    </>
  );

  const shell = "flex min-h-[118px] flex-col gap-2 rounded-[8px] border border-border p-[14px]";
  const bg = { background: "oklch(96.4% 0.014 85)" };

  return openable ? (
    <li>
      <Link
        href={`/input-sessions/${session.registrySlug}?back=${encodeURIComponent(`/portfolio/${traineeId}/resources`)}`}
        className={`trainee-hover-fill ${shell}`}
        style={bg}
      >
        {body}
      </Link>
    </li>
  ) : (
    <li className={shell} style={bg}>
      {body}
    </li>
  );
}

// What an empty category should say. "Nothing here yet" eight times over
// reads as a broken page rather than an empty shelf, and for the two
// sample shelves it also hides what they are FOR -- which is the whole
// reason nobody could say what belonged in them.
const EMPTY_NOTE: Partial<Record<HubCategoryKey, string>> = {
  lesson_planning: "Worked examples to look at before you write your own — a completed lesson plan, a language analysis sheet, board plans from previous cohorts. Your tutor adds these.",
  // Ramy, 29 Aug 2026: "there's no good feedback, bad feedback -- tutor
  // feedback is different, that shouldn't be part of the samples." He is
  // right and my first draft was wrong. A self-evaluation is the
  // candidate's own work, so showing one helps them write theirs. Tutor
  // feedback is a tutor's judgement on one specific lesson; posting a
  // "good example" implies a form it ought to take and sets an expectation
  // about what their own feedback should look like. That is a template for
  // something that should not be templated.
  teaching_practice: "Samples from previous cohorts — for example a self-evaluation, so you can see what one looks like before you write your first. Your tutor adds these.",
  reading: "The course's recommended reading, added by your centre.",
  multimedia: "Audio and video your tutors add for teaching practice.",
  written_assignments: "The four assignment briefs — what each assignment asks for, read before you write it. Your own submitted work is on the Written Assignments tab.",
  forms: "Centre forms and documents, added by your centre.",
  cambridge_documentation: "Cambridge's own course documents.",
  // Ramy, 29 Aug 2026: "an archive for clients -- the library where you
  // have all the originals. We're just not using it, but since this is
  // meant to be for other centres, maybe they would choose different
  // documentation, so it's good to have it there for reference. An
  // assessor wants to look at them to see what it actually looks like
  // without looking at the built-in structure. No one is gonna touch it."
  //
  // Deliberately NOT a trainee shelf and not a working one: the live
  // versions of all this paperwork already exist as answerable screens
  // (observation tasks on Progress, filmed observation tasks, assignment
  // briefs, the structured lesson plan). This is the blank originals those
  // were built from, kept so an assessor can see the documents themselves
  // and another centre can decide whether to adopt them.
  //
  // Lands in Centre Documents rather than a new category because
  // resources.category is a database enum -- a new value needs a migration
  // -- and this shelf is already staff-and-assessor visible, which is
  // exactly the audience.
  centre_documents:
    "The centre's own paperwork, plus the archive of original blank forms — lesson plan, language analysis sheet, observation tasks, assignment briefs — kept for reference rather than for use. The live versions are elsewhere in Connect.",
};

function PlainCategoryGrid({
  resources,
  isEditableStaff,
  traineeId,
  emptyNote,
}: {
  resources: ResourceRow[];
  isEditableStaff: boolean;
  traineeId: string;
  emptyNote?: string;
}) {
  if (resources.length === 0)
    return <p className="sheet border-dashed text-sm text-muted">{emptyNote ?? "Nothing here yet."}</p>;
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
  // The slots fall back to the Resource Hub, and most of the Cambridge set
  // is staff-only -- so this page passes who is actually looking. Anyone
  // seeing the trainee's own view (including a tutor previewing as one, via
  // canSeeTrainerOnly) gets only trainee-visible uploads, so the fallback
  // cannot become a way round the flag the centre set on each file.
  const cambridgeDocsRaw = await getCambridgeDocuments(
    cambridgeAdmin,
    trainee.center_id,
    cambridgeCentre?.organisation_id ?? null,
    canSeeTrainerOnly ? "staff" : "trainee"
  );
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
  // Driven by the TIMETABLE slots, not by the sessions -- a session row
  // only exists once a trainer has opened the setup form and saved, so
  // keying off sessions meant a candidate saw nothing at all until then,
  // not even that five were scheduled. The design's "Scheduled on your
  // timetable / No recording yet" row is exactly this case. Matched by
  // title the same way the trainer's own drag-board does; filmed
  // observations are milestone events, not a distinct event type.
  const { data: filmedEvents } = trainee.course_id
    ? await supabase
        .from("course_timetable_events")
        .select("id, title, event_date, event_time")
        .eq("course_id", trainee.course_id)
        .eq("type", "milestone")
        .ilike("title", "Filmed observation%")
        .order("event_date")
    : { data: [] };
  const filmedEventById = new Map((filmedEvents ?? []).map((e) => [e.id, e]));
  const { data: filmedSessionsRaw } = trainee.course_id
    ? await supabase
        .from("filmed_observation_sessions")
        .select("id, lesson_title, level, learner_count, teacher_name, main_aim, sub_aim, recording_url, length_minutes, timetable_event_id")
        .eq("course_id", trainee.course_id)
    : { data: [] };
  const sessionByEventId = new Map((filmedSessionsRaw ?? []).map((s) => [s.timetable_event_id, s]));
  const { data: myFilmedResponses } =
    viewer?.role === "trainee"
      ? await supabase
          .from("filmed_observation_task_responses")
          .select("task_id, completed_at, response_1, response_2, response_general")
          .eq("trainee_id", traineeId)
      : { data: [] };
  // "Watched" is a real recorded view (migration 0240), never inferred from
  // whether they wrote anything -- a candidate can watch the whole lesson
  // and type nothing, which would otherwise read as never having opened it.
  const { data: myFilmedViews } =
    viewer?.role === "trainee"
      ? await supabase.from("filmed_observation_views").select("session_id").eq("trainee_id", traineeId)
      : { data: [] };
  const viewedSessionIds = new Set((myFilmedViews ?? []).map((v) => v.session_id));
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
  // A started-but-unfinished response is its own state: the design says
  // "your written response saved" separately from "task done".
  const startedTaskIds = new Set(
    (myFilmedResponses ?? [])
      .filter((r) => [r.response_1, r.response_2, r.response_general].some((v) => v?.trim()))
      .map((r) => r.task_id)
  );
  const filmedSessions = (filmedEvents ?? [])
    .map((event) => {
      const fs = sessionByEventId.get(event.id) ?? null;
      const taskId = fs ? taskIdBySessionId.get(fs.id) : undefined;
      return {
        id: fs?.id ?? null,
        lessonTitle: fs?.lesson_title ?? null,
        level: fs?.level ?? null,
        learnerCount: fs?.learner_count ?? null,
        teacherName: fs?.teacher_name ?? null,
        mainAim: fs?.main_aim ?? null,
        subAim: fs?.sub_aim ?? null,
        hasRecording: Boolean(fs?.recording_url?.trim()),
        lengthMinutes: fs?.length_minutes ?? null,
        eventTitle: event.title,
        viewed: fs ? viewedSessionIds.has(fs.id) : false,
        started: taskId ? startedTaskIds.has(taskId) : false,
        hasTask: Boolean(taskId),
        eventDate: event.event_date,
        eventTime: event.event_time,
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
  // Ramy, 29 Aug 2026, asked whether input sessions belong outside the
  // Library, and they do. Everything else in the Library is reference
  // material you look UP when you need it; input sessions are the course
  // itself, in timetable order, that you work THROUGH -- the same character
  // as filmed observations. They are also 22 of the ~30 items, so leaving
  // them in made the Library look like it was mostly input sessions with a
  // few oddments attached.
  const libraryCategories = visibleCategories.filter((k) => k !== "filmed_observations" && k !== "input_sessions");
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
    <div className="flex flex-col gap-[22px]">
      {/* Ramy, 29 Aug 2026: "once you click, you're jumping inside a
          different room -- the entire page is a resource hub, nothing else
          there." The rail is dropped for this route in focus-row.tsx; this
          masthead is what tells you you have arrived somewhere, rather than
          a heading that reads like one more section of the portfolio. */}
      <div
        className="flex flex-wrap items-center justify-between gap-5 rounded-[12px] p-[22px_26px]"
        style={{ background: "oklch(30% 0.042 58)" }}
      >
        <div className="min-w-0">
          {/* Ramy, 29 Aug 2026: "can we put that arrow back inside some kind
              of colourful pill? It's just hard to see." It was plain text at
              80% opacity on a dark masthead -- the one control on the page
              that gets you out of the room, and the lowest-contrast thing on
              it. Now a filled pill, which also makes it read as a button
              rather than a caption. */}
          {/* The pill comes from PortfolioFocusRow now -- every room gets one,
              rather than only the page that happened to have been given one. */}
          <h1 className="mt-1.5 font-serif text-[30px] font-semibold" style={{ color: "oklch(99.2% 0.005 90)" }}>
            Resource Hub
          </h1>
          <p className="mt-1 max-w-[52ch] text-[13px]" style={{ color: "oklch(99.2% 0.005 90 / 0.72)" }}>
            Everything the course gives you, in one place — your filmed observations, and the library of sessions, books
            and forms behind them.
          </p>
        </div>
        <div
          className="flex h-10 min-w-[260px] flex-1 items-center gap-3 rounded-[8px] px-[14px] sm:max-w-[360px]"
          style={{ background: "oklch(99.2% 0.005 90 / 0.12)", border: "1px solid oklch(99.2% 0.005 90 / 0.22)" }}
        >
          <div className="flex-1">
            <ResourceHubSearch items={searchItems} />
          </div>
        </div>
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
        <div className="flex flex-col gap-3.5 rounded-[8px] border border-border p-[20px_22px]" style={{ background: "oklch(96.4% 0.014 85)" }}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-[17px] font-semibold text-ink">Filmed Observations</p>
            <span
              className="shrink-0 rounded-full px-2 py-[2px] text-[10px] font-bold tracking-[0.05em]"
              style={{ background: "color-mix(in oklab, oklch(60% 0.11 70) 14%, oklch(99.2% 0.005 90))", color: "oklch(60% 0.11 70)" }}
            >
              Task-linked
            </span>
          </div>
          {/* Ramy, 29 Aug 2026: dropped "your cohort's filmed lessons...
              with consent on record", both inherited from the §3a design.
              The design assumed the film IS the cohort's own filmed class;
              the real content is published demo lessons on YouTube, one of
              them from a third-party channel. Filming consent in Connect
              covers a trainee consenting to their OWN TP class being
              filmed and has nothing to do with these, so the chip asserted
              something untrue on every card. Reworded to what is true of
              both cases -- if a centre later films its own cohort and
              consent genuinely is on record, bring the chip back driven by
              real data rather than hardcoded. */}
          <p className="text-[12.5px] leading-[1.5] text-muted">
            Filmed lessons for you to observe — each tied to a slot on your timetable, with a task to complete after
            watching.
          </p>

          {/* Progress across all of them, the same shape as the pre-course
              task: a candidate's real question is how many they still owe,
              which the per-card states alone never answered. */}
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "oklch(93% 0.024 80)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(filmedSessions.filter((s) => s.completed).length / filmedSessions.length) * 100}%`,
                  background: "oklch(38% 0.072 195)",
                }}
              />
            </div>
            <span className="shrink-0 text-[11.5px] tabular-nums text-muted">
              {filmedSessions.filter((s) => s.completed).length} of {filmedSessions.length} tasks done
            </span>
          </div>

          {/* One list, not "featured plus the others" -- which one deserves
              the detail is whichever still needs the candidate, and that is
              rarely the first. The active one expands in place behind a
              gold rail; everything else stays a compact row. Also survives
              a centre running four or six sessions rather than five. */}
          <ul className="flex flex-col gap-2">
            {filmedSessions.map((s) => {
              const status = !s.hasRecording
                ? { label: "No recording yet", sub: "Your tutor attaches the recording before the session", tone: "idle" as const }
                : s.completed
                  ? { label: "Done", sub: "Watched · your written response saved", tone: "done" as const }
                  : s.started
                    ? { label: "Task waiting", sub: "Recording attached · your response is saved but not finished", tone: "open" as const }
                    : s.viewed
                      ? { label: "Task waiting", sub: "Watched · you haven't answered the task yet", tone: "open" as const }
                      : { label: "Not watched", sub: "Recording attached · not opened yet", tone: "idle" as const };
              const isActive = status.tone === "open";
              const dateLabel = s.eventDate
                ? new Date(`${s.eventDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                : null;
              const row = (
                <>
                  <span className="flex items-center gap-2.5 p-[11px_13px]">
                    <span
                      className="flex size-[26px] shrink-0 items-center justify-center rounded-[6px]"
                      style={{ background: "oklch(93.5% 0.016 85)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
                        stroke={s.hasRecording ? "oklch(38% 0.072 195)" : "oklch(51% 0.017 70)"}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M10 8l6 4-6 4z" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">
                        {s.eventTitle ?? "Filmed observation"}
                        {dateLabel ? ` · ${dateLabel}` : ""}
                      </span>
                      <p className="mt-[1px] text-[12.5px] font-semibold text-ink">
                        {s.lessonTitle ?? (s.hasRecording ? "Filmed lesson — focus set by your tutor" : "Scheduled on your timetable")}
                      </p>
                      <p className="mt-[1px] text-[11px] text-muted">{status.sub}</p>
                    </span>
                    <span
                      className="shrink-0 rounded-full border px-2 py-[2px] text-[10px] font-semibold whitespace-nowrap"
                      style={
                        status.tone === "done"
                          ? { background: "oklch(38% 0.072 195)", color: "oklch(99.2% 0.005 90)", borderColor: "oklch(38% 0.072 195)" }
                          : status.tone === "open"
                            ? {
                                background: "color-mix(in oklab, oklch(60% 0.11 70) 12%, oklch(99.2% 0.005 90))",
                                color: "oklch(60% 0.11 70)",
                                borderColor: "color-mix(in oklab, oklch(60% 0.11 70) 34%, transparent)",
                              }
                            : { borderColor: "oklch(88% 0.016 82)", color: "oklch(51% 0.017 70)" }
                      }
                    >
                      {status.label}
                    </span>
                  </span>
                  {isActive ? (
                    <span className="flex flex-col gap-2 border-t p-[12px_13px]" style={{ borderColor: "color-mix(in srgb, oklch(88% 0.016 82) 60%, transparent)" }}>
                      <span className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted">
                        {s.teacherName ? (<span><span className="font-semibold text-ink">Teacher</span> {s.teacherName}</span>) : null}
                        {s.level ? (<span><span className="font-semibold text-ink">Level</span> {s.level}</span>) : null}
                        {s.learnerCount ? (<span><span className="font-semibold text-ink">Learners</span> {s.learnerCount}</span>) : null}
                        {s.lengthMinutes ? (<span><span className="font-semibold text-ink">Length</span> {s.lengthMinutes} min</span>) : null}
                      </span>
                      {s.mainAim || s.subAim ? (
                        <span className="text-[11px] leading-[1.5] text-muted">
                          {s.mainAim ? (<><span className="font-semibold text-ink">Main aim</span> — {s.mainAim}<br /></>) : null}
                          {s.subAim ? (<><span className="font-semibold text-ink">Sub aim</span> — {s.subAim}</>) : null}
                        </span>
                      ) : null}
                      {s.hasTask ? (
                        <span className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-border px-[7px] py-[1px] text-[10px] font-semibold text-muted">
                            Observation task attached
                          </span>
                        </span>
                      ) : null}
                      <span
                        className="self-start rounded-[6px] px-[14px] py-2 text-[12px] font-bold"
                        style={{ background: "oklch(30% 0.042 58)", color: "oklch(99.2% 0.005 90)" }}
                      >
                        Watch and answer the task →
                      </span>
                    </span>
                  ) : null}
                </>
              );
              const style = {
                background: "oklch(99.2% 0.005 90)",
                ...(isActive
                  ? { borderColor: "color-mix(in oklab, oklch(60% 0.11 70) 40%, transparent)", borderLeftWidth: "3px", borderLeftColor: "oklch(60% 0.11 70)" }
                  : {}),
              };
              // A session with no recording is not a link -- there is
              // nothing behind it yet, and a dead click reads as broken.
              return s.hasRecording && s.id ? (
                <li key={s.id}>
                  <Link
                    href={`/portfolio/${traineeId}/filmed-observation/${s.id}`}
                    className="trainee-hover flex flex-col overflow-hidden rounded-[6px] border border-border"
                    style={style}
                  >
                    {row}
                  </Link>
                </li>
              ) : (
                <li key={s.id ?? s.eventTitle} className="flex flex-col overflow-hidden rounded-[6px] border border-dashed border-border">
                  {row}
                </li>
              );
            })}
          </ul>

          <div
            className="rounded-[6px] border p-[11px_13px]"
            style={{
              background: "color-mix(in oklab, oklch(60% 0.11 70) 8%, oklch(99.2% 0.005 90))",
              borderColor: "color-mix(in oklab, oklch(60% 0.11 70) 30%, transparent)",
            }}
          >
            <p className="text-[11px] font-bold" style={{ color: "oklch(60% 0.11 70)" }}>Note to trainees</p>
            <p className="mt-[3px] text-[11.5px] leading-[1.5] text-muted">
              These recordings can run past 45 minutes. Use the player&apos;s own seek bar to skip ahead — you&apos;re not
              expected to watch every second, just enough to answer the task.
            </p>
          </div>
        </div>
      ) : null}

      {visibleCategories.includes("input_sessions") ? (
        <div className="rounded-[10px] border border-border p-[22px]" style={{ background: "oklch(96.4% 0.014 85)" }}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[21px] font-semibold text-ink">Input Sessions</h2>
            <Link
              href={`/input-sessions?back=${encodeURIComponent(`/portfolio/${traineeId}/resources`)}`}
              className="shrink-0 text-xs font-semibold text-primary"
            >
              Connect Native session library →
            </Link>
          </div>
          <p className="mb-4 text-[12.5px] text-muted">
            Every input session on your course, in timetable order. The ones with an interactive version open here;
            the rest are on your timetable to attend.
          </p>
          {courseInputSessions.length === 0 ? (
            <p className="sheet border-dashed text-sm text-muted">No input sessions scheduled yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {courseInputSessions.map((s) => (
                <InputSessionCard key={s.id} session={s} canSeeTrainerOnly={canSeeTrainerOnly} traineeId={traineeId} />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="rounded-[10px] border border-border p-[22px]" style={{ background: "oklch(96.4% 0.014 85)" }}>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[21px] font-semibold text-ink">Library</h2>
          <p className="shrink-0 text-xs tabular-nums text-muted">
            {totalItems} items · {libraryCategories.length} categories
          </p>
        </div>
        <p className="mb-4 text-[12.5px] text-muted">
          Everything you can read, watch or download. Nothing here is collapsed — scroll to what you need, or search
          from the top of the page.
        </p>

        <div className="flex flex-col gap-3.5">
        {libraryCategories.map((key) => (
          <HubCategorySection key={key} label={HUB_CATEGORY_LABELS[key]} count={`${countByKey[key]} items`} restricted={HUB_STAFF_ONLY.includes(key)}>
            {key === "coursebooks" ? (
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
                    group is an honest empty state, not invented content.

                    The copy used to read "flagged for Ramy, not fabricated"
                    -- a note to the developer, rendered on a candidate's own
                    Resource Hub. Found 31 Aug 2026 in the pre-demo sweep. The
                    reasoning belongs in this comment; the candidate needs to
                    know the shelf is empty and what to do about it. */}
                <div>
                  <h4 className="text-sm font-medium text-ink">Video</h4>
                  <p className="sheet mt-2 border-dashed text-sm text-muted">
                    No video linked to this coursebook yet. Your tutor can add one, and the general video
                    shelf below is available in the meantime.
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
              // Admin Handbook §6.3 requires every centre to give candidates
              // a candidate agreement, and §6.2 an internal complaints
              // procedure (which it permits inside the agreement). Both live
              // at /candidate-agreement, so this category always has the one
              // document Cambridge actually names -- it is not left to
              // whether someone remembered to upload a PDF.
              <div className="flex flex-col gap-3">
                <ul className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 xl:grid-cols-4">
                  <li className="trainee-hover-fill flex flex-col gap-[5px] rounded-[6px] border border-border bg-[oklch(96.4%_0.014_85)] p-[11px_12px]">
                    <div className="flex items-start gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
                        <Stamp className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href="/candidate-agreement" className="text-[13px] font-semibold text-ink hover:underline">
                          Candidate Agreement
                        </Link>
                        <p className="mt-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">
                          Required by Cambridge
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] leading-[1.4] text-muted">
                      What the centre expects of you and what you can expect back — attendance, plagiarism, deferrals,
                      and how to raise a complaint.
                    </p>
                  </li>
                </ul>
                <PlainCategoryGrid resources={formResources} isEditableStaff={isEditableStaff} traineeId={traineeId} />
              </div>
            ) : (
              <PlainCategoryGrid resources={byCategory.get(key) ?? []} isEditableStaff={isEditableStaff} traineeId={traineeId} emptyNote={EMPTY_NOTE[key]} />
            )}
          </HubCategorySection>
        ))}
        </div>
      </div>

      {isEditableStaff ? <ResourceComposer traineeId={traineeId} centerId={trainee.center_id} /> : null}
    </div>
  );
}

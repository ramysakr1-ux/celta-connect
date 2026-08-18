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
import { ResourceComposer } from "@/app/portfolio/[traineeId]/resources/resource-composer";
import { deleteResource } from "@/app/portfolio/[traineeId]/resources/actions";
import { ResourceContentLink } from "@/components/resource-content-link";
import { CoursebooksSection } from "@/app/portfolio/[traineeId]/resources/coursebooks-section";
import { MultimediaSection } from "@/app/portfolio/[traineeId]/resources/multimedia-section";
import { AssignmentBriefsSection } from "@/app/portfolio/[traineeId]/resources/assignment-briefs-section";
import { SectionsRail } from "@/app/trainer/(hub)/resource-hub/sections-rail";

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

  const [{ data: coursebooks }, { data: audioTracks }, { data: briefs }, { data: course }] = await Promise.all([
    coursebookIds.length > 0
      ? supabase.from("tp_coursebooks").select("id, title, level, access_notes").in("id", coursebookIds).order("title")
      : Promise.resolve({ data: [] }),
    supabase.from("tp_audio_library").select("*").eq("center_id", trainee.center_id).order("coursebook_title"),
    supabase
      .from("assignment_templates")
      .select("id, assignment_type, sections, published_at")
      .eq("center_id", trainee.center_id)
      .not("published_at", "is", null),
    trainee.course_id ? supabase.from("courses").select("start_date").eq("id", trainee.course_id).maybeSingle() : Promise.resolve({ data: null }),
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

  if (showTraineeLayout) {
    const railSections = [
      { href: "#input-sessions", label: "Input sessions", count: byCategory.get("input_sessions")?.length ?? 0 },
      { href: "#coursebooks", label: "Coursebooks", count: coursebooks?.length ?? 0 },
      { href: "#multimedia", label: "Multimedia", count: audioTracks?.length ?? 0 },
      { href: "#assignment-briefs", label: "Assignment briefs", count: briefs?.length ?? 0 },
      { href: "#forms-and-documents", label: "Forms and documents", count: formResources.length },
    ];

    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-xl text-ink">Everything the centre has given you</h2>
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

            <div id="multimedia" className="scroll-mt-4">
              <MultimediaSection tracks={audioTracks ?? []} />
            </div>

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
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">Resource Hub</h2>
        <p className="text-xs text-muted">{resources.length} items</p>
      </div>

      {isEditableStaff ? <ResourceComposer traineeId={traineeId} centerId={trainee.center_id} /> : null}

      <CoursebooksSection coursebooks={coursebooks ?? []} isEditableStaff={isEditableStaff} />
      <MultimediaSection tracks={audioTracks ?? []} />
      <AssignmentBriefsSection briefs={briefs ?? []} />

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
          <div key={category}>
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

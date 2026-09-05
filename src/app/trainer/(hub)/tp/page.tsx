import Link from "next/link";
import { hubReadClient } from "@/lib/supabase/hub-read";
import { AlsoUnder } from "@/app/trainer/(hub)/also-under";
import { requireRole } from "@/lib/auth/require-role";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { isMctView } from "@/lib/act-preview";
import { buildTpQueue, type QueueGroup } from "@/lib/tp-queue";
import { OwedCard, TodayCard } from "@/app/trainer/(hub)/tp/tp-cards";
import { computeWeekOf } from "@/lib/course-progress";
import type { AimType } from "@/lib/aim-type";

// Teaching Practice, v2 (design_handoff_teaching_practice_v2, Ramy 6 Sep
// 2026). One question: which lessons do I owe written feedback on. Each
// owed lesson is a card showing what is already on the tutor's desk to
// write from -- their own live capture notes, the candidate's
// self-evaluation, their own draft -- and one button into the editor.
// Today's session and tomorrow's slots sit underneath as context. Nothing
// on this page is edited in place.
export default async function TeachingPracticeQueuePage({ searchParams }: { searchParams: Promise<{ others?: string }> }) {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = trainer.course_id;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }
  const { others } = await searchParams;
  const supabase = hubReadClient(trainer, courseId);

  const center = await getCachedCenter(trainer.center_id);
  const timeZone = center?.time_zone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  const today = toLocalIso(now, timeZone);

  const [isMct, { data: subgroupRows }, { data: tpGroupRows }, { data: roster }, { data: events }, { data: centerSettings }, { data: course }] = await Promise.all([
    isMctView(trainer, courseId),
    supabase.from("course_subgroups").select("id, name, tp_group_id, half_order").eq("course_id", courseId).order("created_at"),
    supabase.from("course_tp_groups").select("id, name, tutor_profile_id").eq("course_id", courseId),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee"),
    supabase.from("course_timetable_events").select("id, event_date, event_time, detail, type, title").eq("course_id", courseId).order("event_date").order("event_time"),
    supabase.from("centers").select("feedback_same_day_hours").eq("id", trainer.center_id).maybeSingle(),
    supabase.from("courses").select("start_date, end_date").eq("id", courseId).maybeSingle(),
  ]);

  const rosterIds = (roster ?? []).map((r) => r.id);
  const subgroupIds = (subgroupRows ?? []).map((g) => g.id);
  const [{ data: memberRows }, { data: plans }, { data: feedback }, { data: notes }, { data: selfEvals }, { data: tutorProfiles }, { data: peerSheets }] = await Promise.all([
    subgroupIds.length > 0
      ? supabase.from("course_subgroup_members").select("subgroup_id, trainee_id, base_slot").in("subgroup_id", subgroupIds)
      : Promise.resolve({ data: [] as { subgroup_id: string; trainee_id: string; base_slot: number }[] }),
    supabase.from("plan_assignments").select("trainee_id, tp_number, taught_at, main_lesson_aim, short_title, aim_type, tp_point_id").eq("course_id", courseId),
    rosterIds.length > 0
      ? supabase
          .from("tp_feedback")
          .select("trainee_id, tp_number, submitted_at, grade, strengths_planning, action_points_planning, strengths_teaching, action_points_teaching")
          .in("trainee_id", rosterIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("tp_capture_notes").select("trainee_id, tp_number, criteria_codes, trainer_id").eq("course_id", courseId),
    rosterIds.length > 0
      ? supabase.from("tp_self_evaluations").select("trainee_id, tp_number, submitted_at").in("trainee_id", rosterIds)
      : Promise.resolve({ data: [] as { trainee_id: string; tp_number: number; submitted_at: string | null }[] }),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainer"),
    supabase.from("peer_observation_sheets").select("tp_number, criteria_codes").eq("course_id", courseId),
  ]);

  // The lesson's level comes from the point's coursebook (tp_coursebooks
  // .level is a bare CEFR code), not from anything on the plan itself.
  const pointIds = [...new Set((plans ?? []).map((p) => p.tp_point_id).filter((id): id is string => Boolean(id)))];
  const { data: points } = pointIds.length > 0 ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", pointIds) : { data: [] as { id: string; tp_coursebook_id: string }[] };
  const bookIds = [...new Set((points ?? []).map((p) => p.tp_coursebook_id))];
  const { data: books } = bookIds.length > 0 ? await supabase.from("tp_coursebooks").select("id, level").in("id", bookIds) : { data: [] as { id: string; level: string }[] };
  const levelByBook = new Map((books ?? []).map((b) => [b.id, b.level]));
  const levelByPoint = new Map((points ?? []).map((p) => [p.id, levelByBook.get(p.tp_coursebook_id) ?? null]));

  const nameById = new Map((roster ?? []).map((r) => [r.id, r.full_name]));
  const tutorNameById = new Map((tutorProfiles ?? []).map((t) => [t.id, t.full_name]));
  const tpGroupById = new Map((tpGroupRows ?? []).map((g) => [g.id, g]));
  const membersBySubgroup = new Map<string, { traineeId: string; fullName: string; baseSlot: number }[]>();
  for (const m of memberRows ?? []) {
    membersBySubgroup.set(m.subgroup_id, [
      ...(membersBySubgroup.get(m.subgroup_id) ?? []),
      { traineeId: m.trainee_id, fullName: nameById.get(m.trainee_id) ?? "Unknown", baseSlot: m.base_slot },
    ]);
  }

  const groups: QueueGroup[] = (subgroupRows ?? []).map((sg) => {
    const tpGroup = sg.tp_group_id ? tpGroupById.get(sg.tp_group_id) : null;
    return {
      subgroupId: sg.id,
      tpGroupId: sg.tp_group_id,
      groupName: tpGroup?.name ?? sg.name,
      halfOrder: sg.half_order === 1 || sg.half_order === 2 ? sg.half_order : null,
      tutorProfileId: tpGroup?.tutor_profile_id ?? null,
      tutorName: tpGroup?.tutor_profile_id ? (tutorNameById.get(tpGroup.tutor_profile_id) ?? null) : null,
      members: membersBySubgroup.get(sg.id) ?? [],
    };
  });

  const countPoints = (f: { strengths_planning: unknown[]; action_points_planning: unknown[]; strengths_teaching: unknown[]; action_points_teaching: unknown[] }) =>
    f.strengths_planning.length + f.action_points_planning.length + f.strengths_teaching.length + f.action_points_teaching.length;
  const countCriteria = (f: { strengths_planning: { criteria_codes?: string[] }[]; action_points_planning: { criteria_codes?: string[] }[]; strengths_teaching: { criteria_codes?: string[] }[]; action_points_teaching: { criteria_codes?: string[] }[] }) =>
    new Set([...f.strengths_planning, ...f.action_points_planning, ...f.strengths_teaching, ...f.action_points_teaching].flatMap((p) => p.criteria_codes ?? [])).size;

  const queue = buildTpQueue({
    groups,
    plans: (plans ?? []).map((p) => ({
      trainee_id: p.trainee_id,
      tp_number: p.tp_number,
      taught_at: p.taught_at,
      main_lesson_aim: p.main_lesson_aim,
      short_title: p.short_title,
      aim_type: p.aim_type as AimType | null,
      level: p.tp_point_id ? (levelByPoint.get(p.tp_point_id) ?? null) : null,
    })),
    feedback: (feedback ?? []).map((f) => ({
      trainee_id: f.trainee_id,
      tp_number: f.tp_number,
      submitted_at: f.submitted_at,
      grade: f.grade,
      pointCount: countPoints(f),
      criteriaCount: countCriteria(f),
    })),
    // A lesson's notes are its own tutor's -- the queue picks the author
    // per lesson, so an MCT reading another tutor's card sees that tutor's
    // notes rather than a misleading "none".
    notes: (notes ?? []).map((n) => ({ trainee_id: n.trainee_id, tp_number: n.tp_number, criteria_codes: n.criteria_codes, trainer_id: n.trainer_id })),
    selfEvals: selfEvals ?? [],
    events: events ?? [],
    viewerId: trainer.id,
    seesAllGroups: isMct,
    today,
    now,
    sameDayHours: centerSettings?.feedback_same_day_hours ?? 24,
    peerTaskCriteria: (peerSheets ?? []).find((p) => p.tp_number === (queuePeerTp(events ?? [], today) ?? -1))?.criteria_codes ?? [],
  });

  // The spec hides other tutors' owed lessons behind Show, which assumes
  // the viewer has some of their own. When an MCT owns none -- every group
  // staffed by someone else, which is the normal shape on a big course --
  // an empty page above a tiny "Show" link is the wrong answer, so they
  // open expanded. The toggle still works either way.
  const showOthers = others === "1" || (queue.owed.length === 0 && queue.othersOwed.length > 0 && others !== "0");
  const shown = showOthers ? [...queue.owed, ...queue.othersOwed].sort((a, b) => b.ageHours - a.ageHours) : queue.owed;
  const lateCount = shown.filter((l) => l.isLate).length;
  const weekLabel = course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;
  const otherTutor = queue.othersOwed[0]?.tutorName ?? null;
  const otherGroup = queue.othersOwed[0]?.groupName ?? null;

  const debtLine =
    shown.length === 0
      ? "Nothing owed."
      : `You owe written feedback on ${shown.length} lesson${shown.length === 1 ? "" : "s"}${lateCount > 0 ? `, ${lateCount} past the same-day rule` : ""}.`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-[760px] flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-[22px] leading-tight font-semibold text-ink-warm">Teaching practice</h1>
            <span
              className="rounded-full px-2.5 py-[3px] text-[10.5px] font-bold tracking-[0.08em] text-primary-foreground uppercase"
              style={{ background: "var(--hub-accent)" }}
            >
              {isMct ? "MCT · both groups" : "ACT · your group"}
            </span>
          </div>
          {/* The debt line is the page in one sentence -- red when anything
              has slipped past the centre's own same-day rule. */}
          <p
            className="border-l-4 pl-3 font-serif text-[28px] leading-[1.15] font-medium text-ink-warm"
            style={{ borderColor: lateCount > 0 ? "oklch(45% 0.16 27)" : "var(--hub-accent)" }}
          >
            {debtLine}
          </p>
          <p className="text-[13px] text-muted">
            {weekLabel ? `${weekLabel.charAt(0).toUpperCase()}${weekLabel.slice(1)} · ` : ""}
            feedback is due the same day · lessons leave this page once feedback is saved.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/trainer/rotation"
            className="trainer-hover-fill inline-flex h-[34px] items-center rounded-[6px] border border-border bg-card px-3 text-[12px] font-semibold whitespace-nowrap text-ink"
          >
            Rotation &amp; TP points
          </Link>
          <Link
            href="/trainer/roster"
            className="trainer-hover-fill inline-flex h-[34px] items-center rounded-[6px] border border-border bg-card px-3 text-[12px] font-semibold whitespace-nowrap text-ink"
          >
            Roster
          </Link>
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((lesson) => (
            <OwedCard key={`${lesson.traineeId}-${lesson.tpNumber}`} lesson={lesson} />
          ))}
        </div>
      ) : (
        <div className="rounded-[6px] border border-border bg-card px-5 py-6">
          <p className="font-serif text-[20px] text-muted italic">Nothing owed. Every taught lesson has your feedback.</p>
        </div>
      )}

      {queue.othersOwed.length > 0 ? (
        <p className="flex items-center gap-2 text-[12px] text-muted">
          {queue.othersOwed.length} {queue.owed.length > 0 ? "more " : ""}owed by {otherTutor ?? "another tutor"}
          {otherGroup ? ` (${otherGroup})` : ""}
          <Link href={showOthers ? "/trainer/tp?others=0" : "/trainer/tp?others=1"} className="font-semibold hover:underline" style={{ color: "var(--hub-accent)" }}>
            {showOthers ? "Hide" : "Show"}
          </Link>
        </p>
      ) : null}

      <TodayCard today={queue.today} tomorrow={queue.tomorrow} />

      {/* The tab's occasional pages, one door each. */}
      <AlsoUnder
        tab="Teaching Practice"
        links={[
          { href: "/trainer/coursebooks", label: "TP points library" },
          { href: "/trainer/pre-course-task", label: "Pre-course tasks" },
          { href: "/trainer/observation-tasks", label: "Observation tasks" },
          { href: "/trainer/observation-hours", label: "Observation hours" },
          { href: "/trainer/gtky", label: "Day-one activities" },
        ]}
      />
    </div>
  );
}

/** Which TP number is being taught today, for the peer-task criteria lookup. */
function queuePeerTp(events: { event_date: string; type: string }[], today: string): number | null {
  const dates = [...new Set(events.filter((e) => e.type === "tp").map((e) => e.event_date))].sort();
  const i = dates.indexOf(today);
  return i >= 0 ? i + 1 : null;
}

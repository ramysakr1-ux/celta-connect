import { hubReadClient } from "@/lib/supabase/hub-read";
import Link from "next/link";
import { AlsoUnder } from "@/app/trainer/(hub)/also-under";
import { PageHead } from "@/app/trainer/(hub)/page-head";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { buildMarkingQueue, meetingDaysLabel, type QueueStatus } from "@/lib/tp-marking-queue";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { isMctView } from "@/lib/act-preview";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

const RULE_COLOR: Record<QueueStatus, string> = {
  feedback_due: "var(--color-status-warning-text)",
  teaching_now: "var(--color-primary)",
  planned: "var(--color-status-neutral-text)",
};

const PILL_CLASS: Record<QueueStatus, string> = {
  feedback_due: "pill-warning",
  teaching_now: "pill-info",
  planned: "pill-neutral",
};

const PILL_LABEL: Record<QueueStatus, string> = {
  feedback_due: "Feedback due",
  teaching_now: "Teaching now",
  planned: "Planned",
};

// Teaching Practice — the marking queue. Supersedes the 6 Aug 2026
// "one tab, two cards" decision (tp-density landing page merging TP Points
// Library + Rotation): Ramy's follow-up spec is explicit that the queue
// layout is what stands now -- "the job is triage, not browsing." The two
// cards' destinations (coursebooks library, rotation) stay reachable from
// here, just as links rather than the page's own content.
export default async function TeachingPracticeQueuePage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = trainer.course_id;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }
  const supabase = hubReadClient(trainer, courseId);
  // Ramy, 28 Aug 2026: "the logic behind everything" -- today was previously
  // new Date().toLocaleDateString("en-CA"), which reads the server's own
  // local time (UTC on Vercel), not the trainer's centre. Same bug class as
  // isEventLive below, same fix: the centre's real time_zone.
  const timeZone = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  const today = toLocalIso(now, timeZone);

  const [{ data: subgroupRows }, { data: roster }, { data: plans }, { data: tpEvents }, isMct, { data: tpGroupRows }] = await Promise.all([
    supabase.from("course_subgroups").select("id, name, tp_group_id, half_order").eq("course_id", courseId).order("created_at"),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee"),
    supabase.from("plan_assignments").select("trainee_id, tp_number, taught_at, main_lesson_aim, short_title").eq("course_id", courseId),
    supabase.from("course_timetable_events").select("*").eq("course_id", courseId).eq("type", "tp").order("event_date"),
    isMctView(trainer, courseId),
    supabase.from("course_tp_groups").select("id, tutor_profile_id").eq("course_id", courseId),
  ]);
  // Ramy, 5 Sep 2026: "the ACT doesn't need to see anything other than
  // their own group" -- a non-MCT tutor's queue and groups are scoped to
  // the TP groups they tutor. Unpaired subgroups have no tutor anywhere in
  // the schema (same gap the timetable's tutorial scoping flags) and stay
  // visible; a tutor who owns no group at all sees the whole course (fail
  // open -- groups just aren't staffed yet), same convention as Today.
  const ownedTpGroupIds = new Set((tpGroupRows ?? []).filter((g) => g.tutor_profile_id === trainer.id).map((g) => g.id));
  const scopedToOwnGroup = trainer.role === "trainer" && !isMct && ownedTpGroupIds.size > 0;
  const visibleSubgroupRows = scopedToOwnGroup
    ? (subgroupRows ?? []).filter((sg) => !sg.tp_group_id || ownedTpGroupIds.has(sg.tp_group_id))
    : (subgroupRows ?? []);
  // Scoped through this course's subgroups and candidates -- these two used
  // to be read with no filter at all, leaning on row security to narrow them.
  const rosterIds = (roster ?? []).map((r) => r.id);
  const [{ data: memberRows }, { data: feedback }] = await Promise.all([
    visibleSubgroupRows.length > 0
      ? supabase.from("course_subgroup_members").select("subgroup_id, trainee_id, base_slot").in("subgroup_id", visibleSubgroupRows.map((g) => g.id))
      : Promise.resolve({ data: [] as { subgroup_id: string; trainee_id: string; base_slot: number }[] }),
    rosterIds.length > 0
      ? supabase.from("tp_feedback").select("trainee_id, tp_number, submitted_at").in("trainee_id", rosterIds)
      : Promise.resolve({ data: [] as { trainee_id: string; tp_number: number; submitted_at: string | null }[] }),
  ]);

  const nameByTraineeId = new Map((roster ?? []).map((r) => [r.id, r.full_name]));
  const subgroupIds = new Set(visibleSubgroupRows.map((g) => g.id));
  const members = (memberRows ?? []).filter((m) => subgroupIds.has(m.subgroup_id));
  const traineeIds = new Set((roster ?? []).map((r) => r.id));

  const subgroups = visibleSubgroupRows.map((g) => ({
    id: g.id,
    tpGroupId: g.tp_group_id,
    halfOrder: g.half_order,
    members: members
      .filter((m) => m.subgroup_id === g.id)
      .map((m) => ({ traineeId: m.trainee_id, fullName: nameByTraineeId.get(m.trainee_id) ?? "Unknown", baseSlot: m.base_slot })),
  }));

  const queue = buildMarkingQueue({
    subgroups,
    plans: (plans ?? []).filter((p) => traineeIds.has(p.trainee_id)),
    feedback: (feedback ?? []).filter((f) => traineeIds.has(f.trainee_id)),
    tpEvents: tpEvents ?? [],
    today,
    now,
    timeZone,
  });

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead
        eyebrow={`Teaching Practice · feedback queue${scopedToOwnGroup ? " · your group" : isMct ? " · all groups" : ""}`}
        title={`${queue.length} lesson${queue.length === 1 ? "" : "s"} waiting on you`}
      />

      {/* The tab's occasional pages, one door each (the "TP points
          library" header button and the four text links this replaces
          were the same doors in two styles). */}
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

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.4fr_1fr]">
        {/* Waiting on you */}
        <div className="flex flex-col gap-[13px] rounded-[6px] border border-border bg-card px-[18px] py-4">
          <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Waiting on you</p>
          {queue.length === 0 ? (
            <p className="py-2 text-sm text-muted">Nothing waiting on you right now.</p>
          ) : (
            <div className="flex flex-col">
              {queue.map((row, i) => (
                <Link
                  key={`${row.traineeId}-${row.tpNumber}`}
                  href={`/portfolio/${row.traineeId}/tp/${row.tpNumber}`}
                  className={`flex items-start gap-3 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}
                >
                  <span
                    className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-[2px]"
                    style={{ backgroundColor: RULE_COLOR[row.status] }}
                  />
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <p className="text-[13px] font-semibold text-ink">
                      {row.traineeName} · TP{row.tpNumber}
                    </p>
                    <p className="text-[11.5px] leading-[1.45] text-muted">
                      {row.topic} · {row.when}
                    </p>
                  </div>
                  <span className={`pill ${PILL_CLASS[row.status]} shrink-0`}>{PILL_LABEL[row.status]}</span>
                </Link>
              ))}
            </div>
          )}
          <p className="border-t border-border-faint pt-2.5 text-[11.5px] leading-[1.5] text-muted">
            Starred action points from the last feedback carry automatically into that candidate&apos;s next lesson
            plan as personal aims.
          </p>
        </div>

        {/* Your groups */}
        <div className="flex flex-col gap-[13px] rounded-[6px] border border-border bg-card px-[18px] py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Your groups</p>
            <Link href="/trainer/rotation" className="text-[11px] text-primary hover:underline">
              Manage rotation
            </Link>
          </div>
          {subgroups.length === 0 ? (
            <p className="py-2 text-sm text-muted">No subgroups yet.</p>
          ) : (
            <div className="flex flex-col">
              {subgroups.map((g, i) => (
                <div key={g.id} className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <div className="flex flex-col gap-[3px]">
                    <p className="text-[13px] font-semibold text-ink">{visibleSubgroupRows.find((s) => s.id === g.id)?.name}</p>
                    <p className="text-[11.5px] text-muted">
                      {g.members.length > 0 ? g.members.map((m) => m.fullName).join(", ") : "No trainees yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {meetingDaysLabel(tpEvents ?? [], g.halfOrder)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="border-t border-border-faint pt-2.5 text-[11.5px] leading-[1.5] text-muted">
            Six candidates, two halves of three, alternate days. No more than three TPs in one day.
          </p>
        </div>
      </div>
    </div>
  );
}

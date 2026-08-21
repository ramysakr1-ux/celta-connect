import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { FilmedObservationWatchScreen } from "@/app/portfolio/[traineeId]/filmed-observation/[sessionId]/watch-screen";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";

// design_handoff_filmed_observation_watch: the group-watch screen. Access is
// RLS-scoped to the cohort (any profile whose course_id matches the
// session's), same "just render what the scoped client returns" pattern as
// the other portfolio detail pages -- no separate invite/booking step here,
// unlike Stage 1/3 tutorials, since every trainee on the course is expected
// at a filmed observation.
export default async function FilmedObservationWatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string; sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId, sessionId } = await params;
  const { t } = await searchParams;
  const initialSeekSeconds = t ? Number(t) : null;
  const supabase = await createClient();

  const { data: fSession } = await supabase
    .from("filmed_observation_sessions")
    .select("id, course_id, lesson_title, recording_url, timetable_event_id, level, learner_count, teacher_name, main_aim, sub_aim")
    .eq("id", sessionId)
    .maybeSingle();
  if (!fSession) notFound();

  const [{ data: event }, { data: breaks }, { data: task }, { data: courseProfiles }, { data: messages }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date, event_time").eq("id", fSession.timetable_event_id).maybeSingle(),
    supabase
      .from("filmed_observation_breaks")
      .select("*")
      .eq("session_id", sessionId)
      .order("break_number"),
    supabase
      .from("filmed_observation_tasks")
      .select("id, criteria_codes")
      .eq("session_id", sessionId)
      .maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("course_id", fSession.course_id),
    supabase
      .from("filmed_observation_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at"),
  ]);

  const { data: myResponse } = task
    ? await supabase
        .from("filmed_observation_task_responses")
        .select("completed_at")
        .eq("task_id", task.id)
        .eq("trainee_id", session.profile.id)
        .maybeSingle()
    : { data: null };

  const nameById = new Map((courseProfiles ?? []).map((p) => [p.id, p.full_name]));
  const criteriaLine =
    task && task.criteria_codes.length > 0
      ? task.criteria_codes.map((c) => `${c} · ${CRITERIA_LABELS[c] ?? c}`).join(" · ")
      : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/portfolio/${traineeId}`} className="text-xs text-muted hover:text-primary">
        ← Course stream
      </Link>

      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Connect · filmed observation · group session</p>
        <h1 className="mt-0.5 font-serif text-2xl text-ink">{fSession.lesson_title ?? "Filmed lesson — focus set by the trainer per session"}</h1>
        {event?.event_date ? (
          <p className="mt-1 text-sm text-muted">
            Scheduled {new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
            {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""} — missed it? Watch the same recording here any time.
          </p>
        ) : null}
      </div>

      <FilmedObservationWatchScreen
        traineeId={traineeId}
        sessionId={sessionId}
        myProfileId={session.profile.id}
        myName={session.profile.full_name}
        recordingUrl={fSession.recording_url}
        level={fSession.level}
        learnerCount={fSession.learner_count}
        teacherName={fSession.teacher_name}
        mainAim={fSession.main_aim}
        subAim={fSession.sub_aim}
        breaks={breaks ?? []}
        taskId={task?.id ?? null}
        criteriaLine={criteriaLine}
        taskCompletedAt={myResponse?.completed_at ?? null}
        nameById={nameById}
        initialMessages={messages ?? []}
        initialSeekSeconds={initialSeekSeconds !== null && !Number.isNaN(initialSeekSeconds) ? initialSeekSeconds : null}
      />
    </div>
  );
}

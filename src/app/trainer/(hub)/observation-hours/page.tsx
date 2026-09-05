import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { computeObservationHours, OBSERVATION_HOURS_REQUIRED } from "@/lib/observation-hours";
import { ObservationHoursRoster, type CandidateObservationRow, type ObservationLogEntry } from "@/app/trainer/(hub)/observation-hours/roster-view";

// connect-finalization-build-spec-2026-08-21.md item 4: the unified
// observation roster the design shows -- candidate, experienced-teacher
// hours, filmed hours, peer count, status, pending tasks, all in one place,
// with a per-candidate expandable log. Deliberately a NEW route
// (/trainer/observation-hours), not a replacement of the existing
// /trainer/observation-tasks page -- that page is a different, already-
// working feature (assigning directed observation tasks and reading
// submissions), not the same thing as this hours-tracking overview. This
// page reads the same `observations` rows that already feed the Roster's
// "Observation hrs" column and computeObservationHours() -- one source of
// truth, no second hour-tracking system.
//
// Peer observation is excluded from CELTA 5, the portfolio, the grade
// review, the assessor pack, and the close-out export by design (migration
// 0074) -- surfacing a peer count here, on a trainer-only working view, is
// a different surface and doesn't reopen that decision.
export default async function ObservationHoursPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }
  const courseId = trainer.course_id;
  const supabase = await createClient();

  const [{ data: trainees }, { data: observations }, { data: obsTasks }, { data: filmedSessions }, { data: peerSheets }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee").order("full_name"),
    supabase
      .from("observations")
      .select("id, trainee_id, observation_date, length_minutes, level, learners_present, lesson_focus, filmed, mode")
      .eq("course_id", courseId),
    supabase.from("observation_tasks").select("id, title").eq("course_id", courseId),
    supabase.from("filmed_observation_sessions").select("id, lesson_title").eq("course_id", courseId),
    supabase.from("peer_observation_sheets").select("id, trainee_id, tp_number").eq("course_id", courseId),
  ]);
  // Scoped through this course's candidates and sessions -- these three used
  // to be read with no filter, leaning on row security alone.
  const traineeIdList = (trainees ?? []).map((t) => t.id);
  const sessionIdList = (filmedSessions ?? []).map((s) => s.id);
  const [{ data: obsTaskSubmissions }, { data: filmedTasks }, { data: filmedResponses }] = await Promise.all([
    traineeIdList.length > 0
      ? supabase.from("observation_task_submissions").select("task_id, trainee_id, observation_id").in("trainee_id", traineeIdList)
      : Promise.resolve({ data: [] as { task_id: string; trainee_id: string; observation_id: string | null }[] }),
    sessionIdList.length > 0
      ? supabase.from("filmed_observation_tasks").select("id, session_id").in("session_id", sessionIdList)
      : Promise.resolve({ data: [] as { id: string; session_id: string }[] }),
    traineeIdList.length > 0
      ? supabase.from("filmed_observation_task_responses").select("task_id, trainee_id, observation_id, completed_at").in("trainee_id", traineeIdList)
      : Promise.resolve({ data: [] as { task_id: string; trainee_id: string; observation_id: string | null; completed_at: string | null }[] }),
  ]);

  const traineeNameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));
  const taskTitleById = new Map((obsTasks ?? []).map((t) => [t.id, t.title]));
  const filmedSessionIds = new Set((filmedSessions ?? []).map((s) => s.id));
  const sessionTitleById = new Map((filmedSessions ?? []).map((s) => [s.id, s.lesson_title ?? "Filmed observation"]));
  const sessionIdByFilmedTaskId = new Map((filmedTasks ?? []).filter((t) => filmedSessionIds.has(t.session_id)).map((t) => [t.id, t.session_id]));

  // observation_id -> a human label for the row's source, only for
  // observations this course's filmed sessions / directed tasks actually
  // produced (both write a real `observations` row on completion).
  const sourceByObservationId = new Map<string, string>();
  for (const sub of obsTaskSubmissions ?? []) {
    if (sub.observation_id && taskTitleById.has(sub.task_id)) {
      sourceByObservationId.set(sub.observation_id, `Directed task -- ${taskTitleById.get(sub.task_id)}`);
    }
  }
  for (const resp of filmedResponses ?? []) {
    const sessionId = sessionIdByFilmedTaskId.get(resp.task_id);
    if (resp.observation_id && sessionId) {
      sourceByObservationId.set(resp.observation_id, `Filmed observation (cohort) -- ${sessionTitleById.get(sessionId)}`);
    }
  }

  const { data: peerNotes } =
    (peerSheets ?? []).length > 0
      ? await supabase
          .from("peer_observation_notes")
          .select("observer_id, sheet_id, submitted_at")
          .in(
            "sheet_id",
            (peerSheets ?? []).map((s) => s.id)
          )
          .not("submitted_at", "is", null)
      : { data: [] };

  const sheetById = new Map((peerSheets ?? []).map((s) => [s.id, s]));
  const obsTasksTotal = (obsTasks ?? []).length;

  const rows: CandidateObservationRow[] = (trainees ?? []).map((trainee) => {
    const traineeObservations = (observations ?? []).filter((o) => o.trainee_id === trainee.id);
    const { liveHours, filmedHours, hoursCounted } = computeObservationHours(traineeObservations);

    const traineePeerNotes = (peerNotes ?? []).filter((n) => n.observer_id === trainee.id);
    const obsTasksDone = (obsTaskSubmissions ?? []).filter((s) => s.trainee_id === trainee.id).length;
    const pendingTasks = obsTasksTotal - obsTasksDone;

    const log: ObservationLogEntry[] = [
      ...traineeObservations.map((o) => ({
        id: o.id,
        kind: o.filmed ? ("filmed" as const) : ("live" as const),
        date: o.observation_date,
        lengthMinutes: o.length_minutes,
        level: o.level,
        learnerCount: o.learners_present,
        focus: o.lesson_focus,
        mode: o.mode,
        source: sourceByObservationId.get(o.id) ?? "Self-logged",
      })),
      ...traineePeerNotes.map((n) => {
        const sheet = sheetById.get(n.sheet_id);
        return {
          id: `peer-${n.sheet_id}-${n.observer_id}`,
          kind: "peer" as const,
          date: n.submitted_at,
          lengthMinutes: null,
          level: null,
          learnerCount: null,
          focus: sheet ? `TP${sheet.tp_number} -- ${traineeNameById.get(sheet.trainee_id) ?? "peer"}'s lesson` : "Peer observation",
          mode: null,
          source: "Peer observation",
        };
      }),
    ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return {
      id: trainee.id,
      name: trainee.full_name,
      liveHours,
      filmedHours,
      hoursCounted,
      onTrack: hoursCounted >= OBSERVATION_HOURS_REQUIRED,
      peerCount: traineePeerNotes.length,
      pendingTasks,
      log,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Observation hours</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">{rows.length} candidates</h1>
        <p className="mt-1 text-sm text-muted">
          Every observation source in one place -- self-logged, directed tasks, and filmed cohort sessions all feed
          the same {OBSERVATION_HOURS_REQUIRED}-hour requirement (filmed capped at 3 of those hours). Peer
          observation is required but never counts toward the six.
        </p>
      </div>

      <ObservationHoursRoster rows={rows} obsTasksTotal={obsTasksTotal} />
    </div>
  );
}

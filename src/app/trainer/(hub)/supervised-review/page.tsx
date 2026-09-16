import { hubReadClient } from "@/lib/supabase/hub-read";
import { requireRole } from "@/lib/auth/require-role";
import { PageHead } from "@/app/trainer/(hub)/page-head";
import { SupervisedSessionsPanel } from "@/app/trainer/(hub)/supervised-review/supervised-sessions-panel";

// Trainee workspace A3, third part (Ramy, 16 Sep 2026: "move it to the
// trainer hub"). The check-off panel used to sit at the foot of the
// CANDIDATE's own timetable, gated on isStaff -- a tutor's control inside a
// candidate's room, which is the thing that rule exists to stop.
//
// It is a room of the tutor's own now, and it answers the question they
// actually have: who still owes me a supervised session, across the whole
// group. One panel per candidate, the same component, unchanged.
export default async function SupervisedReviewPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = trainer.course_id;
  if (!courseId) {
    return <div className="sheet text-body text-muted">No course assigned.</div>;
  }
  const supabase = hubReadClient(trainer, courseId);

  const [{ data: events }, { data: roster }] = await Promise.all([
    supabase
      .from("course_timetable_events")
      .select("id, title, event_date")
      .eq("course_id", courseId)
      .eq("type", "supervised_session")
      .order("event_date"),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee").order("full_name"),
  ]);

  type Completion = {
    trainee_id: string;
    timetable_event_id: string;
    time_spent_seconds: number;
    response: string | null;
    submitted_at: string | null;
    checked_at: string | null;
    quiz_topic: "language" | "phonology" | "classroom" | null;
    score: number | null;
    question_count: number | null;
  };

  const traineeIds = (roster ?? []).map((r) => r.id);
  const { data: completions } = traineeIds.length
    ? await supabase
        .from("supervised_session_completions")
        .select("trainee_id, timetable_event_id, time_spent_seconds, response, submitted_at, checked_at, quiz_topic, score, question_count")
        .in("trainee_id", traineeIds)
    : { data: [] as Completion[] };

  const byTrainee = new Map<string, Completion[]>();
  for (const c of completions ?? []) {
    const list = byTrainee.get(c.trainee_id) ?? [];
    list.push(c);
    byTrainee.set(c.trainee_id, list);
  }

  const sessions = (events ?? []).map((e) => ({ id: e.id, title: e.title, event_date: e.event_date }));
  const outstanding = (roster ?? []).filter((p) => {
    const done = (byTrainee.get(p.id) ?? []).filter((c) => c.submitted_at).length;
    return done < sessions.length;
  }).length;

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead
        eyebrow={`Roster · Supervised review · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
        title="Supervised review"
        lede={
          sessions.length === 0
            ? "No supervised sessions are on this course's timetable yet."
            : outstanding === 0
              ? "Everyone has submitted every session. Tick one off once you have read it."
              : `${outstanding} candidate${outstanding === 1 ? " has" : "s have"} a session still to submit.`
        }
      />

      {sessions.length === 0
        ? null
        : (roster ?? []).map((person) => (
            <div key={person.id} className="flex flex-col gap-2">
              <h2 className="font-serif text-h3 font-semibold text-ink">{person.full_name}</h2>
              <SupervisedSessionsPanel traineeId={person.id} events={sessions} completions={byTrainee.get(person.id) ?? []} />
            </div>
          ))}
    </div>
  );
}

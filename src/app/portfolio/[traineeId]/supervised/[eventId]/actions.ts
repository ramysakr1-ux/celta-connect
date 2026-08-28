"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { scoreSupervisedQuiz, SUPERVISED_QUIZ_TOPICS, type QuizTopicKey } from "@/lib/supervised-quiz-content";

// for-claude-code-supervised-review.md: "Time spent -- tracked automatically
// while the task is open/active." Real elapsed time from the client's own
// ticking timer, reported in small increments rather than trusted as one
// final self-reported number -- the client only ever sends how much time
// passed since its last successful heartbeat, added to whatever's already
// stored, so a page reload or a dropped request can't zero it out.
export async function heartbeatSupervisedSession(eventId: string, deltaSeconds: number): Promise<void> {
  const trainee = await requireRole("trainee");
  if (deltaSeconds <= 0) return;
  const supabase = await createClient();
  // Ramy, 28 Aug 2026: "the logic behind everything" -- neither action here
  // checked eventId belongs to a real "supervised_session" event in this
  // trainee's own course (only the read page did), so a trainee could ping
  // this with the id of any other timetable event in their course and rack
  // up fraudulent contact-time credit roster.ts counts toward
  // supervisedDone. Same check the page itself already does.
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id")
    .eq("id", eventId)
    .eq("type", "supervised_session")
    .eq("course_id", trainee.course_id ?? "")
    .maybeSingle();
  if (!event) return;
  const { data: existing } = await supabase
    .from("supervised_session_completions")
    .select("time_spent_seconds, submitted_at")
    .eq("timetable_event_id", eventId)
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (existing?.submitted_at) return; // locked, no more ticking
  await supabase.from("supervised_session_completions").upsert(
    {
      timetable_event_id: eventId,
      trainee_id: trainee.id,
      time_spent_seconds: (existing?.time_spent_seconds ?? 0) + deltaSeconds,
    },
    { onConflict: "timetable_event_id,trainee_id" }
  );
}

// for-claude-code-supervised-review.md's "completion flag" is the tick
// itself (already computed in roster.ts's supervisedDone/supervisedTotal);
// this is the other half -- a trainer actually marking one submission as
// checked, which nothing wrote before this (checked_at/checked_by were
// read in task-form.tsx's "waiting on your trainer to check this" but
// never set anywhere).
export async function checkSupervisedSession(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const timetableEventId = formData.get("timetable_event_id");
  const traineeId = formData.get("trainee_id");
  if (typeof timetableEventId !== "string" || typeof traineeId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("supervised_session_completions")
    .update({ checked_at: new Date().toISOString(), checked_by: trainer.id })
    .eq("timetable_event_id", timetableEventId)
    .eq("trainee_id", traineeId)
    .not("submitted_at", "is", null);

  revalidatePath(`/portfolio/${traineeId}/timetable`);
}

export interface QuizSubmitResult {
  error: string | null;
  score?: number;
  questionCount?: number;
}

// Supervised Review Quiz.dc.html resolves migration 0100's open question:
// reread (notes) then a topic quiz, not free-text. Score is recomputed here
// from the answer indices rather than trusted from the client -- same
// reasoning as any other marked task in this app, even though this one is
// auto-graded rather than tutor-graded.
export async function submitSupervisedQuiz(
  eventId: string,
  topic: QuizTopicKey,
  answers: (number | null)[]
): Promise<QuizSubmitResult> {
  const trainee = await requireRole("trainee");
  if (!(topic in SUPERVISED_QUIZ_TOPICS)) return { error: "Unknown topic." };

  const supabase = await createClient();
  // Same real-event/own-course check as heartbeatSupervisedSession above --
  // without it, a trainee could submit a scored completion against any
  // timetable event id in their course, not just a real supervised session.
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id")
    .eq("id", eventId)
    .eq("type", "supervised_session")
    .eq("course_id", trainee.course_id ?? "")
    .maybeSingle();
  if (!event) return { error: "Session not found." };
  const { data: existing } = await supabase
    .from("supervised_session_completions")
    .select("submitted_at")
    .eq("timetable_event_id", eventId)
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (existing?.submitted_at) return { error: "Already submitted." };

  const { score, questionCount } = scoreSupervisedQuiz(topic, answers);

  const { error } = await supabase.from("supervised_session_completions").upsert(
    {
      timetable_event_id: eventId,
      trainee_id: trainee.id,
      quiz_topic: topic,
      score,
      question_count: questionCount,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "timetable_event_id,trainee_id" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/portfolio/${trainee.id}/supervised/${eventId}`);
  revalidatePath(`/portfolio/${trainee.id}/timetable`);
  return { error: null, score, questionCount };
}

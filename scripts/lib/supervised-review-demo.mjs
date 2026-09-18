// The supervised review task, part-done, as it would be on the day.
//
// Found empty on 18 Sep 2026 -- not one completion had ever been written, in
// the demo or anywhere, because nothing in Connect linked a candidate to the
// task (fixed in 1dc23a95). With a door there, an empty page now reads as a
// cohort who have not started rather than as a broken feature, so the demo
// seeds what day 16 actually looks like: most of the group through, a couple
// still owing, one tutor-checked.
//
// The three sessions are matched by title, the same curated way the app
// matches them (supervised-quiz-content.ts) -- never a fuzzy test, or a
// feedback slot could be handed a quiz topic it has no questions for.
const REVIEW_TITLES = {
  "Supervised review — presenting language": "language",
  "Supervised review — phonology": "phonology",
  "Supervised review — classroom management": "classroom",
};

/** 15 questions per topic (Supervised Review Quiz.dc.html). */
const QUESTION_COUNT = 15;

export async function seedSupervisedReviewDemo(supabase, { courseId, traineeIds, mctId, now }) {
  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date, event_time")
    .eq("course_id", courseId)
    .eq("type", "supervised_session");

  const sessions = (events ?? [])
    .map((e) => ({ ...e, topic: REVIEW_TITLES[e.title] ?? null }))
    .filter((e) => e.topic);
  if (sessions.length === 0 || traineeIds.length === 0) return { written: 0, sessions: 0 };

  const rows = [];
  sessions.forEach((session, sIndex) => {
    // Deterministic, not random: a seed that shuffles makes every rebuild a
    // different demo and every screenshot a lie about the last one.
    traineeIds.forEach((traineeId, tIndex) => {
      const step = (sIndex * 5 + tIndex) % 7;
      if (step === 6) return; // this one has not opened it at all
      const started = new Date(`${session.event_date}T${(session.event_time ?? "15:15:00").slice(0, 8)}`);
      const inProgress = step === 5; // opened, not submitted
      const score = 15 - ((tIndex + sIndex) % 4); // 12-15 of 15
      rows.push({
        timetable_event_id: session.id,
        trainee_id: traineeId,
        started_at: started.toISOString(),
        time_spent_seconds: inProgress ? 180 + step * 40 : 420 + step * 55,
        response: inProgress ? null : "Checked my notes on the recap, then answered.",
        submitted_at: inProgress ? null : new Date(started.getTime() + (620 + step * 40) * 1000).toISOString(),
        quiz_topic: inProgress ? null : session.topic,
        score: inProgress ? null : score,
        question_count: inProgress ? null : QUESTION_COUNT,
        // The tutor has been through the first session's submissions only --
        // the other two are waiting, which is what gives the tutor's page
        // something to do.
        checked_at: !inProgress && sIndex === 0 ? new Date(started.getTime() + 86400000).toISOString() : null,
        checked_by: !inProgress && sIndex === 0 ? mctId : null,
      });
    });
  });

  const { error } = await supabase
    .from("supervised_session_completions")
    .upsert(rows, { onConflict: "timetable_event_id,trainee_id" });
  if (error) throw new Error(`supervised review: ${error.message}`);
  return { written: rows.length, sessions: sessions.length };
}

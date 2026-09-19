// Filmed observations, watched: the sessions already held get a view, a
// completed task and the observations row the app writes on "Mark as
// complete" (filmed-observation-actions.ts) -- so the Resource Hub's "N of
// 5 tasks done", the candidate's hours and the tutor's Observation hours page
// all read a cohort that has watched what it was shown.
//
// Runs from seed-demo.mjs on every rebuild and from a one-off runner on the
// live course, so it takes the record clock rather than reading one.

// Eight answers per session, in candidate voice, keyed by prompt index the
// way the task panel stores them ({ "0": ..., "7": ... }). The rating and
// the "one thing to use" answer vary per candidate so no two records match.
const ANSWERS = {
  "Getting to know you -- online": {
    rating: ["Mostly learners", "Fairly even", "Mostly learners"],
    responses: [
      "Classroom management: where people sit and who they work with; how the teacher gives instructions and checks them; how they use the board and the screen; monitoring; timing; and who is talking -- keeping the teacher's own talk down so the learners do the work.",
      "She stayed at the front for instructions and moved to the side of the screen when learners were working -- literally leaned out of frame once, which I think was on purpose. Came back centre only to close a task.",
      "Pairs by numbering (1-2-1-2), then breakout rooms of three for the mingle. The regrouping took about forty seconds each time; she named the rooms before opening them, so nobody asked where to go.",
      "Kept her camera on but muted, and watched the chat. When two learners typed answers she picked one up in feedback. She wrote two errors on a notepad and dealt with them at the end, not in the moment.",
      "\"Type your name, then two true things and one lie. Don't say which. Two minutes.\" -- checked with \"How many true?\" (\"Two\"). \"Now read your partner's three. Guess the lie. Then tell them.\" -- checked by asking one pair to demonstrate.",
      "Instructions before the task, not during (04:10). The demonstration with a learner instead of an explanation (11:30). Naming the breakout rooms before opening them (18:45).",
      "I would have put the true/lie lines on a slide as well as saying them -- two learners retyped their names when she said 'three things'. And I'd have given a time warning before closing the rooms; one group was cut mid-sentence.",
      ["Demonstrate the first item with a learner rather than explain it.", "Put the instruction on the screen as well as saying it.", "Name the rooms before opening them."],
    ],
  },
  "Reading and lexis": {
    rating: ["Mostly clear", "Very clear", "Mostly clear"],
    responses: [
      "A skills lesson -- reading. The moment that told me was 02:30: the first task was a gist question about the whole text, not a language point, and the vocabulary came out of the text afterwards rather than being taught up front.",
      "Receptive. The teacher never asked the learners to produce the language in the text -- they read for gist, then for detail, and the lexis stage was about meaning from context, not use.",
      "A receptive skills framework: lead-in, pre-teach, gist, detail, then a lexis focus and a short speaking task to close. It matched the shape from the input session almost exactly, which made it easy to follow.",
      "00:00 lead-in: pictures, pairs talk (2 min). 03:30 pre-teach three words. 07:00 gist task, one question, two-minute read. 12:00 detail task, six statements, pairs check. 24:00 lexis: matching from the text. 33:00 speaking: which city would you live in.",
      "Learners can read a short article for the general idea and then for specific facts, and pick up six new words from it on the way.",
      "The detail task did the most: it forced a careful second read and the pair check was where the real talking happened. The lexis matching could have been cut -- most of the words had already been worked out from the gist stage.",
      "The gist question set up the detail task well -- they already knew the shape of the text. The missing link was between lexis and speaking: the six words weren't needed for the speaking task, so they were learnt and then left.",
      ["Give the speaking task a reason to use the new words -- put three of them in the question.", "Drop the matching stage and use the time for a second speaking round.", "Set the detail task before the second read, not after -- they read once without knowing what for."],
    ],
  },
  "Vocabulary: function and pronunciation": {
    rating: ["Balanced", "Learner-heavy", "Balanced"],
    responses: [
      "Five minutes from 10:00: teacher about 2m10, learners 2m50. Most of the teacher talk was drilling models and short questions; there was no stretch of explanation longer than fifteen seconds.",
      "\"What do you say when you want to leave early?\" (eliciting the function). \"Is this polite or direct?\" (checking meaning). \"Where's the stress -- WOULD you mind, or would you MIND?\" (checking pronunciation; it moved the lesson into the drill).",
      "At 14:20 he explained what 'mind' means in 'would you mind' -- but the learners had just used it correctly in the matching task, so \"Ask your partner: would you mind opening the window -- what does mind mean here?\" would have got it from them.",
      "Very little -- 'appropriate', once, which one learner queried. He rephrased as 'the right one for this person'. Otherwise the language was graded well below the level of the text.",
      "In full sentences mostly, because the functions ARE sentences. To the teacher during the drill, to each other in the role play. Timestamps: 09:15 choral, 17:40 pairs, 26:00 open-class reporting back.",
      "Dealt with: 'Would you mind to open' (recast at 11:05); flat intonation on a request (drilled at 12:30). Let go: 'I am agree' at 24:10 during the role play. Right call both times -- the role play was for fluency.",
      "The drilling: chorally, then individually, then in pairs, with the stress marked on the board before the first drill. And the way he asked a question and then waited -- a genuine three or four seconds every time.",
      ["Wait after a question. Count to three before doing anything.", "Mark the stress on the board before drilling, not after.", "Ask a checking question instead of explaining a word the class has already used correctly."],
    ],
  },
};

export async function seedFilmedObservationsDemo(supabase, { courseId, trainees, today }) {
  const { data: sessions } = await supabase
    .from("filmed_observation_sessions")
    .select("id, lesson_title, length_minutes, level, learner_count, timetable_event_id")
    .eq("course_id", courseId);
  const eventIds = (sessions ?? []).map((s) => s.timetable_event_id).filter(Boolean);
  const { data: events } = eventIds.length ? await supabase.from("course_timetable_events").select("id, event_date").in("id", eventIds) : { data: [] };
  const dateOf = new Map((events ?? []).map((e) => [e.id, e.event_date]));
  const { data: tasks } = await supabase.from("filmed_observation_tasks").select("id, session_id, rating_options").in("session_id", (sessions ?? []).map((s) => s.id));
  const active = trainees.filter((t) => !t.withdrawn);
  let sessionCount = 0;
  let responses = 0;
  for (const session of sessions ?? []) {
    const date = dateOf.get(session.timetable_event_id);
    const bank = ANSWERS[session.lesson_title];
    const task = (tasks ?? []).find((t) => t.session_id === session.id);
    if (!date || date > today || !bank || !task) continue;
    sessionCount += 1;
    for (const [i, tr] of active.entries()) {
      // Two people missed the third session and have not caught up.
      if (sessionCount === 3 && i % 5 === 2) continue;
      const watchedAt = `${date}T17:20:00`;
      const completedAt = new Date(`${date}T18:1${i % 5}:00`).toISOString();
      await supabase.from("filmed_observation_views").upsert({ session_id: session.id, trainee_id: tr.id, first_opened_at: new Date(watchedAt).toISOString() }, { onConflict: "session_id,trainee_id", ignoreDuplicates: true });
      const { data: obs, error: obsErr } = await supabase
        .from("observations")
        .insert({
          course_id: courseId,
          trainee_id: tr.id,
          observation_date: date,
          length_minutes: session.length_minutes,
          level: session.level,
          learners_present: session.learner_count,
          lesson_focus: session.lesson_title,
          filmed: true,
          mode: "f2f",
        })
        .select("id")
        .single();
      if (obsErr) throw obsErr;
      const answers = bank.responses.map((a) => (Array.isArray(a) ? a[i % a.length] : a));
      const responsesJson = Object.fromEntries(answers.map((a, k) => [String(k), a]));
      const rating = bank.rating[i % bank.rating.length];
      const { error } = await supabase.from("filmed_observation_task_responses").upsert(
        {
          task_id: task.id,
          trainee_id: tr.id,
          responses: responsesJson,
          response_1: answers[0],
          response_2: answers[1],
          response_general: answers[7],
          rating,
          completed_at: completedAt,
          observation_id: obs.id,
        },
        { onConflict: "task_id,trainee_id" }
      );
      if (error) throw error;
      responses += 1;
    }
  }
  return { sessions: sessionCount, responses };
}

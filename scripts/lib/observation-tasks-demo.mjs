// Directed observation tasks (migration 0101), with submissions.
//
// /trainer/observation-tasks read "0 assigned" on every walkthrough: the
// feature existed, the demo never used it. Ramy, 20 Sep 2026: seed two or
// three. Three tasks set across the course, each with the submissions a
// real cohort would have made by now -- and, as the app does on submit, a
// real `observations` row behind each one so the hours count through the
// one function everything else reads.
//
// Runs from seed-demo.mjs on every rebuild and from a one-off runner on the
// live course, so it takes the record clock rather than reading one.

const TASKS = [
  {
    setDay: 3,
    title: "Instructions and checking",
    instructions:
      "Observe one lesson taught by an experienced teacher this week. Pick two task set-ups. For each, write down what the teacher said, word for word as far as you can, and how they knew the class had understood before the task began. Then name one thing from the way they set up tasks that you will use in your next TP.",
    lessons: [
      ["Reading for gist and detail: a news article on city life", "B1+"],
      ["Functional language: making and responding to suggestions", "A2"],
    ],
    responses: [
      "Set-up 1: \"Read the text quickly -- two minutes -- and tell me: is the writer happy in the city, or not? Don't read every word.\" She held up two fingers for two minutes and wrote the question on the board before handing out the text. She checked by asking one student \"Are you reading every word?\" and got \"No, quickly\". Set-up 2: \"Now, in pairs, question three. You are A, you are B. A asks, B answers.\" She pointed at each pair as she said A and B. To check, she asked a pair to demonstrate the first exchange. What I will use: the question goes on the board BEFORE the paper goes out.",
      "First set-up was the listening: \"You will hear a man in a hotel. Listen once. Where is he going?\" -- one question, written up, the recording played only after everyone had looked at the board. She checked with \"How many times do we listen?\" and the class said \"One\". Second was the pairwork: she gave instructions, then the handout, then said \"Show me question one\" and waited until everyone pointed. I noticed there was no \"Do you understand?\" at any point. What I'll take: hand out the paper after the instruction, never before.",
      "Task set-up one: \"Look at the pictures. Don't write. Just talk to your partner: which of these would you do at the weekend?\" He demonstrated with one student first, then said \"Go\". The check was the demonstration itself -- the class saw what the task looked like. Task set-up two: \"Underline every word you don't know. Then compare with your partner. Then ask me.\" -- three steps, given one at a time with a pause between each. He checked by asking \"What do you do first?\" and \"And then?\" One thing to use: the demonstration with a student instead of explaining.",
      "Set-up 1: the suggestion role play. \"A wants to go out. B says no, and gives a reason. Then change.\" She wrote A and B on the board with the two lines under them. Instruction check: \"Who says no?\" -- \"B\". Set-up 2: the matching task. \"Match the phrase to the picture. Alone. Two minutes.\" Checked by holding up the handout and pointing to the first match, done together as a class. What I will use: doing the first item together as the check, rather than asking whether it is clear.",
      "The two set-ups I chose were both before pairwork. In the first she said the instruction, then asked a strong student to say it back in his own words -- that was the check. In the second she used gesture as much as words: \"Stand up\" (stood up), \"find someone with the same card\" (held up a card and looked around). The check was simply watching whether people moved; she went straight to the two who didn't. One thing for my TP: say the instruction, then stop talking. She never repeated herself while people were already working.",
      "Set-up 1: \"Cover the text. Look at the title only. What do you think the article is about? Tell your partner. One minute.\" -- she checked by asking \"Are we reading now?\" (\"No\") and \"Talking to who?\" (\"Partner\"). Set-up 2: \"Now read and check: were you right?\" -- a very short instruction that worked because the first one had done the work. What I want to use: the check questions were about the task, not \"do you understand\", and they took about five seconds.",
    ],
  },
  {
    setDay: 7,
    title: "Error correction: what, when, how",
    instructions:
      "In one lesson, keep a log of every correction the teacher makes. For each: what the error was, when the correction came (on the spot, at the end of the task, at the end of the lesson), and how (a gesture, a recast, the board, the learner or a peer). Then note one error the teacher heard and chose to leave, and say whether you agree.",
    lessons: [
      ["Present perfect for life experience: guided discovery", "B1+"],
      ["Vocabulary: food and cooking, with a personalised speaking task", "A2"],
    ],
    responses: [
      "Six corrections logged. Three on the spot during the controlled practice (\"I have went\" -- she said \"have...?\" with a rising tone and the student self-corrected; \"since two years\" -- finger for 'since/for' on two hands, student chose 'for'; a pronunciation one, /biːn/ not /bɪn/, modelled and drilled). Two at the end of the freer speaking, written on the board without names, class corrected them together. One at the end of the lesson as a 'good things and one thing to fix' slot. Left alone: a student said \"more better\" during the fluency task and she let it go. I agree -- the aim was fluency and the meaning was clear.",
      "I counted eight corrections, more than I expected. During the drill everything was on the spot and mostly by gesture -- she has a whole set: a hand behind the ear for 'say it again', a finger pointing backwards for past tense. During the speaking task she wrote errors on a clipboard and did five of them on the board at the end, anonymously, students corrected in pairs. The one she left: a learner said \"I am agree\" three times. I think it was deliberate -- it is a fossilised error she has probably addressed before, and the task was about food, not agreeing. I would have written it down for later.",
      "On the spot (4): all in the accuracy stage, all short -- a recast (\"He cooks\", after \"He cook\"), a gesture for the third-person -s (she taps her thumb), 'listen again' with the audio, and one where she asked a peer \"Is that right?\". Delayed (3): after the speaking task on the board. End-of-lesson (0). Left: a Turkish student dropped articles all through the speaking task -- \"I went to shop\". Not corrected. I half agree: it didn't block meaning, but it was every sentence and nobody else was doing it, so a quiet word afterwards might have helped more than public correction.",
      "The pattern was clear: on the spot when the aim was form, delayed when the aim was communication. In the guided discovery part every error got picked up immediately, usually by asking the class rather than telling (\"Is it 'ever' or 'never' here?\"). In the interview task she only listened and wrote. Delayed correction was five sentences on the board, half right and half wrong, and students had to find which were which -- that was clever because the good ones were praised too. Left: 'peoples' as a plural. Agree, low priority in that lesson.",
      "Corrections: 7. Timing: 5 immediate, 2 delayed. How: 2 gestures, 2 recasts, 2 peer corrections (she asked the pair), 1 board. The thing I noticed most was how quick the immediate ones were -- a second or two, no explanation, then straight back to the task. The delayed ones got explanation. The error left was a pronunciation one, 'comfortable' with four syllables, in the middle of a student telling a story. Definitely agree, you don't stop a story for a schwa.",
    ],
  },
  {
    setDay: 12,
    title: "Teacher talk and eliciting",
    instructions:
      "Watch one lesson with a stopwatch. Over any ten-minute stretch, record roughly how long the teacher talked and how long learners did. Write down three questions the teacher asked exactly as asked, and say what each one was for -- eliciting, checking, or moving the lesson on. Then find one moment where the teacher told the class something they could have got from the learners, and say how you would have elicited it instead.",
    lessons: [
      ["Listening for specific information: a hotel booking", "A2"],
      ["Reading for gist and detail: a news article on city life", "B1+"],
    ],
    responses: [
      "Ten minutes from the start of the listening stage: teacher 3m40, learners 6m20 -- and most of the teacher's talk was instructions and the check questions, not explanation. Questions: \"What can you see in the picture?\" (eliciting, opening the topic); \"Is he booking a room or a table?\" (checking the gist question was understood); \"OK -- now listen for the price. Ready?\" (moving on). Told instead of elicited: she explained what 'en suite' meant. Two students had already understood it from the picture; \"Where is the bathroom in this room?\" would have got it.",
      "Middle ten minutes: teacher 5m10, learners 4m50 -- a bit teacher-heavy, but it was the language clarification stage so that seems fair. Three questions: \"When do we use this -- now, or before now?\" (concept checking); \"What's another word for 'huge'?\" (eliciting vocabulary from the text); \"Everyone finished? Good.\" (moving on -- not really a question). The told moment: he explained the difference between 'town' and 'city' himself. The Vietnamese student is from Hanoi and the Turkish student from a small town -- \"Lan, is Hanoi a town or a city? Why?\" would have done it in the same time.",
      "First ten minutes: teacher 6m, learners 4m. Second ten minutes (pairwork): teacher 1m30, learners 8m30. Averaged it looks balanced but the shape matters -- the front of the lesson was mostly her. Questions: \"Have you ever stayed in a hotel like this?\" (eliciting, personalisation); \"Do we say 'a' hotel or 'an' hotel?\" (checking, form); \"So what did Maria say about the breakfast?\" (checking the listening). The told moment was the pronunciation of 'reservation' -- she modelled it straight away. I would have asked \"Where is the stress? Clap it.\"",
      "Teacher 4m30 / learners 5m30 over the ten minutes I timed. Questions as asked: \"What do you think 'commute' means -- look at the sentence before it.\" (eliciting, with a strategy built in); \"Is it a good thing or a bad thing in this text?\" (checking meaning); \"Right -- pairs. Go.\" (moving on). The told moment: he gave the class the answer to question 4 after one wrong answer. I'd have asked the pair next to them \"Do you agree?\" and let it bounce around once more before telling.",
    ],
  },
];

/**
 * @param ctx.courseId the demo course
 * @param ctx.trainees ordered list of { id, name, group: "A"|"B", withdrawn }
 * @param ctx.createdBy the MCT's profile id
 * @param ctx.today course-local ISO date the record is written "as of"
 * @param ctx.courseDay (n) => ISO date of teaching day n
 * @param ctx.atDay (n, hhmm) => ISO timestamp on teaching day n
 */
export async function seedObservationTasksDemo(supabase, { courseId, trainees, createdBy, today, courseDay, atDay }) {
  let tasks = 0;
  let submissions = 0;
  for (const [t, task] of TASKS.entries()) {
    if (courseDay(task.setDay) > today) continue; // not set yet
    const { data: row, error } = await supabase
      .from("observation_tasks")
      .insert({ course_id: courseId, title: task.title, instructions: task.instructions, created_by: createdBy, created_at: atDay(task.setDay, "16:30") })
      .select("id")
      .single();
    if (error) throw error;
    tasks += 1;
    // Who has handed it in: nearly everyone for the first, most for the
    // second, under half for the newest -- skipping a different pair each
    // time so no one is always the laggard.
    const active = trainees.filter((x) => !x.withdrawn);
    for (const [i, tr] of active.entries()) {
      const skip = t === 0 ? i % 5 === 4 : t === 1 ? i % 3 === 2 : i % 2 === 1 || i % 5 === 0;
      if (skip) continue;
      const doneDay = task.setDay + 1 + ((i + t) % 3); // one to three days after it was set
      if (courseDay(doneDay) > today) continue;
      // The first half of the course is taught at the group's own level.
      const [focus, level] = task.lessons[(i + t) % task.lessons.length];
      const { data: obs, error: obsErr } = await supabase
        .from("observations")
        .insert({
          course_id: courseId,
          trainee_id: tr.id,
          observation_date: courseDay(doneDay),
          length_minutes: 60,
          level,
          learners_present: 12,
          lesson_focus: focus,
          filmed: false,
          mode: "f2f",
        })
        .select("id")
        .single();
      if (obsErr) throw obsErr;
      const { error: subErr } = await supabase.from("observation_task_submissions").insert({
        task_id: row.id,
        trainee_id: tr.id,
        observation_id: obs.id,
        response: task.responses[(i + t) % task.responses.length],
        submitted_at: atDay(doneDay, "18:40"),
      });
      if (subErr) throw subErr;
      submissions += 1;
    }
  }
  return { tasks, submissions };
}

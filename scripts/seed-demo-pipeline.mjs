// Fills the two DEMO centres with a pipeline that looks like a centre actually
// recruiting. Ramy, 2 Sep 2026: "I'm supposed to be showing this as a demo, and
// it just seems like they're not doing very well. Zero money collected... very
// few admissions. They could have made things look a little better."
//
// He was right: New York had three applicants and Los Angeles had none at all,
// so every money figure read zero and switching branches went from three rows
// to an empty page. Demo centres only -- never Elmswood.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NY = [["Marta Kowalski","marta.kowalski"],["Yusuf Demir","yusuf.demir"],["Chiara Rossi","chiara.rossi"],
  ["Tomás Herrera","tomas.herrera"],["Aiko Tanaka","aiko.tanaka"],["Farah Haddad","farah.haddad"],
  ["Lucas Meyer","lucas.meyer"],["Nadia Petrova","nadia.petrova"],["Owen Blackwood","owen.blackwood"],
  // Ramy, 12 Sep 2026: the assessor checks the files of rejected applicants
  // too (Handbook 14.1), and the demo had never turned anyone down.
  ["Selin Aydın","selin.aydin"],["Kwame Mensah","kwame.mensah"],
  // seed-demo.mjs's own three, by their real addresses: two accepted with
  // deposits (the payments views) and the journey's applicant. They exist
  // before this runs, so their stage is read back rather than assigned.
  ["Noor Iqbal","demo-applicant-noor@celtaconnect.com"],["Ben Foster","demo-applicant-ben@celtaconnect.com"],
  ["Tariq Osei","demo-applicant-journey@celtaconnect.com"]];
const LA = [["Sofia Marquez","sofia.marquez"],["Daniel Osei","daniel.osei"],["Hana Kim","hana.kim"],
  ["Ravi Chandran","ravi.chandran"],["Elena Duarte","elena.duarte"],["Jonah Reid","jonah.reid"]];
// The next intake at the primary centre: a funnel that has only just opened.
const NEXT = [["Priya Raman","priya.raman"],["Mateo Álvarez","mateo.alvarez"],["Ingrid Solberg","ingrid.solberg"],
  ["Leila Benali","leila.benali"],["Samuel Achebe","samuel.achebe"]];
const NEXT_STAGES = ["accepted","offer_sent","interview_completed","task_returned","submitted"];
// A real funnel shape: most through, a few still moving, one waiting, two turned down.
const STAGES = ["accepted","accepted","accepted","offer_sent","offer_sent","interview_completed",
                "interview_booked","submitted","waiting_list","rejected_after_interview","rejected_before_interview"];
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
const agoDate = (d) => ago(d).slice(0, 10);

// --- What a real file holds -----------------------------------------------
//
// Until 12 Sep 2026 every seeded applicant was a name, an email and a stage:
// no date of birth, no task, no marks, no interview record. The applicant
// page read "--" in every panel, the assessor's application files had
// nothing to show, and an offer could go out with no task on file because
// none ever was. Everything below is the record selection leaves behind,
// varied enough that two files never read the same. Names only reach the
// assessor; the rest stays on the applicant page.

const EDUCATION = [
  "BA English Literature, University of Leeds (2019). CELTA is the first teaching qualification I have gone for.",
  "BSc Psychology, University of Manchester (2021), followed by a PGCE year I did not complete.",
  "Licenciatura en Filología Inglesa, Universidad de Salamanca (2018). C2 Cambridge Proficiency, 2020.",
  "MA Translation Studies, Boğaziçi University (2022). English is my second language; Turkish is my first.",
  "BA History and Politics, Trinity College Dublin (2017). Two years on the Erasmus scheme in Bologna.",
  "BEng Civil Engineering, University of Cape Town (2016). Left the profession in 2024 to teach.",
  "Diploma in Hotel Management, Les Roches (2019). Worked front-of-house in three countries since.",
];
const ELT_EXPERIENCE = [
  "None formally. I have tutored two neighbours' children in English for about a year.",
  "Six months as a conversation assistant at a language school in Valencia, unqualified, mostly one-to-one.",
  "Two years teaching young learners at a private academy in Ho Chi Minh City. No training beyond a weekend induction.",
  "None. I have taught adults in a corporate setting -- onboarding, software -- but never language.",
  "Volunteer ESOL at a community centre in Bradford, one evening a week for eighteen months.",
  "A summer school in Brighton, four weeks, as an activity leader who also covered two lessons a day.",
  "None at all, which is why I am applying.",
];
const WRITING_TASKS = [
  "The teacher I remember best was Mr Okonkwo, who taught me history when I was fourteen. What he did, I now realise, was very simple: he never answered a question straight away. He would say \"what do you think?\" and then wait, and the silence was long enough that somebody always filled it. He also wrote almost nothing on the board -- three or four words a lesson -- and yet I can still picture those words. I think he understood that what you work out for yourself you keep, and what you are told you lose by Friday.\n\nIf I taught, I would want to do the same thing: hold back, let the room do the work, and trust that the quiet is not empty.",
  "Can anyone learn a language as an adult? I want to say yes, but honestly the answer is \"yes, but not the way children do, and not without wanting to.\" I learned Spanish at twenty-six, living in Bilbao, and the thing that made the difference was not the classes but having to buy bread. Adults have advantages children lack: they know what a verb is, they can ask for a rule, they can be embarrassed and survive it. What they do not have is time and the freedom to be wrong in public. A good course, I think, gives them that freedom back for a few hours a week.",
  "A word about my grandmother's kitchen. It was small, hot, and smelled of cumin and something burning, always. She cooked without measuring anything and if you asked how much salt she said \"enough.\" I learned to cook by standing next to her and copying, badly, until one day it was not bad. I mention this because it is the only way I have ever really learned anything: by doing it wrong beside someone who could do it right and did not mind me watching.",
  "Learning a language as an adult is possible but it requires the learner to accept that they will sound like a child for a while. Most adults find this very difficult. In my experience working in hotels in three countries, the staff who learned fastest were the ones who did not mind being laughed at. The ones who waited until they could say something perfectly said nothing for a year. So my answer is: anyone can, but not everyone will, and the difference is not intelligence, it is a kind of humility.",
  "My best teacher was a woman called Ms Farrell who taught maths. She had a rule that you were not allowed to say \"I don't get it\" -- you had to say what you did get, up to the point where you stopped. It sounds harsh but it wasn't; it meant that every conversation started from what you knew. She also marked in green, not red, which I thought was silly at the time and now think was the point.",
  "I think the honest answer to whether adults can learn a language is that it depends what you mean by learn. My father moved to England at forty and has spoken English every day for thirty years. His grammar is not perfect and his accent is strong, and he has run a business, raised three children and argued with the council in that English. If that is not learning a language I do not know what is. The idea that only children can do it comes from measuring the wrong thing.",
  "Describing a teacher who taught me well: my driving instructor. He would say very little, and when I made a mistake he waited to see if I had noticed. If I had, he said nothing. If I hadn't, he asked a question -- \"what did you see in the mirror just then?\" -- and let me find it. I passed first time. I have thought about him a lot since deciding to apply for this course, because I think teaching a language is closer to teaching driving than to teaching history: it is a skill, not a subject.",
];
const LANGUAGE_AWARENESS = [
  "\"He don't like\" should be \"He doesn't like\" -- third person singular. \"I am living here since 2019\" needs the present perfect continuous: \"I have been living here since 2019\", because the action started in the past and continues now.",
  "\"He don't like\" -- should be \"doesn't\", the subject is he. \"I am living here since 2019\" -- I think it should be \"I have lived here since 2019\" but I am not certain of the name of the tense. Present perfect?",
  "Two errors. Third-person -s is missing on \"don't\" (should be \"doesn't\"). The second sentence uses the present continuous with \"since\", which marks a starting point in the past; English uses the present perfect (simple or continuous) for a state that began in the past and still holds: \"I have lived / have been living here since 2019.\"",
  "he don't like -> he doesn't like. I am living here since 2019 -> I live here since 2019.",
  "The first sentence needs \"doesn't\". In the second, \"since\" with a point in time wants the present perfect -- \"I have been living here since 2019\" -- because we are talking about a period that runs from then to now. A learner might ask why not \"for\": \"for\" takes a length of time, \"since\" takes a starting point.",
];
// Marks against the five-row scheme, with the note the form requires on any
// "below". Indexed by applicant position so accepted files read strong,
// the rejected-before-interview one reads weak on the task, and the
// rejected-after-interview one reads fine on paper -- the interview is
// where it went wrong.
const MARKS = {
  strong: { language_awareness: "above", accuracy: "above", organisation: "at", range: "above", substance: "at" },
  sound: { language_awareness: "at", accuracy: "at", organisation: "at", range: "at", substance: "above" },
  mixed: { language_awareness: "at", accuracy: "below", organisation: "at", range: "at", substance: "at",
    accuracy_note: "Several comma splices and two agreement errors; readable but would need watching in written feedback to students." },
  weak: { language_awareness: "below", accuracy: "below", organisation: "at", range: "below", substance: "at",
    language_awareness_note: "Corrected the first error but replaced the second with a different error; no sense of why.",
    accuracy_note: "Tense and article errors throughout the task itself.",
    range_note: "Short, simple sentences only; the argumentative prompt was answered in a paragraph." },
};
const TASK_FEEDBACK = [
  "A thoughtful piece with a clear line through it. Your language-awareness answer names the tense and explains the meaning behind the form, which is exactly what the course asks of you.",
  "Clear and honest writing. You were unsure of the tense name in the awareness task -- that is fine; you got the correction right, and the terminology is what the course teaches.",
  "Well organised and the substance is good. Watch accuracy: the comma splices in paragraphs two and three would be picked up by students.",
  "Thank you for the task. The awareness section corrected one error and introduced another, and the writing itself carried the same kind of error, which is the concern for a course where you will be modelling language from the first week.",
];
const OVERALL_NOTES = [
  "Warm, reflective, asks good questions back. Clear-eyed about the workload -- has arranged leave. Recommend accepting.",
  "Quiet but every answer had something in it. A little anxious about being observed; talked it through and she was fine. Accept.",
  "Very confident, perhaps a touch too much so on the language questions -- answered before the question was finished, twice. Would benefit from the course; accept with a note for the tutors.",
  "Couldn't give a clear account of how the five weeks would be managed alongside a full-time job that he does not intend to leave. Gave the time-commitment question a second time in different words; same answer. Not this course, not this time.",
  "Strong on motivation, articulate about her own learning. Language awareness in conversation matched the task. Accept.",
];
const IDENTITY_DOCS = ["passport", "passport", "national_id", "passport", "driving_licence", "passport", "other"];

// Answers to the fixed questions, generic enough to read well against any of
// the seven and specific enough not to read as filler.
const FIXED_ANSWERS = [
  "Because I have wanted to teach for years and kept finding reasons not to. This year I ran out of reasons.",
  "A lesson I gave a group of hotel trainees on complaints handling. I had planned a role-play; nobody wanted to play the angry guest. I ended up playing her myself and it went better than the plan.",
  "I'd say the first sentence is about a period that started in the past and is still going, so English uses the present perfect. I'd probably draw a timeline.",
  "I've taken unpaid leave from work and my partner knows what's coming.",
  "I'll find it hard at first. I'd rather know than not know, though.",
  "Learning to drive on the left in Ireland, in a week, for a job. Terrifying, then fine.",
  "I am dyslexic; I read slowly and I would appreciate handouts in advance where that is possible.",
];

// The two demo centres are handed in by id. They used to be found by matching
// their NAMES -- /New York/ and /Los Angeles/ -- so renaming the primary demo
// centre to Istanbul made `ny` undefined and this died on `ny.id`. That is the
// second time this file has died on an undefined centre; a script that finds
// its own subject by regex over a display name will keep doing it.
//
// Falls back to whatever demo centres exist, primary first, so it still runs
// on its own.
const { data: centres } = await supabase
  .from("centers").select("id, name, currency").eq("is_demo", true).order("created_at");
const byId = (id) => centres.find((c) => c.id === id) ?? null;
const ny = byId(process.env.DEMO_PRIMARY_CENTER_ID) ?? centres[0];
const la = byId(process.env.DEMO_SECOND_CENTER_ID) ?? centres[1] ?? centres[0];
if (!ny || !la) { console.error("pipeline: need two demo centres, found", centres.length); process.exit(1); }
const { data: courses } = await supabase.from("courses").select("id, name, center_id").in("center_id", [ny.id, la.id]);

// The application form's own prompts. Ramy, 3 Sep 2026: "the recording part,
// the actual recording. I wanna be able to record myself." He couldn't -- the
// form only renders the recorder when the centre has an active speaking
// prompt, and BOTH demo centres had zero writing prompts and zero speaking
// prompts. So the only application form with a recorder on it was Elmswood's
// live one, which the journey rightly labels "look, don't submit".
//
// Seeded here rather than in a migration: a migration runs once and the next
// centre rebuild destroys what it wrote.
const WRITING = [
  ["narrative", "Describe a time you learned something difficult, and what actually helped."],
  ["descriptive", "Describe a teacher who taught you well, and what they actually did."],
  ["argumentative", "Can anyone learn a language as an adult? Take a position and defend it."],
];
const SPEAKING = [
  "Tell us about a time you had to adapt your communication style for a new audience.",
  "Describe how you would explain your job to a stranger.",
  "Talk about a meal you know how to cook well.",
];

let writingAdded = 0, speakingAdded = 0;
for (const centre of [ny, la]) {
  for (const [prompt_type, prompt_text] of WRITING) {
    const { data: exists } = await supabase
      .from("application_writing_prompts")
      .select("id").eq("center_id", centre.id).eq("prompt_text", prompt_text).maybeSingle();
    if (exists) continue;
    const { error } = await supabase
      .from("application_writing_prompts")
      .insert({ center_id: centre.id, prompt_type, prompt_text, active: true });
    if (error) console.warn("  writing prompt:", error.message); else writingAdded++;
  }
  for (const prompt_text of SPEAKING) {
    const { data: exists } = await supabase
      .from("speaking_task_prompts")
      .select("id").eq("center_id", centre.id).eq("prompt_text", prompt_text).maybeSingle();
    if (exists) continue;
    const { error } = await supabase
      .from("speaking_task_prompts")
      .insert({ center_id: centre.id, prompt_text, active: true });
    if (error) console.warn("  speaking prompt:", error.message); else speakingAdded++;
  }
}
console.log(`writing prompts added: ${writingAdded}   speaking prompts added: ${speakingAdded}`);

// The interview question bank. Migration 0176 seeded the starter set into
// every centre that existed on the day it ran; a rebuilt demo centre is a new
// row and gets none, so the interview record form read "No active questions
// in the bank -- add some in Settings first" on every demo. Same seven
// questions as 0176, same rule: only a centre with an empty bank.
const QUESTIONS = [
  ["Why CELTA, and why now?", "motivation_suitability"],
  ["Talk me through a lesson that did not go the way you planned.", "classroom_presence"],
  ['A learner asks why we say "I have lived here for five years" and not "I live here for five years". What do you say?', "language_awareness"],
  ["This course is intensive and full-time. What have you arranged for the five weeks?", "time_commitment"],
  ["You will be observed teaching from the first week and given feedback in front of your group. How does that sit with you?", "flexibility_openness"],
  ["Tell me about a time you had to learn something difficult quickly.", "other"],
  ["Is there anything about the course, or about how you work, that we should know?", "other"],
];
const questionsByCentre = new Map();
for (const centre of [ny, la]) {
  const { data: bank } = await supabase.from("interview_questions").select("id, question_text").eq("center_id", centre.id).eq("active", true);
  if (!bank || bank.length === 0) {
    const { data: inserted, error } = await supabase
      .from("interview_questions")
      .insert(QUESTIONS.map(([question_text, coverage_area]) => ({ center_id: centre.id, question_text, coverage_area })))
      .select("id, question_text");
    if (error) console.warn("  interview questions:", error.message);
    questionsByCentre.set(centre.id, inserted ?? []);
  } else {
    questionsByCentre.set(centre.id, bank);
  }
}
console.log(`interview question bank: ${[...questionsByCentre.values()].map((q) => q.length).join(" / ")} questions`);

// The next intake at the primary centre. The running course still accepts
// applications (nobody has closed intake -- see seed-demo.mjs), but a live
// application submitted from the demo journey should have somewhere sensible
// to land: a course that has not started. Four weeks after the running one
// ends, on a Monday, same shape.
const running = courses.find((c) => c.name === "CELTA Demo Course");
let nextIntake = courses.find((c) => c.name === "CELTA Demo Course (Autumn)") ?? null;
if (!nextIntake && running) {
  const { data: runningRow } = await supabase.from("courses").select("end_date, delivery_mode").eq("id", running.id).single();
  const start = new Date(`${runningRow.end_date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 31 - ((start.getUTCDay() + 6) % 7)); // the Monday four-and-a-bit weeks on
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 25);
  const iso = (d) => d.toISOString().slice(0, 10);
  const { data: created, error } = await supabase
    .from("courses")
    .insert({
      center_id: ny.id,
      name: "CELTA Demo Course (Autumn)",
      start_date: iso(start),
      end_date: iso(end),
      total_hours: 120,
      delivery_mode: runningRow.delivery_mode ?? "f2f",
      accepting_applications: true,
      application_cap: 12,
    })
    .select("id, name, center_id")
    .single();
  if (error) console.warn("  next intake:", error.message);
  else {
    nextIntake = created;
    courses.push(created);
    console.log(`next intake: ${created.name} ${iso(start)} -> ${iso(end)}`);
  }
}

// The marker and interviewer: the centre's main course tutor, who exists on
// the primary centre; the second branch falls back to whoever the centre
// owner is. Selection "must be conducted by accredited course tutors" (7.2).
async function tutorFor(centreId) {
  const { data: tutor } = await supabase
    .from("profiles").select("id, full_name").eq("center_id", centreId).eq("role", "trainer").order("created_at").limit(1).maybeSingle();
  if (tutor) return tutor;
  const { data: owner } = await supabase
    .from("centre_roles").select("profile_id, profiles(full_name)").eq("center_id", centreId).eq("role", "centre_owner").limit(1).maybeSingle();
  return owner ? { id: owner.profile_id, full_name: owner.profiles?.full_name ?? "Centre owner" } : null;
}

// What the record holds per stage. `i` picks a different education, task and
// note for each person so no two files read alike; the arrays wrap.
function profileFor(i, stage, daysAgo) {
  const pick = (arr) => arr[i % arr.length];
  const pastTask = stage !== "submitted";
  const interviewed = ["interview_completed", "offer_sent", "accepted", "waiting_list", "rejected_after_interview", "not_this_time"].includes(stage);
  const decided = ["offer_sent", "accepted", "waiting_list", "rejected_after_interview", "rejected_before_interview", "not_this_time"].includes(stage);
  const marks =
    stage === "rejected_before_interview" ? MARKS.weak
    : stage === "rejected_after_interview" ? MARKS.sound
    : stage === "waiting_list" ? MARKS.mixed
    : i % 3 === 0 ? MARKS.strong : i % 3 === 1 ? MARKS.sound : MARKS.mixed;
  const marked = pastTask && (decided || stage === "interview_booked" || stage === "interview_completed" || stage === "task_returned");
  const row = {
    date_of_birth: `${1986 + (i * 7) % 14}-${String(1 + (i * 5) % 12).padStart(2, "0")}-${String(1 + (i * 11) % 28).padStart(2, "0")}`,
    education_summary: pick(EDUCATION),
    elt_experience_summary: pick(ELT_EXPERIENCE),
    writing_task_submission: pick(WRITING_TASKS),
    language_awareness_submission: [
      { question: "Identify and correct the language errors in the passage provided.", answer: pick(LANGUAGE_AWARENESS) },
    ],
    acknowledged_no_guarantee_at: ago(daysAgo),
    acknowledged_no_exemptions_at: ago(daysAgo),
    acknowledged_full_attendance_at: ago(daysAgo),
    // The arrival date is part of the story: an offer accepted in July on
    // an application made today is not a file, it is a contradiction.
    created_at: ago(daysAgo),
  };
  if (marked) {
    for (const key of ["language_awareness", "accuracy", "organisation", "range", "substance"]) {
      row[`marking_${key}`] = marks[key];
      row[`marking_${key}_note`] = marks[`${key}_note`] ?? null;
    }
    row.marked_at = ago(Math.max(daysAgo - 2, 1));
    row.task_feedback =
      stage === "rejected_before_interview" ? TASK_FEEDBACK[3]
      : marks === MARKS.mixed ? TASK_FEEDBACK[2]
      : pick(TASK_FEEDBACK.slice(0, 2));
    row.task_feedback_edited_at = row.marked_at;
  }
  if (stage === "offer_sent" || stage === "accepted") {
    row.offer_sent_at = ago(Math.max(daysAgo - 6, 1));
    row.offer_accept_by = agoDate(Math.max(daysAgo - 6, 1) - 14);
    row.fee_amount = 1800;
  }
  if (stage === "accepted") row.accepted_at = ago(Math.max(daysAgo - 8, 1));
  if (stage === "rejected_before_interview") {
    row.rejected_at = ago(Math.max(daysAgo - 3, 1));
    row.rejection_reason = "The written task and the language awareness answer both fell below the standard the course needs from the first week.";
  }
  if (stage === "rejected_after_interview") {
    row.rejected_at = ago(Math.max(daysAgo - 5, 1));
    row.rejection_reason = "Could not show at interview how the full-time course would be managed alongside a job he is keeping.";
  }
  if (stage === "waiting_list") { row.waiting_list_position = 1; row.waiting_list_hear_by = agoDate(-10); }
  return { row, interviewed, marked };
}

let added = 0, enriched = 0, plans = 0, collected = 0, records = 0;
for (const [centre, course, names, stages] of [
  [ny, courses.find((c) => c.name === "CELTA Demo Course"), NY, STAGES],
  [la, courses.find((c) => /Los Angeles/.test(c.name)), LA, STAGES],
  [ny, nextIntake, NEXT, NEXT_STAGES],
]) {
  if (!course) continue;
  const tutor = await tutorFor(centre.id);
  const questions = questionsByCentre.get(centre.id) ?? [];
  const { data: prompts } = await supabase.from("application_writing_prompts").select("id, prompt_type").eq("center_id", centre.id).eq("active", true);
  const promptId = (i) => (prompts && prompts.length > 0 ? prompts[i % prompts.length].id : null);

  for (let i = 0; i < names.length; i++) {
    const [full_name, slug] = names[i];
    const email = slug.includes("@") ? slug : `${slug}@example.com`;
    const { data: exists } = await supabase.from("applicants").select("id, stage").eq("email", email).eq("center_id", centre.id).maybeSingle();
    // An applicant already there keeps the stage they are at -- a demo may
    // have moved them since, and the file must match where they stand.
    const stage = exists?.stage ?? stages[i % stages.length];
    const daysAgo = stages === NEXT_STAGES ? 2 + i * 3 : 4 + i * 5;   // arrivals spread over ~7 weeks; the next intake over two
    const { row, interviewed, marked } = profileFor(i, stage, daysAgo);
    if (tutor && marked) { row.marked_by = tutor.id; row.task_feedback_edited_by = tutor.id; }
    row.writing_task_prompt_id = promptId(i);

    let applicantId = exists?.id ?? null;
    if (exists) {
      // Already there from an earlier run, or from seed-demo.mjs: restore
      // the file to its canonical shape without moving the stage a demo may
      // have changed since. Deterministic from position and stage, so a
      // re-run puts back exactly what a walkthrough may have edited away.
      const { error } = await supabase.from("applicants").update(row).eq("id", exists.id);
      if (error) console.warn("  enrich:", full_name, error.message); else enriched++;
    } else {
      const { data: applicant, error } = await supabase.from("applicants").insert({
        center_id: centre.id, intake_course_id: course.id, full_name, email, stage, ...row,
        fee_paid: false, waiting_list_opt_out: false,
        notification_opt_outs: [], created_at: ago(daysAgo), updated_at: ago(daysAgo),
      }).select("id").single();
      if (error) { console.warn("  applicant:", full_name, error.message); continue; }
      applicantId = applicant.id;
      added++;
    }

    // The interview record, for everyone who was interviewed: the fixed
    // questions answered, one drawn question, the identity check (7.2) and
    // the interviewer's signature. One per applicant; skipped if it exists.
    if (interviewed && tutor && applicantId) {
      const { data: has } = await supabase.from("interview_records").select("id").eq("applicant_id", applicantId).maybeSingle();
      if (!has) {
        const when = ago(Math.max(daysAgo - 4, 1));
        const { error } = await supabase.from("interview_records").insert({
          applicant_id: applicantId,
          fixed_questions: questions.map((q, k) => ({ question_id: q.id, question_text: q.question_text, answer_text: FIXED_ANSWERS[(k + i) % FIXED_ANSWERS.length] })),
          drawn_questions: [{
            question_text: "Your task corrected the first error but not the second -- talk me through the second sentence again.",
            answer_text: "I'd say it's about something that started in 2019 and is still true, so it wants the present perfect. I wasn't sure of the name when I wrote it.",
            drawn_reason: "Language awareness answer named the tense uncertainly.",
          }],
          interviewer_signature_name: tutor.full_name,
          interviewer_signed_at: when,
          applicant_signature_name: stage === "rejected_after_interview" ? null : full_name,
          applicant_signed_at: stage === "rejected_after_interview" ? null : when,
          overall_notes: stage === "rejected_after_interview" ? OVERALL_NOTES[3] : OVERALL_NOTES[i % 5 === 3 ? 4 : i % 5],
          identity_checked_at: when,
          identity_document_type: IDENTITY_DOCS[i % IDENTITY_DOCS.length],
          created_by: tutor.id,
          created_at: when,
        });
        if (error) console.warn("  interview record:", full_name, error.message); else records++;
      }
    }

    if (exists || stage !== "accepted") continue;        // only those who accepted are paying, and only once
    const applicant = { id: applicantId };
    const currency = centre.currency || "USD";
    const { data: plan } = await supabase.from("payment_plans").insert({
      center_id: centre.id, course_id: course.id, applicant_id: applicant.id,
      total_amount: 1800, currency, instalment_count: 3, created_at: ago(daysAgo),
    }).select("id").single();
    plans++;

    // Deposit and second instalment settled recently, so "collected this
    // month" stops reading zero; the third is still to come.
    for (const [instalment_index, amount, status, when] of [[1, 600, "paid", 40], [2, 600, "paid", 1], [3, 600, "pending", 0]]) {
      // paid_at, not created_at: every "collected this month" figure in the
      // app filters on paid_at, so a payment with status 'paid' and no
      // paid_at counts as nothing. That is why the first pass still read $0.
      await supabase.from("payments").insert({
        center_id: centre.id, payment_plan_id: plan.id, instalment_index,
        amount, currency, status, source: "manual", created_at: ago(when),
        paid_at: status === "paid" ? ago(when) : null,
      });
      if (status === "paid") collected += amount;
    }
  }
}
console.log(`applicants added: ${added}   enriched: ${enriched}   interview records: ${records}   payment plans: ${plans}   collected recently: ${collected}`);

// Pre-course task answers, so the tutor's "Who's answered what" page and the
// candidates' own task pages show a cohort three weeks into the course
// rather than "0 of 50" for everyone (Ramy, 20 Sep 2026: seed most of the
// cohort, leave two or three incomplete).
//
// The answers are written the way a good applicant writes them: right where
// the task has an answer, in their own words where it doesn't, with a
// deliberate slip or two spread across the cohort so no two records are
// identical. Stored exactly as the answer box stores them
// (task-answer-box.tsx): plain text for an `open` task; for a shaped task a
// JSON map keyed by part/row index -- "i" for parts and select rows,
// "i.c" for text rows with columns, {choice, text} for choice rows,
// {picked: [...]} for a checklist. Matched to items by Cambridge's own task
// number (pre_course_task_items.task_number), which survives a reseed.
//
// Runs from seed-demo.mjs on every rebuild and from a one-off runner on the
// live course.

const P = (...parts) => Object.fromEntries(parts.map((t, i) => [String(i), t]));
const SEL = (...opts) => Object.fromEntries(opts.map((t, i) => [String(i), t]));
const CH = (...opts) => Object.fromEntries(opts.map((t, i) => [String(i), { choice: t }]));
const ROWS = (cols, ...rows) => Object.fromEntries(rows.flatMap((r, i) => r.map((t, c) => [`${i}.${c}`, t])));

// Two voices for the personal tasks, so the tutor opening two names does not
// read the same paragraph twice.
const VOICES = [
  {
    1: P(
      "Full-time, face to face, at Elmswood -- a group of twelve, two teaching practice groups, four weeks.",
      "Not for certain. I would like to teach adults in a language school in Spain or Portugal, ideally general English to start with; a friend has suggested online teaching as a bridge while I look."
    ),
    4: "The learners whose motivation comes from somewhere else -- a parent, an employer, a visa requirement -- and who have no goal of their own for the language. I think the hardest of all is the person who is unsure why they are there, because there is nothing for the teacher to connect the lessons to. Strength of motivation seems to matter more than the type.",
    6: "Rules. School. Red pen. Tables of verb endings. Latin. Also: the thing I notice when someone gets it wrong but couldn't explain why it is wrong. Since starting this task I'd add 'the part I actually need to learn properly before I can teach'.",
    30: "So far today: my phone lock screen (a glance, scanning for anything urgent), a WhatsApp thread (skimmed, then read one message carefully because it had a time in it), the back of a cereal box (idly, no purpose at all), two emails (one skimmed and deleted, one read twice because I had to reply), a road sign, and this task -- read slowly and more than once. Almost nothing was read word by word from the top.",
    34: "1. A podcast while making breakfast -- listening for pleasure, half attention, no need to remember anything. 2. My manager on the phone giving me two dates and a room number -- listening intensively and writing them down, asked her to repeat the room number. 3. The train announcements -- ignored everything until I heard my platform, then listened closely for the change.",
  },
  {
    1: P(
      "A full-time, four-week face-to-face course at Elmswood English Centre, in a group of twelve.",
      "Yes, roughly -- I already teach part-time at a community centre (conversation classes, mixed levels, mostly adults who arrived in the last two years) and I want to carry on there with a proper qualification. Possibly private one-to-one lessons as well."
    ),
    4: "For me the most challenging would be the learners with only extrinsic motivation -- the ones who have been sent. If the goal belongs to someone else (an employer, a parent), the lessons have nothing of theirs to attach to. Learners with a clear personal goal, even a small one, are easier to plan for because you can show them the lesson moving them towards it.",
    6: "Terminology I half remember. Diagrams. 'Don't end a sentence with a preposition.' My French teacher at school. But also: patterns, and the satisfaction when a rule explains something that had seemed random. I would say my associations are mixed rather than negative.",
    30: "A text message (scanned for who it was from, then read properly), a recipe on my phone while cooking (read the ingredients carefully, skimmed the method, went back to check one step), the headlines on a news site (skimmed, opened one article, read the first two paragraphs, abandoned it), a bus timetable (scanned for one number) and this document (read closely, re-reading the instructions).",
    34: "1. Listening to a friend describing a problem at work -- interactional, listening for the feeling as much as the facts, no notes. 2. A YouTube tutorial on fixing a bike brake -- listened intensively, paused and replayed one section three times. 3. Overhearing two people on the bus -- half listening, no motivation, tuned out as soon as it stopped being interesting.",
  },
];

const BANK = {
  2: P(
    "I have taught teenagers as a volunteer and found the adults I worked with more rewarding: they had chosen to be there and they told me what they needed. I also want to work abroad, and most of that work is with adults.",
    "As an adult I bring a reason for being here, a clear goal, some anxiety about being judged, and quite a lot of experience of being taught well and badly. I also bring habits: I like to know why we are doing something.",
    "Adult learners tend to have their own reasons and goals for learning; life and work experience to draw on; expectations of the teacher and of themselves; past learning experiences, good and bad, that shape how they learn; self-discipline but also limited time; and a sense of face -- they don't like to look foolish in front of others."
  ),
  3: P(
    "Their reasons for learning and any specific goals (an exam, a job, moving country); how much English they have studied and how; what they can already do, especially in speaking; their jobs, studies and interests so I can choose topics; how long they will be with us; and what kind of classroom activities they are used to and comfortable with.",
    "A short questionnaire or needs analysis on day one, a placement test if the school has one, talking to them informally before and after lessons, and watching them in the first couple of activities -- who speaks, who avoids it, who asks about grammar."
  ),
  5: { picked: ["is friendly", "has a sense of humour", "gives clear information and feedback", "is patient", "knows about language and learning"] },
  7: {
    0: { choice: "Correct" },
    1: { choice: "Not", text: "I went to the movies last night." },
    2: { choice: "Not", text: "He often comes late." },
    3: { choice: "Correct" },
    4: { choice: "Not", text: "Can I have a black coffee, please?" },
    5: { choice: "Not", text: "People with 12 items or fewer can queue here." },
  },
  8: "1. To help learners with their language -- when someone says something wrong, a teacher needs to give the correct version AND be able to say why, which needs the grammar and the terms for it. 2. To anticipate what learners will find difficult and plan for it. 3. To answer questions: learners expect an English teacher to know about English, the way they expect a maths teacher to know maths, and many learners have studied grammar in their own language and use the terminology. 4. To choose and adapt materials sensibly. 5. To understand the learners' mistakes rather than just hearing that they sound wrong -- from the learners' side, 'that's just how we say it' is not an explanation they can use.",
  9: SEL("Pronoun", "Article", "Conjunction", "Adverb", "Adjective", "Modal verb", "Determiner", "Preposition", "Verb", "Noun"),
  10: CH("Lexical", "Lexical", "Auxiliary", "Auxiliary", "Auxiliary", "Lexical"),
  11: CH("Lexical", "Auxiliary", "Auxiliary", "Lexical", "Lexical", "Lexical", "Auxiliary", "Lexical"),
  12: SEL("C. Advice", "E. Permission", "B. Logical deduction", "A. Ability", "D. Possibility"),
  13: SEL("past tense form", "-ing form", "3rd person – present simple tense", "base form", "past participle form"),
  14: ROWS(3,
    ["heard", "heard", "irregular"],
    ["did", "done", "irregular"],
    ["helped", "helped", "regular"],
    ["thought", "thought", "irregular"],
    ["took", "taken", "irregular"],
    ["stole", "stolen", "irregular"],
    ["went", "gone (or been)", "irregular"],
    ["drank", "drunk", "irregular"],
    ["arrived", "arrived", "regular"]
  ),
  15: ROWS(1, ["past, progressive"], ["modal, perfect"], ["present, perfect"], ["past, progressive, passive"], ["past (simple)"], ["modal, progressive"]),
  16: ROWS(1,
    ["present progressive (continuous)"],
    ["past simple"],
    ["present simple"],
    ["past perfect"],
    ["present simple passive"],
    ["future perfect"],
    ["past simple + past progressive"],
    ["present perfect progressive (continuous)"]
  ),
  17: ROWS(1, ["past"], ["future"], ["past up to now (the present)"], ["present -- it's a polite request now, not something in the past"], ["past, present and future -- a permanent state"]),
  18: P("The auxiliary 'be' -- am, is, are.", "The -ing form (present participle)."),
  19: ROWS(1,
    ["Future -- an arrangement already made"],
    ["A habit that annoys the speaker -- past, present and probably future; 'always' + progressive for complaining"],
    ["Past -- the speaker switches to the present to make the story more dramatic (the 'historic present')"]
  ),
  20: ROWS(1,
    ["'Have' here means possession -- a state -- so it can't be progressive. 'He has a brother and a sister.'"],
    ["'Like' is a state verb; 'I like this ice cream.' (Though 'I'm loving it' is now heard in informal use.)"],
    ["'Think' meaning 'have an opinion' is a state: 'What do you think of your new job?' -- 'What are you thinking about?' would be fine because there it means the activity."],
    ["'Lack' is a state verb: 'This sauce lacks salt.'"]
  ),
  21: "Part of speech (noun, verb, adjective...) and grammar such as countable/uncountable or whether a verb takes an object; the pronunciation in phonemic script and the stress; an example sentence showing it in context; common collocations (words it goes with); whether it is formal, informal, British/American, old-fashioned; any warning about connotation (positive/negative, offensive); related forms (photograph, photographer); the frequency in some learner dictionaries; and sometimes a note on easily confused words.",
  22: ROWS(1,
    ["'Highest' should be 'tallest' -- 'high' is for buildings and mountains, not people."],
    ["'Enervated' is too formal and, in any case, means drained of energy rather than sleepy; 'tired' fits the context."],
    ["'Pretentious' is negative -- it clashes with 'extremely good'. Something like 'original and thought-provoking' was meant."],
    ["'Slap' is violent; you can't give a loving slap. 'A loving pat/touch on the cheek.'"],
    ["'Footing' is a false friend (from Spanish/French) -- in English it's 'jogging' or 'running'."]
  ),
  23: ROWS(1,
    ["strikingly + handsome -- adverb-adjective"],
    ["make + (his) bed, do + housework -- two verb-noun collocations"],
    ["absolutely + fabulous -- adverb-adjective"],
    ["depend + on -- verb-preposition"],
    ["highly + emotional -- adverb-adjective"],
    ["vicious + circle -- adjective-noun"]
  ),
  24: SEL("B. giving emphasis to one syllable", "C. an individual sound", "A. the music of our voices"),
  25: SEL("B. the listener might understand 'bin' when the speaker wanted to say 'pin'", "C. the speaker can sound arrogant and demanding", "A. the word is incomprehensible"),
  26: "1. their (there/they're) 2. south 3. language 4. peaceful 5. young 6. call 7. search 8. equation 9. sugar. I had to look up two of the symbols -- the /ʃ/ in 'sugar' and 'equation' took me a while.",
  27: ROWS(1, ["third: guaranTEE"], ["first: CAValry"], ["fourth: mechaniSAtion"], ["first: LANguage"], ["second: reTREAT"], ["first: SPECulative"], ["second: sucCESS"], ["first: BALance"], ["second: iDENtity"], ["second: arTICulate"]),
  28: P(
    "PHOtograph, phoTOgraphy, phoTOgrapher, photoGRAphic. The stress moves with each suffix and the vowel sounds change with it (the first 'o' becomes a schwa in 'photography'), so learners who have learnt one form say all of them the same way -- and in many languages stress is fixed, so they don't expect it to move at all.",
    "to reCORD / a REcord, to inCREASE / an INcrease, to preSENT / a PREsent, to imPORT / an IMport. Pattern: the noun has the stress on the first syllable, the verb on the second."
  ),
  29: ROWS(1, ["moth-ER (the -er)"], ["FOR-get (the 'o')"], ["A-nnounce (the first 'a')"], ["TO-night (the 'o')"], ["not-A-ble (the 'a')"], ["men-TION (the -ion)"], ["PA-trol (the 'a')"], ["in-dic-A-tive (the 'a')"]),
  31: SEL("Skim/gist reading", "Scan reading", "Intensive/detailed reading", "Scan reading"),
  32: "It breaks the flow -- by the time you have looked up the fifth word you have lost the thread of the sentence, never mind the paragraph. It's slow, it's tiring, and it's not how anyone reads in their own language, so it doesn't build the skill of coping with a text you don't fully understand. It also treats every unknown word as equally important when most of them aren't.",
  33: "You can't control the speed -- the speaker sets it. You can't go back and check something the way you can with a text. Words run together in connected speech so you may not recognise a word you know on paper. Accents, background noise and a recording with no face to watch make it harder still. You have to process meaning while the next sentence is already arriving, so there is no time to think. And with a recording there is no chance to ask the speaker to repeat.",
  35: SEL("Intensive listening", "Skim/gist listening", "Scan listening", "Intensive listening", "Listening to infer meaning", "Skim/gist listening"),
  36: "Because studying a language and using it are different skills. Two years of grammar and vocabulary give you passive knowledge -- you can recognise and understand -- but speaking needs practice at putting it together in real time, and most school courses give almost none. There is also pronunciation, which you cannot learn from a book, and confidence: if you have only ever produced language for a teacher to mark, speaking to a stranger feels like a test.",
  37: CH("Not successful", "Successful", "Successful", "Not successful"),
  38: CH("Transactional", "Transactional", "Interactional", "Interactional", "Transactional", "Interactional"),
  39: "It gives them practice in the actual skill -- you learn to speak by speaking. It activates language they have studied but never used, including pronunciation. It forces them to develop strategies for when they don't know a word (paraphrasing, gesture, asking). It builds confidence and reduces the fear of making mistakes. It shows them, and the teacher, where the gaps are. And it's motivating -- it feels like using English rather than studying it.",
  40: CH("Spoken", "Written", "Spoken", "Spoken", "Written", "Spoken", "Spoken", "Written", "Written", "Written", "Written", "Spoken"),
  41: ROWS(2,
    ["through -> threw; court -> caught", "Sound-based spelling: the pairs are pronounced the same, so the learner wrote the version they knew."],
    ["brther, livs, Swedn -- vowels missing", "Possibly a first language (like Arabic) where short vowels aren't written, or general literacy issues -- the learner writes the consonant skeleton."],
    ["The comma after 'However' -- it should be 'However hard I try, it never works'", "Over-applying a rule: they have learnt that 'However' takes a comma, but here it's 'however hard', not the linking word."],
    ["No capital letters, no full stops -- it's all one sentence", "Little awareness of punctuation, maybe from a first language that punctuates differently or from writing the way they speak."]
  ),
  42: P(
    "Forming the letters at all -- holding the pen, direction (left to right, top to bottom), keeping the letters on the line and the same size, telling upper and lower case apart and knowing when to use capitals; then the things that come later: spacing between words, punctuation, joining letters, and the speed to keep up in class.",
    "Tracing and copying letters and then words; matching upper and lower case; copying short sentences from the board with attention to spacing; dictation of single words; labelling pictures; filling in a form with their own details; and lots of reading of the same simple texts so the shapes become familiar."
  ),
  43: SEL("3. Personal aim", "6. Interaction pattern", "1. Lesson aims/learning outcomes", "5. Procedure", "2. Anticipated problems and solutions", "7. Stage aim"),
  44: SEL(
    "f. Developing students' language and skills in a structured way and allowing them to review at home",
    "g. Developing students' listening skills with specially prepared or real materials",
    "b. Developing students' ability to read real texts",
    "e. Finding information on a particular topic area and developing reading skills",
    "i. Showing pre-prepared work on a large screen for clarity",
    "h. Writing down new words for students to focus on, making form, meaning or pronunciation clear",
    "d. Developing students' ability to listen to authentic speech",
    "c. Giving students work which can be tailored to their individual needs",
    "a. Encouraging students to expand their vocabulary and find out about new words on their own"
  ),
  45: ROWS(2,
    ["'Jot down' is a phrasal verb; learners may know 'write' but not 'jot'.", "'Write this down.' -- with the gesture of writing."],
    ["Long, indirect, full of politeness words ('I wonder if you'd mind just...') that hide the instruction.", "'Look at question 4. Answer it.' -- then show which question with the handout."],
    ["Four instructions in one go; by the end nobody remembers the first.", "Give them one at a time: 'Read the text on page 4 and answer questions 1 to 3.' Wait until they finish. Then 'Compare with your partner.' And so on."],
    ["'Think about an answer' is vague -- they don't know whether to write, speak, or how long; 'the bottom of the page' isn't shown.", "Point to the question. 'Read this question. Don't write. Think for one minute. Then tell your partner.'"]
  ),
  46: ROWS(1,
    ["I'd explain that in a group you get far more chances to speak than in a whole-class discussion, that I'll be listening and will pick up the mistakes afterwards, and that noticing another student's mistake is itself good practice. And I'd make sure the groups change so no one feels stuck."],
    ["I'd say that I understand, and that translating helps sometimes, but that if I translate everything they never have to work out meaning in English, which is what they'll need to do outside class. I'd show them how I explain a word instead -- and let them use a dictionary for the rest."],
    ["This one is about people, not English. I would say quietly that in this class everyone works with everyone, and that I'm not going to make exceptions, but I'd also want to understand what's behind it and I'd take care over the pairing rather than forcing a confrontation."],
    ["I'd agree that talking is the most important thing and promise plenty of it -- but explain that the book gives us the language to talk with, and that we'll use it for that, not to read from cover to cover."]
  ),
  47: P(
    "Desks pushed to the sides; the 'assistants' each at a desk or table around the room with a sign for their course, the 'customers' moving between them. Teacher at the back, out of the way, with a notepad, moving round to listen.",
    "Role cards for each customer (who they are, what they need -- price, hours, times), an information sheet per assistant with a different course on each, signs or pictures for the desks, maybe a form the customers fill in so there's a reason to ask, and a laptop or picture to set the scene of an information desk.",
    "Customers crowding one desk and leaving others empty; assistants running out of things to say once they've read out their information; noise; strong students dominating; and knowing when to stop. I'd stagger the customers, give the assistants a follow-up question to ask, and set a time limit with a clear signal."
  ),
  48: ROWS(1,
    ["Two pictures -- an athlete and someone who looks ill -- and ask which is a compliment. Then a thumbs up / thumbs down for each word."],
    ["Just do it: close one eye and say 'wink', close both and say 'blink'. Then get them to do it to each other."],
    ["A timeline and two pictures of me: as a child (used to get up early -- past, not now) and now with an alarm clock and a smile (used to getting up early -- it's normal for me now)."],
    ["Mime: nervous = before an exam, biting nails; upset = crying after bad news. Ask 'Is it before something, or after?'"],
    ["A calendar: today, and a point four weeks back ('ago' -- counting from now); then a point in the past and four weeks before THAT ('before' -- counting from a past moment). Two timelines side by side."],
    ["Say both slowly, then at normal speed, hand on my throat for the /l/ in 'I'll'. Drill in pairs with the two written on the board and students pointing to the one they hear."],
    ["Write both with a timeline: 'read' /riːd/ every day, 'read' /red/ yesterday. Colour code the vowel sound. Minimal-pair drill: 'reed' / 'red'."],
    ["A picture of a golfer for 'putt' and a mime of putting something down for 'put'. Say them, have them listen and hold up 1 or 2."],
    ["Write the two with big dots over the stressed syllable: REcord (a thing -- hold up a vinyl record), reCORD (mime pressing record on a phone). Clap the rhythm."],
    ["Say 'I live in Elmswood' with /ɪ/ and 'live on TV' with /aɪ/ -- picture of a house vs a picture of a concert with 'LIVE' on the poster. Minimal pair listening."]
  ),
  49: P(
    "Reading aloud in turn isn't reading for meaning -- each student is listening for their turn and worrying about pronunciation, not following the text, and the questions at the end were answered by the same few people. Better: give them a reason to read first (a gist question -- 'Is the writer optimistic or pessimistic?'), a time limit, silent reading, then compare answers in pairs; then a second, detailed task with specific questions, again checked in pairs before the class.",
    "An open class discussion 'on the spot' gives the confident students the floor and nothing to the rest; people need something to react to and time to think. Better: give them a stimulus -- five statements about the topic to agree or disagree with -- two minutes alone to note their views, then small groups to discuss and agree a ranking, with a spokesperson reporting back. Everyone speaks, the quiet ones have a script, and I can listen and note language for later."
  ),
  50: "Confidentiality -- what students tell me stays with me and the school; setting standards -- in my own English, my preparation and my punctuality, because I'm asking the same of them; course planning and review -- knowing where the course is going and checking it's getting there; record keeping and assessment -- so that feedback is based on evidence, not impressions; pastoral care -- noticing when a student is struggling with more than the language; team work -- sharing materials and problems with colleagues rather than competing; the relationship with students -- warm but professional; cultural awareness -- of theirs and of my own assumptions; self-development -- observation, reading, this course; following the school's policies, especially on equality and safety; and, later, being part of the profession beyond one school.",
};

// Cambridge's task numbering, by section, for the completeness plan.
const SECTION_TASKS = { 1: [1, 2, 3, 4, 5], 2: range(6, 29), 3: range(30, 42), 4: [43, 44], 5: range(45, 50) };
function range(a, b) { const out = []; for (let n = a; n <= b; n += 1) out.push(n); return out; }

// Who answered what. Seven complete records, three incomplete in different
// ways, the withdrawn candidate barely started -- by name, so the pattern
// survives a reseed and matches the story told elsewhere in the demo
// (Daniel is behind on everything written; Kofi's gap is the pronunciation
// run he never came back to).
const PLAN = {
  "Daniel Kim": [...SECTION_TASKS[1], ...SECTION_TASKS[2]],
  "Tomas Novak": [...SECTION_TASKS[1], ...SECTION_TASKS[2], ...SECTION_TASKS[3]],
  "Leila Haddad": range(1, 50).filter((n) => !(n >= 26 && n <= 29) && n !== 50),
  "Kofi Mensah": range(1, 50).filter((n) => !(n >= 24 && n <= 29)),
  "Marek Kowalski": SECTION_TASKS[1],
};

// A slip or two per candidate, spread so that no task is wrong for everyone
// and no candidate is wrong everywhere.
function withSlips(taskNumber, value, i) {
  if (taskNumber === 10 && i % 4 === 1) return { ...value, 3: { choice: "Lexical" } };
  if (taskNumber === 38 && i % 3 === 0) return { ...value, 4: { choice: "Interactional" } };
  if (taskNumber === 31 && i % 2 === 1) return { ...value, 0: "Intensive/detailed reading" };
  if (taskNumber === 11 && i % 5 === 2) return { ...value, 6: { choice: "Lexical" } };
  if (taskNumber === 40 && i % 4 === 3) return { ...value, 8: { choice: "Spoken" } };
  return value;
}

/**
 * @param ctx.centerId the centre whose task items to answer
 * @param ctx.trainees ordered list of { id, name }
 * @param ctx.answeredAt ISO timestamp for the answers (before the course)
 */
export async function seedPreCourseDemo(supabase, { centerId, trainees, answeredAt }) {
  const { data: sections } = await supabase.from("pre_course_task_sections").select("id").eq("center_id", centerId);
  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: items } = sectionIds.length ? await supabase.from("pre_course_task_items").select("id, task_number").in("section_id", sectionIds) : { data: [] };
  const itemByTask = new Map((items ?? []).filter((it) => it.task_number != null).map((it) => [it.task_number, it.id]));

  const rows = [];
  for (const [i, tr] of trainees.entries()) {
    const voice = VOICES[i % VOICES.length];
    const tasks = PLAN[tr.name] ?? range(1, 50);
    for (const n of tasks) {
      const itemId = itemByTask.get(n);
      if (!itemId) continue;
      const value = voice[n] ?? BANK[n];
      if (value == null) continue;
      const shaped = typeof value !== "string";
      const stored = shaped ? withSlips(n, value, i) : value;
      rows.push({
        trainee_id: tr.id,
        item_id: itemId,
        response: shaped ? JSON.stringify(stored) : stored,
        response_kind: shaped ? "json" : "text",
        updated_at: answeredAt,
      });
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("pre_course_task_responses").upsert(rows, { onConflict: "item_id,trainee_id" });
    if (error) throw error;
  }
  return { answers: rows.length, candidates: trainees.length, tasks: itemByTask.size };
}

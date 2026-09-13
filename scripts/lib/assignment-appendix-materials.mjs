// The appendices the briefs have always asked for.
//
// Ramy, 14 Sep 2026: "backfill them." Every seeded Focus on the Learner and
// Skills assignment was submitted with nothing attached, which is a breach of
// the brief on one and unmarkable on the other:
//
//   Focus on the Learner -- sections D and E say "Attach one task in Appendix
//   1" and "Appendix 2". Syllabus 2.1(d), "selecting appropriate material
//   and/or resources".
//   Skills -- syllabus 2.3 marks "task design in relation to the text", so
//   the text has to be in the pack.
//
// Each set matches the VARIANT the candidate actually wrote about
// (assignment-submissions.mjs, `candidateIndex % 2`), so the worksheet in the
// appendix is the worksheet the essay describes. LRT and LfC need none.

// --- Focus on the Learner, variant 0: past simple + the interdentals -------

const FOL_PAST = [
  {
    label: "Appendix 1",
    fileName: "appendix-1-running-dictation-past-simple.pdf",
    title: "Running dictation: past simple questions",
    subtitle: "Pre-intermediate (B1) · pairs · 12 minutes · adapted from Ur (2009, p. 141)",
    blocks: [
      { kind: "h", text: "Before the lesson" },
      { kind: "p", text: "Print one set per four pairs and cut along the lines. Tape the eight strips around the walls of the room, spread out, at reading height. Each strip carries one scrambled question. Nothing on the strips is in the right order." },
      { kind: "h", text: "The strips — cut here" },
      { kind: "li", text: "did / where / you / go / at the weekend / ?" },
      { kind: "li", text: "you / did / what / have / for breakfast / ?" },
      { kind: "li", text: "did / who / you / see / on Friday / ?" },
      { kind: "li", text: "get / what time / you / did / home / ?" },
      { kind: "li", text: "didn't / why / come / you / to class / on Tuesday / ?" },
      { kind: "li", text: "you / did / enjoy / it / ?" },
      { kind: "li", text: "your phone / where / you / did / leave / ?" },
      { kind: "li", text: "did / how / you / travel / there / ?" },
      { kind: "h", text: "How it runs" },
      { kind: "p", text: "In pairs. One learner runs to a strip, reads it, comes back and dictates it from memory. The other writes it down, then together they put it in the right order and write the correct question. Swap roles after four strips. The runner may not write; the writer may not leave the desk." },
      { kind: "p", text: "Time limit: eight minutes for all eight. The limit is the point — the form has to be produced quickly rather than deliberated over." },
      { kind: "h", text: "Final stage — use, not manipulation" },
      { kind: "p", text: "Pairs join into fours and ask each other the eight questions for real. Answers must be true. This is where the questions stop being an exercise." },
      { kind: "h", text: "Answer key" },
      { kind: "li", text: "Where did you go at the weekend?" },
      { kind: "li", text: "What did you have for breakfast?" },
      { kind: "li", text: "Who did you see on Friday?" },
      { kind: "li", text: "What time did you get home?" },
      { kind: "li", text: "Why didn't you come to class on Tuesday?" },
      { kind: "li", text: "Did you enjoy it?" },
      { kind: "li", text: "Where did you leave your phone?" },
      { kind: "li", text: "How did you travel there?" },
      { kind: "note", text: "Correction: nothing is corrected during the running stage. Errors go in the notebook and onto the board afterwards, as a delayed slot — a learner who will not risk being wrong in open class will stop running if errors are picked up publicly in the moment." },
    ],
  },
  {
    label: "Appendix 2",
    fileName: "appendix-2-minimal-pairs-th.pdf",
    title: "Minimal pairs: /θ/ and /ð/",
    subtitle: "Discrimination, then production, then personalisation · 15 minutes · after Kelly (2000, p. 49)",
    blocks: [
      { kind: "h", text: "Stage 1 — Listen and choose (cards A / B)" },
      { kind: "p", text: "Learners hold up an A card or a B card. Read one word from each pair, in random order, twice through the list." },
      { kind: "li", text: "A think      B tink" },
      { kind: "li", text: "A three      B tree" },
      { kind: "li", text: "A thin       B tin" },
      { kind: "li", text: "A they       B day" },
      { kind: "li", text: "A there      B dare" },
      { kind: "li", text: "A breathe    B breed" },
      { kind: "li", text: "A worthy     B wordy" },
      { kind: "li", text: "A thought    B taught" },
      { kind: "h", text: "Stage 2 — Look, then say (mirrors)" },
      { kind: "p", text: "Hand out one small mirror per pair. The articulation is visible: the tongue tip goes lightly between the teeth and the air is pushed through. /θ/ is voiceless — no buzz at the throat. /ð/ is the same position, voiced — a hand on the throat feels it." },
      { kind: "p", text: "This is the stage that matters most for a learner whose first language has neither sound. Seeing the tongue is more useful than hearing the difference, because the difference is not yet audible to them." },
      { kind: "p", text: "Drill down the A column, then contrast A/B in pairs: think–tink, three–tree, they–day." },
      { kind: "h", text: "Stage 3 — Say something true" },
      { kind: "p", text: "Each learner writes one true sentence containing at least two target sounds, then says it to their partner, who checks with the mirror. Prompts on the board if needed:" },
      { kind: "li", text: "I think this is the third …" },
      { kind: "li", text: "There are three things I …" },
      { kind: "li", text: "My brother thinks that …" },
      { kind: "li", text: "I'd rather have this than that." },
      { kind: "note", text: "Pair-based throughout, and nobody is required to produce the sound in front of the whole group. That condition is deliberate: it is the condition this learner performs worst under." },
    ],
  },
];

// --- Focus on the Learner, variant 1: present perfect + weak 'have' --------

const FOL_PRESENT_PERFECT = [
  {
    label: "Appendix 1",
    fileName: "appendix-1-find-someone-who-has.pdf",
    title: "Find someone who has… (with the follow-up)",
    subtitle: "Mingle · 15 minutes · adapted from Scrivener (2010, p. 172), second stage added",
    blocks: [
      { kind: "h", text: "The grid" },
      { kind: "p", text: "One copy each. Learners mingle and ask “Have you ever…?”. When someone says yes, write their name — then you must ask TWO past simple follow-up questions and write short answers. A name without the follow-up does not count." },
      { kind: "li", text: "…been to a country where you didn't speak the language.   Name: ______  When?  ______  Who with?  ______" },
      { kind: "li", text: "…eaten something you couldn't identify.   Name: ______  When?  ______  What was it?  ______" },
      { kind: "li", text: "…missed a flight or a train.   Name: ______  When?  ______  What happened next?  ______" },
      { kind: "li", text: "…met someone famous.   Name: ______  When?  ______  Where?  ______" },
      { kind: "li", text: "…forgotten someone's name to their face.   Name: ______  When?  ______  What did you say?  ______" },
      { kind: "li", text: "…learned to play an instrument.   Name: ______  When?  ______  How long for?  ______" },
      { kind: "li", text: "…broken a bone.   Name: ______  When?  ______  How?  ______" },
      { kind: "li", text: "…stayed awake all night.   Name: ______  When?  ______  Why?  ______" },
      { kind: "h", text: "Why the follow-up is the task" },
      { kind: "p", text: "The mingle alone practises one form. The follow-up forces the switch from unfinished to finished time inside the same conversation — “Have you ever been?” then “When did you go?” — which is exactly where the boundary lives, and exactly where it collapses." },
      { kind: "h", text: "Feedback — board this afterwards" },
      { kind: "p", text: "Two lines, side by side, with a timeline under each:" },
      { kind: "li", text: "Have you ever been to Spain?   →  experience, no time said, time still open" },
      { kind: "li", text: "When did you go?   →  a finished time, now specified" },
      { kind: "note", text: "Draw the boundary explicitly at this point. A learner who wants the rule stated will not feel secure until it is, and there is no reason to withhold it after the experience has already happened." },
    ],
  },
  {
    label: "Appendix 2",
    fileName: "appendix-2-weak-forms-have.pdf",
    title: "Weak forms of “have”: listen and count",
    subtitle: "Recognition before production · 15 minutes · after Underhill (2005, p. 61)",
    blocks: [
      { kind: "h", text: "Stage 1 — How many words?" },
      { kind: "p", text: "Learners hear each exchange twice at natural speed and write only the NUMBER of words they hear. No writing of words. Read at normal conversational pace — reading it slowly destroys the task." },
      { kind: "li", text: "1.  A: Have you ever been to Spain?   B: Yes, I have.                     (7 / 3)" },
      { kind: "li", text: "2.  A: What have you done today?      B: Not much.                        (5 / 2)" },
      { kind: "li", text: "3.  A: Where have they gone?          B: They've gone home.               (4 / 3)" },
      { kind: "li", text: "4.  A: Has she finished?              B: She has, yes.                    (3 / 3)" },
      { kind: "li", text: "5.  A: I've never seen it.            B: Haven't you?                     (5 / 2)" },
      { kind: "li", text: "6.  A: We've been here before.        B: Have we?                         (5 / 2)" },
      { kind: "h", text: "Stage 2 — Now look" },
      { kind: "p", text: "Hand out the transcript above. Learners listen again and mark every place where “have” is weakened or contracted. The gap between the number they wrote and the number on the page is the whole lesson." },
      { kind: "h", text: "What is happening" },
      { kind: "li", text: "Have you…?  →  /həv juː/ or /əv jə/ — never /hæv/ in the question." },
      { kind: "li", text: "…I have.  →  /hæv/ STRONG, because it is final and stressed. Same word, opposite treatment." },
      { kind: "li", text: "They've / I've / We've  →  /ðeɪv/, /aɪv/, /wiːv/ — one syllable, no vowel of its own." },
      { kind: "h", text: "Stage 3 — Backchain and say it" },
      { kind: "p", text: "Drill from the end of the phrase backwards: “to Spain” → “been to Spain” → “ever been to Spain” → “Have you ever been to Spain?”. Backchaining keeps the final stress right, which is what fixes the contour." },
      { kind: "p", text: "Then pairs run all six exchanges, swapping roles." },
      { kind: "note", text: "Recognition is the point, not performance. Drilling alone would make the learner sound better without making recordings any easier to follow — and following recordings is the stated need." },
    ],
  },
];

// --- Skills, variant 0: the reading -----------------------------------------

const SKILLS_READING = [
  {
    label: "Appendix 1",
    fileName: "appendix-1-four-cities-text-and-tasks.pdf",
    title: "Four cities that got rid of their cars",
    subtitle: "The text and the three tasks · Roadmap B1+, Unit 6 “Getting around” · 320 words",
    blocks: [
      { kind: "h", text: "The text" },
      { kind: "p", text: "Ten years ago, the centre of Pontevedra in northern Spain looked like most European towns: two lanes of traffic, cars parked on both sides, and pavements too narrow for two people to pass. Today almost none of that is left. The mayor pedestrianised the old town in 1999, removed surface parking, and set a 30 km/h limit everywhere else. Congestion fell by more than ninety per cent. Nobody has died in a traffic accident in the centre since 2009." },
      { kind: "p", text: "Ljubljana did something similar in 2007, closing its riverside to cars over a single weekend. Shopkeepers protested loudly beforehand; a year later, footfall had risen and most of them had stopped complaining. The city added a free electric shuttle for anyone who could not walk the distance, which turned out to matter more than any of the planning documents had predicted." },
      { kind: "p", text: "Oslo took a slower route. Rather than banning cars outright, it phased out parking spaces, replacing more than seven hundred of them with cycle lanes, benches and small parks. Drivers were never told they could not come in; they simply found there was nowhere to stop. City officials call this “removing the reason to drive” rather than removing the right." },
      { kind: "p", text: "Ghent redrew its map in 2017. The centre was divided into six zones, and while you can drive within a zone, you cannot drive between them without going back out to the ring road. A journey that used to cut across town now takes twenty minutes by car and eight by bicycle. Cycling rose by a quarter in the first year alone." },
      { kind: "p", text: "None of these cities is large, and none of them managed it without a fight. But between them they suggest the same conclusion: traffic is not a fixed quantity that has to go somewhere. Take away the road space, and a surprising amount of it simply disappears." },
      { kind: "h", text: "Task 1 — Before you read (pairs, 2 minutes)" },
      { kind: "p", text: "Look at the headline and the four photographs. Which cities do you think are in the article? What do you think “got rid of” means here? Which of these places would you like to live in, and why?" },
      { kind: "h", text: "Task 2 — Read for gist (2 minutes, alone)" },
      { kind: "p", text: "Match each city to the summary that fits it best. There is one summary you will not need." },
      { kind: "li", text: "Pontevedra  ·  Ljubljana  ·  Oslo  ·  Ghent" },
      { kind: "li", text: "a) Divided the centre into zones you cannot drive between." },
      { kind: "li", text: "b) Took away parking spaces instead of banning cars." },
      { kind: "li", text: "c) Closed a riverside road in a single weekend." },
      { kind: "li", text: "d) Made the old town car-free and cut congestion dramatically." },
      { kind: "li", text: "e) Built an underground road beneath the city centre." },
      { kind: "note", text: "The summaries share no vocabulary with the text, so the task cannot be done by word-matching. Two minutes for 320 words is what makes it gist and not a careful read." },
      { kind: "h", text: "Task 3 — Read for detail (6 minutes, alone, then compare)" },
      { kind: "p", text: "True or false? Correct the false ones." },
      { kind: "li", text: "1. Pontevedra pedestrianised its old town in 2009." },
      { kind: "li", text: "2. Shopkeepers in Ljubljana supported the change from the start." },
      { kind: "li", text: "3. Ljubljana's electric shuttle is free to use." },
      { kind: "li", text: "4. Oslo banned cars from the city centre." },
      { kind: "li", text: "5. A cross-town journey in Ghent is now faster by bicycle than by car." },
      { kind: "li", text: "6. All four cities are large capitals." },
      { kind: "h", text: "Extension — on the board for early finishers" },
      { kind: "p", text: "Find two things the writer does not tell us." },
      { kind: "h", text: "Answer key" },
      { kind: "li", text: "Task 2: Pontevedra d · Ljubljana c · Oslo b · Ghent a  (e is the distractor)" },
      { kind: "li", text: "Task 3: 1 F — 1999. 2 F — they protested loudly beforehand. 3 T. 4 F — it phased out parking; drivers were never told they could not come in. 5 T — eight minutes against twenty. 6 F — “none of these cities is large”." },
    ],
  },
];

// --- Skills, variant 1: the listening ---------------------------------------

const SKILLS_LISTENING = [
  {
    label: "Appendix 1",
    fileName: "appendix-1-money-transcript-and-tasks.pdf",
    title: "“Who taught you about money?” — transcript and tasks",
    subtitle: "Speakout B1+, Unit 8 “Money” · 2 minutes 40 · three speakers",
    blocks: [
      { kind: "note", text: "The recording itself is the coursebook's. The transcript is reproduced here because the task design below cannot be judged without it — where the figures fall, where the irony sits, and which lines carry the connected speech the third hearing focuses on." },
      { kind: "h", text: "Transcript" },
      { kind: "p", text: "PRESENTER: We asked three people the same question — who taught you about money, and was the lesson any good?" },
      { kind: "p", text: "SPEAKER 1 (Ravi): Nobody taught me, that's the honest answer. My parents never talked about it — it wasn't rude exactly, it just never came up. So I learned the way most people do, which is badly. I got a credit card at nineteen and I had about two thousand pounds of debt by the time I was twenty-one. Two thousand. And I couldn't have told you what the interest rate was. I do now. I budget, I know exactly what goes out every month. But I learned it by getting it wrong first." },
      { kind: "p", text: "SPEAKER 2 (Brigid): My grandmother, and she was relentless about it. Every birthday from when I was about seven I'd get a little bit of money and she'd say, right, half of that goes in the tin. Half. Every time. And I hated it, obviously — you're seven, you want the whole thing. But I've never in my life spent money I didn't have, and that's her. That's entirely her. I still put half of anything unexpected straight into savings. It's automatic now." },
      { kind: "p", text: "SPEAKER 3 (Tom): Oh, I was brilliant with money. Absolutely brilliant. [laughs] No — I was twenty-eight and I splashed out on a car I genuinely could not afford, and it broke down eleven days later. Eleven days. And that was the lesson, really. Nobody sat me down. The car sat me down. I'm careful now, but it cost me about four thousand pounds to find out." },
      { kind: "h", text: "Task 1 — Lead-in (pairs, 3 minutes)" },
      { kind: "p", text: "Did anyone teach you about money? Who? Was it good advice?" },
      { kind: "h", text: "Task 2 — Listen for gist (one hearing)" },
      { kind: "p", text: "Match each speaker to a statement. There is one statement you will not need." },
      { kind: "li", text: "a) Learned from one person, consistently, over years." },
      { kind: "li", text: "b) Learned from a single expensive mistake." },
      { kind: "li", text: "c) Was taught carefully but ignored the advice." },
      { kind: "li", text: "d) Was taught nothing and worked it out afterwards." },
      { kind: "li", text: "e) Still has no system and says so." },
      { kind: "h", text: "Task 3 — Listen for detail (questions read first; two hearings)" },
      { kind: "li", text: "1. How old was Ravi when he got a credit card?" },
      { kind: "li", text: "2. How much debt did he have, and by what age?" },
      { kind: "li", text: "3. What fraction did Brigid's grandmother make her save?" },
      { kind: "li", text: "4. How old was Brigid when this started?" },
      { kind: "li", text: "5. How many days did Tom's car last?" },
      { kind: "li", text: "6. What did the mistake cost him?" },
      { kind: "note", text: "Questions 1, 2, 4, 5 and 6 all turn on a number. Run a ninety-second numbers dictation before this task — thirteen/thirty is the error that loses the answer, not the listening." },
      { kind: "h", text: "Task 4 — Connected speech (one more hearing, 4 minutes)" },
      { kind: "p", text: "Listen to these three lines only and mark what you hear weakened, elided or run together." },
      { kind: "li", text: "“I couldn't have told you what the interest rate was.”   →  couldn't've /ˈkʊdəntəv/" },
      { kind: "li", text: "“I've never in my life spent money I didn't have.”   →  didn't have /ˈdɪdənt hæv/, final have STRONG" },
      { kind: "li", text: "“I was twenty-eight and I splashed out on a car…”   →  splash(ed) out on a /ˈsplæʃt aʊtnə/" },
      { kind: "h", text: "Task 5 — Inference (after the detail work, not before)" },
      { kind: "p", text: "Speaker 3 begins “I was brilliant with money. Absolutely brilliant.” Is he proud or embarrassed? How do you know? Play his first ten seconds again in isolation, so intonation is the only thing left to listen to." },
      { kind: "h", text: "Task 6 — Post-task (groups of three)" },
      { kind: "p", text: "Which speaker are you most like?" },
      { kind: "h", text: "Answer key" },
      { kind: "li", text: "Task 2: Ravi d · Brigid a · Tom b  (c is the distractor)" },
      { kind: "li", text: "Task 3: 1 nineteen. 2 about £2,000, by twenty-one. 3 half. 4 about seven. 5 eleven. 6 about £4,000." },
      { kind: "li", text: "Task 5: embarrassed — he is being ironic about his younger self, carried entirely by intonation and the laugh." },
    ],
  },
];

/**
 * The appendices one candidate attached, matching the submission variant they
 * actually wrote. Returns [] for an assignment whose brief asks for none.
 */
export function appendicesFor(assignmentType, candidateIndex) {
  const variant = candidateIndex % 2;
  if (assignmentType === "Focus on Learner") return variant === 0 ? FOL_PAST : FOL_PRESENT_PERFECT;
  if (assignmentType === "Skills") return variant === 0 ? SKILLS_READING : SKILLS_LISTENING;
  return [];
}

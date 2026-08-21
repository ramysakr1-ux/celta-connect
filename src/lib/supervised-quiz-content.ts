// specs/handoffs/Supervised Review Quiz.dc.html -- transcribed verbatim
// (notes and questions are the handoff's own finished copy, not written
// here). Three topics, each with recap notes shown before the quiz and
// 10-15 auto-scored multiple-choice questions.

export type QuizTopicKey = "language" | "phonology" | "classroom";

export interface QuizNote {
  h: string;
  b: string;
}

export interface QuizQuestion {
  text: string;
  opts: string[];
  correct: number;
}

export interface QuizTopic {
  key: QuizTopicKey;
  title: string;
  covers: string;
  /** Tailwind border-color class for the topic card's left spine. */
  spineClass: string;
  notes: QuizNote[];
  questions: QuizQuestion[];
}

export const QUIZ_SECONDS = 12 * 60;

export const SUPERVISED_QUIZ_TOPICS: Record<QuizTopicKey, QuizTopic> = {
  language: {
    key: "language",
    title: "Language sessions",
    covers: "Vocab, listening, CCQs, PPP, text-based teaching, language analysis, guided discovery, MFP",
    spineClass: "border-l-primary",
    notes: [
      { h: "MFP order", b: "Meaning is established before form, form before pronunciation — students need to know what something means before drilling how it sounds or looks." },
      { h: "CCQs", b: "Concept-checking questions confirm meaning without translation or definition — short, closed, answerable from context." },
      { h: "PPP vs Test-Teach-Test", b: "PPP presents language before students use it; TTT tests first, then teaches only the gaps the test revealed." },
      { h: "Text-based teaching", b: "Language emerges from a text the students read first, rather than being pre-selected and presented." },
      { h: "Guided discovery", b: "Students arrive at the rule themselves, through examples and questions — the teacher elicits, doesn't explain." },
      { h: "Listening and vocab staging", b: "Pre-teach only what blocks the task; gist before detail; concept-check new vocab the same way as grammar." },
    ],
    questions: [
      { text: "In MFP, which comes first?", opts: ["Form", "Meaning", "Pronunciation", "Drilling"], correct: 1 },
      { text: "A good CCQ is best described as:", opts: ["A grammar explanation", "A translation request", "An open discussion prompt", "A short, closed question answerable from context"], correct: 3 },
      { text: "Test-Teach-Test differs from PPP because it:", opts: ["Tests first, then teaches only the gaps found", "Presents the rule before any task", "Never uses a second test", "Skips practice entirely"], correct: 0 },
      { text: "In text-based teaching, target language is:", opts: ["Found by highlighting it in a text students already read", "Chosen before the lesson and presented directly", "Never explicitly focused on", "Only practised, never clarified"], correct: 0 },
      { text: "Guided discovery means the teacher:", opts: ["Elicits the rule from students via examples and questions", "Explains the rule clearly first", "Skips clarification entirely", "Only drills pronunciation"], correct: 0 },
      { text: "Pre-teaching vocabulary before a reading text should:", opts: ["Cover every unfamiliar word", "Happen after the gist read", "Only cover words that block the task", "Be avoided entirely"], correct: 2 },
      { text: "A staged listening lesson typically moves from:", opts: ["Detail to gist", "Freer to controlled practice", "Form to meaning", "Gist to detail"], correct: 3 },
      { text: "Highlighting, in text-based teaching, happens:", opts: ["Only in PPP lessons", "Before reading the text", "Instead of a language focus stage", "After the detail check, before clarification"], correct: 3 },
      { text: "A meaning gap revealed by a first test is best closed by:", opts: ["Skipping straight to freer practice", "A long grammar lecture", "Ignoring it if only a few students had it", "CCQs and eliciting from students"], correct: 3 },
      { text: "In PPP, the main risk trainers are warned about is:", opts: ["Overusing guided discovery", "Skipping presentation", "Presenting too long, leaving too little time to practise", "Too much practice time"], correct: 2 },
      { text: "A trainee's CCQ for \"used to\" (past habit) is \"Do you still do this?\" — the class answers correctly but a stronger CCQ would:", opts: ["Also confirm the habit was repeated, not a one-off", "Be skipped since the class answered correctly", "Ask the same question in a different tense", "Translate the sentence instead"], correct: 0 },
      { text: "A trainee runs Test-Teach-Test but the first \"test\" task is too easy, so nearly every student gets it right. This mainly fails to:", opts: ["Introduce new vocabulary", "Provide a controlled context", "Reveal genuine gaps worth teaching", "Give students any practice at all"], correct: 2 },
      { text: "In a text-based lesson, a trainee explains target grammar before students read the text. This most closely turns the lesson into:", opts: ["A guided discovery lesson", "A Test-Teach-Test lesson", "A standard PPP lesson wearing a text-based label", "A pure fluency lesson"], correct: 2 },
      { text: "During guided discovery, a student proposes a rule that is close but not quite accurate. The best next step is usually to:", opts: ["Give a further example that tests their rule and let them refine it", "Tell them they are wrong and give the rule", "Ask a different student for the rule instead", "Move on regardless, to save time"], correct: 0 },
      { text: "A trainee pre-teaches six new words before a gist listening task. The most likely problem this causes is:", opts: ["Gist tasks never need pre-teaching", "The pre-teach stage overloads memory and eats into listening time", "Six words is too few to pre-teach", "Students will find the gist task too easy"], correct: 1 },
    ],
  },
  phonology: {
    key: "phonology",
    title: "Phonology",
    covers: "Connected speech, stress and intonation, phonemic script, sentence stress",
    spineClass: "border-l-border",
    notes: [
      { h: "Connected speech", b: "Sounds link, elide, or blend across word boundaries in natural speech — linking, elision, assimilation." },
      { h: "Word stress", b: "One syllable in a multi-syllable word carries the primary stress; mismarking it is a common, high-impact error." },
      { h: "Sentence stress", b: "Content words carry stress; function words are usually unstressed — this creates English's natural rhythm." },
      { h: "Intonation", b: "Rising and falling pitch signal meaning — question type, certainty, finished vs unfinished thought." },
      { h: "Marking on the board", b: "Stress marked with a dot or underline above the stressed syllable; sentence stress often marked in bold or underline." },
    ],
    questions: [
      { text: "Connected speech features include:", opts: ["Word stress alone", "Linking, elision, assimilation", "Intonation alone", "Only linking"], correct: 1 },
      { text: "In sentence stress, which words are typically stressed?", opts: ["Content words", "Every word equally", "Only the first word", "Function words"], correct: 0 },
      { text: "Word stress is usually marked on the board with:", opts: ["Capital letters throughout", "A full underline of the word", "A dot or mark above the stressed syllable", "Bold on the whole word"], correct: 2 },
      { text: "Rising intonation is most associated with:", opts: ["Commands", "Statements of fact", "Yes/no questions or unfinished lists", "Nothing in particular"], correct: 2 },
      { text: "Elision refers to:", opts: ["Stressing every syllable equally", "Changing word order", "Adding an extra sound between words", "Dropping a sound at a word boundary"], correct: 3 },
      { text: "Assimilation is when:", opts: ["Two words merge into one meaning", "Intonation flattens entirely", "Stress moves to the last syllable", "A sound changes to become more like a neighbouring sound"], correct: 3 },
      { text: "A common candidate error in marking sentence stress is:", opts: ["Marking function words as stressed instead of content words", "Stressing every word equally", "Marking word stress instead", "Marking too few words"], correct: 0 },
      { text: "Falling intonation typically signals:", opts: ["Uncertainty", "Nothing meaningful", "Completion or certainty", "A question"], correct: 2 },
      { text: "Drilling pronunciation should usually happen:", opts: ["Instead of clarifying meaning", "Before meaning is established", "Only at the end of the course", "After meaning and form are clear"], correct: 3 },
      { text: "Choral drilling before individual drilling helps because it:", opts: ["Replaces the need for individual drilling", "Builds confidence before individual production", "Is only used for advanced students", "Embarrasses weaker students"], correct: 1 },
      { text: "A trainee marks stress on \"photograph\", \"photographer\" and \"photographic\" with the same syllable stressed in each. The likely error is:", opts: ["Missing that stress shifts across related forms with different endings", "Confusing stress with intonation", "Marking word stress instead of sentence stress", "None — stress is fixed for a word family"], correct: 0 },
      { text: "\"Would you like a cup of tea?\" is naturally reduced in fast speech to something closer to \"Wouldja like a cuppa tea?\" This is mainly an example of:", opts: ["Linking and elision together", "Word stress shift", "Rising intonation", "Assimilation only"], correct: 0 },
      { text: "A trainee drills a full sentence chorally at natural speed, but several weaker students mumble through it inaudibly. The better move is usually to:", opts: ["Back-chain the sentence in smaller chunks before returning to the whole", "Switch straight to individual drilling with the strongest student first", "Abandon drilling and re-teach the meaning instead", "Move on — choral drilling doesn't need individual checking"], correct: 0 },
      { text: "In \"I can't believe it!\" said with a sharp fall-rise, the intonation is most likely signalling:", opts: ["A polite request", "A neutral, unfinished statement", "Boredom", "Genuine surprise or disbelief"], correct: 3 },
      { text: "A trainee's phonemic script for \"though\" is written as though it rhymes with \"cough\". The best diagnosis is:", opts: ["A correct transcription", "An intonation error", "A stress-marking error", "Confusing spelling with pronunciation — the vowel sounds are different"], correct: 3 },
    ],
  },
  classroom: {
    key: "classroom",
    title: "Classroom management",
    covers: "Monitoring, ICQs, giving instructions, timing, plus a few online/Zoom essentials",
    spineClass: "border-l-destructive",
    notes: [
      { h: "Monitoring", b: "Circulate without interrupting; note errors for delayed feedback rather than correcting mid-task unless it blocks communication." },
      { h: "ICQs", b: "Instruction-checking questions confirm students understood the task itself, not the language — asked after clear, concise instructions." },
      { h: "Giving instructions", b: "Short, staged, demonstrated where possible — avoid instructions buried in explanation." },
      { h: "Online monitoring", b: "Breakout rooms remove visibility — trainers can't see body language, so checking in requires dropping into rooms briefly and clear timing cues." },
      { h: "Timing and transitions", b: "Signal time remaining before it runs out; have a clear signal for stopping an activity." },
    ],
    questions: [
      { text: "ICQs are used to check:", opts: ["Grammar rules", "Pronunciation accuracy", "Understanding of the task itself", "Understanding of new vocabulary"], correct: 2 },
      { text: "During monitoring, a teacher should generally:", opts: ["Correct every error immediately", "Circulate quietly and note errors for later feedback", "Stand at the front the whole time", "Avoid listening to pairs at all"], correct: 1 },
      { text: "Good instructions are best described as:", opts: ["Short, staged, and demonstrated", "Given only once, however complex", "Written only, never spoken", "Long and thorough"], correct: 0 },
      { text: "A key challenge of monitoring in breakout rooms is:", opts: ["Nothing changes from a physical classroom", "Too much visibility into every pair", "Students talk too little online", "Losing visibility into body language and pace"], correct: 3 },
      { text: "Signalling time remaining during an activity helps because it:", opts: ["Replaces the need for clear instructions", "Is unnecessary if the task is short", "Gives students a chance to wrap up naturally", "Rushes students unnecessarily"], correct: 2 },
      { text: "If an error blocks communication entirely, a teacher should usually:", opts: ["Ignore it until feedback", "Stop the whole class", "Mark it as a serious failure", "Intervene briefly to unblock it"], correct: 3 },
      { text: "ICQs should be asked:", opts: ["Instead of giving instructions", "After giving clear, concise instructions", "Before giving any instructions", "Only for advanced classes"], correct: 1 },
      { text: "A clear stop signal for an activity is important because it:", opts: ["Prevents confusion about when to finish", "Only matters in online lessons", "Replaces timing cues", "Is optional if students are enjoying the task"], correct: 0 },
      { text: "In an online lesson, checking in on breakout rooms should be:", opts: ["Avoided entirely to respect privacy", "Done only at the very end", "Constant, staying in every room throughout", "Brief, so as not to disrupt the pace of the room"], correct: 3 },
      { text: "Demonstrating a task (not just explaining it) helps because it:", opts: ["Replaces the need for ICQs", "Wastes time better spent talking", "Is only useful for lower levels", "Makes the task concrete without relying on language alone"], correct: 3 },
      { text: "A trainee gives instructions, asks \"Does everyone understand?\", gets nods, then half the class does the task wrong. What most likely failed?", opts: ["The check was a comprehension check, not a real ICQ tied to the task", "The task itself was too hard", "The students weren't listening at all", "Instructions are unnecessary if demonstrated"], correct: 0 },
      { text: "A trainee monitors by standing at the front and scanning the room without approaching any pair. The main risk is:", opts: ["Errors and confusion at pair level go unnoticed", "Timing becomes too generous", "The teacher talks too much", "Students feel over-supervised"], correct: 0 },
      { text: "Ten minutes into a 15-minute breakout activity, a trainee has not visited any room. The most likely consequence is:", opts: ["Off-task talk or stuck pairs go undetected until it's too late to redirect", "The activity will simply run short, which is fine", "Students will automatically ask for help via chat", "Nothing — breakout rooms are self-managing"], correct: 0 },
      { text: "A trainee says \"Right, so, before we move on, in a moment I want you to, once you've read it, discuss the questions\" as their instruction. The core problem is:", opts: ["The task itself is unclear", "It needs an ICQ instead of being reworded", "It should have been written, not spoken", "The instruction is buried in explanation rather than staged and simple"], correct: 3 },
      { text: "An activity is scheduled for 8 minutes but a trainee gives no time warnings and abruptly says \"stop\" with several pairs mid-sentence. The main fix is:", opts: ["Always stop activities early to be safe", "Avoid setting time limits at all", "Give a time-remaining cue before the end so students can wrap up", "Extend every activity by a few minutes as standard"], correct: 2 },
    ],
  },
};

export const SUPERVISED_QUIZ_TOPIC_LIST = Object.values(SUPERVISED_QUIZ_TOPICS);

export function scoreSupervisedQuiz(topic: QuizTopicKey, answers: (number | null)[]): { score: number; questionCount: number } {
  const questions = SUPERVISED_QUIZ_TOPICS[topic].questions;
  const score = questions.reduce((sum, q, i) => (answers[i] === q.correct ? sum + 1 : sum), 0);
  return { score, questionCount: questions.length };
}

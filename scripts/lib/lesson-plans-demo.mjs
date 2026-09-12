// Real lesson plans for the seeded teaching practice.
//
// Ramy, 12 Sep 2026, opening Amara's TP7: a submitted plan with one empty
// "Lead-in" row and "0 of 45 min" under it. Every seeded plan was aims-only --
// `procedure` and `anticipated_problems` were empty arrays, `personal_aims`
// null -- so the one screen a candidate spends most of their week on demoed
// as a blank table. The plan's own main aim also disagreed with the brief in
// the page heading (plan_assignments.main_lesson_aim), because the two were
// written from different lists.
//
// This builds a plan from the brief the candidate was actually given: the
// framework follows the aim type, the stages come from that framework
// (LESSON_FRAMEWORKS in src/lib/tp-plan-content.ts, so the table matches what
// the form's "Choose a framework" button produces), the procedure text is
// written around the lesson's own topic, and the times add up to the 45
// minutes the form checks against.
//
// Personal aims come from the previous lesson's action points, which is what
// the form asks for: "Take these from the action points in your last feedback."

const LESSON_MINUTES = 45;

/** Framework stage lists, mirroring src/lib/tp-plan-content.ts. */
const FRAMEWORKS = {
  ppp: {
    name: "Present – Practice – Produce (PPP)",
    stages: ["Lead-in", "Present: clarify and focus on TL", "Practice", "Production", "Error correction"],
    times: [5, 12, 10, 13, 5],
  },
  ttt: {
    name: "Test – Teach – Test",
    stages: ["Lead-in", "First test (diagnostic)", "Teach (clarifying)", "Second test (controlled practice)", "Freer practice", "Feedback"],
    times: [4, 7, 12, 8, 9, 5],
  },
  textbased: {
    name: "Text-Based Presentation of Language",
    stages: ["Lead-in / building context", "Reading or listening task", "Highlighting target language", "Clarifying target language", "Language practice", "Feedback"],
    times: [5, 8, 5, 12, 10, 5],
  },
  receptive: {
    name: "Receptive Skills (reading or listening)",
    stages: ["Lead-in", "Pre-teach vocabulary", "Reading / listening for gist", "Reading / listening for detail", "Post-reading / listening task"],
    times: [5, 8, 7, 13, 12],
  },
  productive: {
    name: "Productive Skills (speaking or writing)",
    stages: ["Lead-in", "Preparing to write / speak", "Useful language", "Speaking / writing task", "Feedback and error correction"],
    times: [5, 9, 8, 15, 8],
  },
};

/** "Grammar: present simple for daily routines" -> { type, topic }. */
export function readAim(aim) {
  const full = String(aim ?? "").trim();
  const m = full.match(/^([^:]+):\s*(.+)$/);
  if (m) {
    const head = m[1].toLowerCase();
    const topic = m[2].replace(/\.$/, "");
    if (head.startsWith("grammar")) return { type: "grammar", topic };
    if (head.startsWith("vocabulary") || head.startsWith("lexis")) return { type: "vocabulary", topic };
    if (head.startsWith("functional")) return { type: "function", topic };
    if (head.startsWith("reading")) return { type: "reading", topic, skill: head.includes("detail") ? "detail" : "gist" };
    if (head.startsWith("listening")) return { type: "listening", topic, skill: head.includes("detail") ? "detail" : "gist" };
    if (head.startsWith("speaking")) return { type: "speaking", topic };
    if (head.startsWith("writing")) return { type: "writing", topic };
  }
  // TP7/TP8 carry a full "By the end of the lesson..." aim instead.
  const lower = full.toLowerCase();
  const context = full.match(/in the context of ([^.]+)/i)?.[1]?.trim();
  if (/reading/.test(lower)) return { type: "reading", topic: context ?? "the text", skill: /specific|detail/.test(lower) ? "detail" : "gist" };
  if (/listening/.test(lower)) return { type: "listening", topic: context ?? "the recording", skill: "detail" };
  if (/advice|suggest|apolog|arrange|invit/.test(lower)) return { type: "function", topic: context ?? full };
  if (/speak|discuss/.test(lower)) return { type: "speaking", topic: context ?? full };
  return { type: "grammar", topic: context ?? full };
}

const FRAMEWORK_FOR = {
  grammar: (tp) => (tp % 3 === 0 ? "textbased" : "ppp"),
  vocabulary: (tp) => (tp % 2 === 0 ? "ttt" : "ppp"),
  function: () => "ttt",
  reading: () => "receptive",
  listening: () => "receptive",
  speaking: () => "productive",
  writing: () => "productive",
};

/** What the learners and the teacher are actually doing, stage by stage. */
function procedureText(stage, aim, level) {
  const t = aim.topic;
  const text = {
    "Lead-in": `Show two images connected with ${t} on the board. Learners discuss the questions on the slide in pairs, then I take two or three answers in open class. No correction at this stage.`,
    "Lead-in / building context": `Set the scene for ${t} with a short personal anecdote and two questions. Learners talk in pairs, then brief open-class feedback.`,
    "Present: clarify and focus on TL": `Elicit the target language for ${t} from the context on the board. Clarify meaning with the concept questions on my language analysis sheet, then model and drill (chorally, then individually), then write the form on the board and highlight the pattern.`,
    Practice: `Learners complete the gap-fill on Handout 1 individually, then check in pairs. I monitor and note errors. Answers checked in open class with brief reference back to the form on the board.`,
    Production: `In pairs, learners use the target language to talk about ${t} in their own lives, using the prompt cards. I monitor at a distance and collect samples of good language and errors for the next stage.`,
    "Error correction": `Write four sentences I heard on the board, two correct and two not. Learners decide in pairs which are which and reformulate. Elicit corrections and praise good use.`,
    "First test (diagnostic)": `Learners do the matching task on Handout 1 in pairs. I do not correct yet -- I monitor to find out what they already know about ${t}.`,
    "Teach (clarifying)": `Clarify the items they struggled with, using the context on the board. Meaning first (concept questions from my analysis sheet), then pronunciation with drilling and stress marking, then form on the board.`,
    "Second test (controlled practice)": `Learners redo the same task from the first test, then check in pairs. Open-class feedback on what has changed.`,
    "Freer practice": `Learners use the language in a short role-play about ${t}, swapping roles once. I monitor and collect language for feedback.`,
    Feedback: `Establish answers in open class, then write up three things I heard: two to praise and one to reformulate together.`,
    "Reading or listening task": `Learners read the text once for the gist question on the board, then compare answers in pairs before whole-class check.`,
    "Highlighting target language": `Learners find and underline the examples of the target language in the text, working in pairs. Check on the board.`,
    "Clarifying target language": `Clarify meaning with the concept questions from my analysis sheet, then model and drill the pronunciation, then highlight the form on the board.`,
    "Language practice": `Controlled written practice on Handout 2, checked in pairs, then a short personalised speaking task using the same language.`,
    "Pre-teach vocabulary": `Teach the four blocking items with pictures and concept questions, drilling each one. Learners then match the words to the definitions on Handout 1 in pairs.`,
    "Reading / listening for gist": `Set the gist question before handing out the text. Learners work alone under time pressure, then compare in pairs. Short open-class check.`,
    "Reading / listening for detail": `Learners answer the six comprehension questions on Handout 2 individually, then check in pairs. I monitor and decide which answers need going over. Whole-class check with learners justifying answers from the text.`,
    "Post-reading / listening task": `Learners discuss the two reaction questions in small groups, relating ${t} to their own experience. I monitor for fluency and note language for delayed correction.`,
    "Preparing to write / speak": `Learners brainstorm ideas about ${t} in pairs and make notes on the planning sheet. I monitor and help with ideas rather than language.`,
    "Useful language": `Put six useful phrases on the board. Check meaning briefly, drill the pronunciation, and leave them visible for the task.`,
    "Speaking / writing task": `Learners carry out the task in groups of three, with one learner listening and noting good language each round. I monitor at a distance, taking notes without interrupting.`,
    "Feedback and error correction": `Groups report back briefly on what they heard. I then put up four samples from my notes for the class to work on together.`,
  }[stage];
  return text ?? `Learners work on ${t}. I monitor and give feedback.`;
}

const INTERACTION_FOR = {
  "Lead-in": "PW / OC",
  "Lead-in / building context": "PW / OC",
  "Present: clarify and focus on TL": "T–S / OC",
  Practice: "Ind. / PW / OC",
  Production: "PW",
  "Error correction": "PW / OC",
  "First test (diagnostic)": "PW",
  "Teach (clarifying)": "T–S / OC",
  "Second test (controlled practice)": "Ind. / PW",
  "Freer practice": "PW",
  Feedback: "OC",
  "Reading or listening task": "Ind. / PW",
  "Highlighting target language": "PW / OC",
  "Clarifying target language": "T–S / OC",
  "Language practice": "Ind. / PW",
  "Pre-teach vocabulary": "T–S / PW",
  "Reading / listening for gist": "Ind. / PW",
  "Reading / listening for detail": "Ind. / PW / OC",
  "Post-reading / listening task": "GW",
  "Preparing to write / speak": "PW",
  "Useful language": "T–S / OC",
  "Speaking / writing task": "GW",
  "Feedback and error correction": "OC",
};

const STAGE_AIM = {
  "Lead-in": "To set the context and generate interest; to get learners talking",
  "Lead-in / building context": "To build the context the target language will come out of",
  "Present: clarify and focus on TL": "To clarify meaning, pronunciation and form of the target language",
  Practice: "To provide controlled written practice with a focus on accuracy",
  Production: "To provide freer oral practice in which the target language is naturally generated",
  "Error correction": "To correct learners' output and consolidate the teaching points",
  "First test (diagnostic)": "To find out what learners already know and where the gaps are",
  "Teach (clarifying)": "To clarify what they did not know, in meaning, pronunciation and form",
  "Second test (controlled practice)": "To check the clarification has worked",
  "Freer practice": "To provide freer oral practice of the target language",
  Feedback: "To establish answers and deal with errors from the task",
  "Reading or listening task": "To read for gist, and to expose learners to the target language in context",
  "Highlighting target language": "To draw attention to the target language in the text",
  "Clarifying target language": "To clarify meaning, pronunciation and form",
  "Language practice": "To provide controlled and then freer practice",
  "Pre-teach vocabulary": "To unblock the vocabulary learners need for the tasks",
  "Reading / listening for gist": "To practise reading for general understanding under time pressure",
  "Reading / listening for detail": "To practise reading for detailed comprehension",
  "Post-reading / listening task": "To develop fluency by reacting to the text and personalising the topic",
  "Preparing to write / speak": "To generate ideas and prepare, so the task itself can be fluent",
  "Useful language": "To provide language learners may find useful (not target language)",
  "Speaking / writing task": "To develop fluency through a purposeful task",
  "Feedback and error correction": "To give feedback on the task, then deal with generic errors",
};

/** Three non-language problems, per the form's own instruction. */
function problemsFor(aim) {
  const pool = [
    {
      problem: "Learners may finish the pair discussion at very different speeds, leaving some waiting.",
      solution: "Have an extra question ready on the slide for fast finishers, and set a visible time limit on the board.",
    },
    {
      problem: `The handout for ${aim.topic} may be too dense for the weaker learners to read in the time.`,
      solution: "Cut the task to the first four items for anyone struggling, and pair a stronger learner with a weaker one.",
    },
    {
      problem: "The audio may be hard to hear at the back of the room.",
      solution: "Test the speakers before the lesson, and be ready to play it a third time or read the script myself.",
    },
    {
      problem: "Three learners are quiet in open class and may not contribute.",
      solution: "Nominate them by name after pair work, when they already have an answer to give.",
    },
    {
      problem: "Learners may use their first language during the freer stage.",
      solution: "Set the task clearly in English, monitor from close by at the start, and remind them of the purpose.",
    },
  ];
  const start = aim.topic.length % 3;
  return [pool[start], pool[(start + 1) % pool.length], pool[(start + 2) % pool.length]];
}

function classProfile(level, learnerCount) {
  const n = learnerCount ?? 12;
  return level === "A2"
    ? `${n} elementary (A2) adults, mixed first languages, most in their twenties and thirties. They are willing to speak but need thinking time, and they rely on each other in pair work. Two are noticeably stronger in reading than in speaking.`
    : `${n} intermediate (B1+) adults, mixed first languages, used to working in pairs and happy to be corrected. Three are quiet in open class but contribute well in pairs. They over-use simple structures when a more precise one is available.`;
}

function materialsFor(aim, level) {
  const base = {
    grammar: `Adapted from the coursebook unit on ${aim.topic}, plus a gap-fill handout and prompt cards of my own.`,
    vocabulary: `Picture set for ${aim.topic}, a matching handout, and the coursebook's own practice exercise.`,
    function: `A short scripted dialogue about ${aim.topic}, role cards, and a phrase bank on the slide.`,
    reading: `A ${level === "A2" ? "graded" : "lightly adapted"} text about ${aim.topic} from the coursebook, with gist and detail task sheets of my own.`,
    listening: `Coursebook audio about ${aim.topic}, with a gist question on the slide and a detail worksheet of my own.`,
    speaking: `Prompt cards on ${aim.topic}, a planning sheet, and a phrase bank on the board.`,
    writing: `A model text on ${aim.topic}, a planning sheet, and a checklist for peer review.`,
  };
  return base[aim.type] ?? base.grammar;
}

/**
 * The full plan for one lesson.
 *
 * @param brief  plan_assignments.main_lesson_aim -- the aim the candidate was given
 * @param tpNumber
 * @param level  "A2" | "B1+"
 * @param previousActionPoints  the last lesson's action points, for personal aims
 */
export function buildPlan({ brief, tpNumber, level, learnerCount, previousActionPoints = [] }) {
  const aim = readAim(brief);
  const key = (FRAMEWORK_FOR[aim.type] ?? FRAMEWORK_FOR.grammar)(tpNumber);
  const fw = FRAMEWORKS[key];

  const procedure = fw.stages.map((stage, i) => ({
    stage,
    aim: STAGE_AIM[stage] ?? "",
    procedure: procedureText(stage, aim, level),
    interaction: INTERACTION_FOR[stage] ?? "PW",
    time: String(fw.times[i]),
  }));

  const subsidiary = {
    grammar: `To develop oral fluency through the personalised production stage.`,
    vocabulary: `To give learners controlled written practice of the new items before they use them freely.`,
    function: `To develop oral fluency and confidence in the role-play.`,
    reading: `To develop oral fluency in the reaction task, and to pre-teach the vocabulary the text blocks on.`,
    listening: `To develop oral fluency in the post-listening discussion.`,
    speaking: `To give learners useful phrases they can reuse, and practice in listening to each other.`,
    writing: `To give learners a model and a checklist they can use again.`,
  }[aim.type];

  return {
    main_aims:
      brief.startsWith("By the end")
        ? brief
        : `By the end of the lesson, learners will be better able to ${
            aim.type === "reading" || aim.type === "listening"
              ? `${aim.type === "reading" ? "read" : "listen"} for ${aim.skill === "detail" ? "detailed understanding" : "gist"} in the context of ${aim.topic}`
              : aim.type === "speaking" || aim.type === "writing"
                ? `${aim.type === "speaking" ? "speak" : "write"} about ${aim.topic}`
                : `use ${aim.topic} in the context of everyday conversation`
          }.`,
    subsidiary_aims: subsidiary,
    personal_aims:
      previousActionPoints.length > 0
        ? previousActionPoints.map((p) => `From my last feedback: ${p.replace(/^\s*[-•]\s*/, "")}`).join("\n")
        : "To keep my instructions short, and to check them before the learners start.",
    class_profile: classProfile(level, learnerCount),
    materials_description: materialsFor(aim, level),
    anticipated_problems: problemsFor(aim),
    framework_used: fw.name,
    procedure,
  };
}

export const PLAN_LESSON_MINUTES = LESSON_MINUTES;

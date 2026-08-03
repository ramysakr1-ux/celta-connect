// Static reference content for the trainee-authored lesson plan / language
// analysis sheet -- ported from Ramy's CELTA Hub prototype
// (~/Desktop/CELTA-Hub/1_trainee_plan_and_analysis.html), which is the real
// design for this content. Only the content/UX is ported; the prototype's
// file-download + Google Classroom hand-off mechanism is replaced by
// CELTA Connect's own database-backed submit-to-lock pattern (see
// project_content_architecture_spec memory).

// ---------------- shared shapes (also used by src/lib/supabase/types.ts) ----------------

export interface ProblemSolutionPair {
  problem: string;
  solution: string;
}

export const INTERACTION_PATTERNS: { code: string; label: string }[] = [
  { code: "T–S", label: "T–S — teacher to student(s)" },
  { code: "S–T", label: "S–T — student to teacher" },
  { code: "S–S", label: "S–S — student to student" },
  { code: "PW", label: "PW — pair work" },
  { code: "GW", label: "GW — group work" },
  { code: "Ind.", label: "Ind. — individual work" },
  { code: "OC", label: "OC — open/whole class" },
  { code: "Ming.", label: "Ming. — mingling" },
];

// The trainee's own authored procedure table -- always this shape regardless
// of density tier, unlike tp_points/plan_assignments' tier-specific brief
// outline (ScriptedProcedure/FrameworkProcedure/CoachingProseProcedure in
// src/lib/tp-density.ts). The two are deliberately not unified: one is a
// suggested outline, this is what the trainee actually plans to do.
export interface PlanProcedureRow {
  stage: string;
  aim: string;
  procedure: string;
  interaction: string;
  time: string;
}

export interface LessonFrameworkStage {
  name: string;
  aim: string;
}
export interface LessonFramework {
  key: string;
  name: string;
  stages: LessonFrameworkStage[];
}

// Choosing a framework fills the procedure table's stage names + aims;
// everything stays editable afterward. Ported verbatim from the prototype.
export const LESSON_FRAMEWORKS: LessonFramework[] = [
  {
    key: "ppp",
    name: "Present – Practice – Produce (PPP)",
    stages: [
      { name: "Lead-in", aim: "To set the topic, personalise it and generate interest in the lesson" },
      {
        name: "Present: clarify and focus on TL",
        aim: "To focus on meaning (timelines, CCQs), form and pronunciation",
      },
      {
        name: "Practice",
        aim: "To consolidate the key concepts of the target language, with a focus on accuracy",
      },
      {
        name: "Production",
        aim: "To provide an authentic activity in which the target language is naturally generated",
      },
      { name: "Error correction", aim: "To correct learners' output and consolidate the key teaching points" },
    ],
  },
  {
    key: "ttt",
    name: "Test – Teach – Test",
    stages: [
      { name: "Lead-in", aim: "To generate interest in the topic/theme of the lesson" },
      {
        name: "First test (diagnostic)",
        aim: "To test learners' current understanding and identify gaps in…",
      },
      {
        name: "Teach (clarifying)",
        aim: "To deal with meaning, pronunciation and form of…, focusing on what they did not know",
      },
      {
        name: "Second test (controlled practice)",
        aim: "To provide controlled/less controlled written/oral practice of…",
      },
      { name: "Freer practice", aim: "To provide less controlled/freer oral/written practice of…" },
      {
        name: "Feedback",
        aim: "To establish correct answers and give feedback on use of the target language",
      },
    ],
  },
  {
    key: "textbased",
    name: "Text-Based Presentation of Language",
    stages: [
      { name: "Lead-in / building context", aim: "To generate interest in the topic, theme or context of the text" },
      {
        name: "Reading or listening task",
        aim: "To practise reading/listening for…; to introduce the target language via a text",
      },
      { name: "Highlighting target language", aim: "To highlight the target language by eliciting or a guiding task" },
      { name: "Clarifying target language", aim: "To clarify meaning, model pronunciation, and highlight form" },
      { name: "Language practice", aim: "To provide controlled/less controlled/freer practice of…" },
      { name: "Feedback", aim: "To establish correct answers and deal with the results of the task" },
    ],
  },
  {
    key: "langpractice",
    name: "Language Practice (follows a previous lesson)",
    stages: [
      { name: "Lead-in (optional)", aim: "Keep the same context as the previous lesson if possible" },
      { name: "Set up", aim: "To set up the practice activity; to highlight the target language to be used" },
      { name: "Controlled practice activity", aim: "To provide controlled written/oral practice of…; teacher monitors" },
      { name: "Freer practice activity", aim: "To provide freer oral/written practice of…; teacher monitors" },
      { name: "Feedback and error correction", aim: "To establish correct answers and deal with errors" },
    ],
  },
  {
    key: "receptive",
    name: "Receptive Skills (reading or listening)",
    stages: [
      { name: "Lead-in", aim: "To activate learners' existing knowledge of the topic; to develop oral fluency" },
      { name: "Prediction task", aim: "To encourage learners to predict the content of the text" },
      { name: "Pre-teach vocabulary", aim: "To unblock the key vocabulary needed to complete the… task" },
      { name: "Reading / listening for gist", aim: "To encourage learners to skim/listen for gist" },
      { name: "Reading / listening for detail", aim: "To practise reading/listening for detailed comprehension" },
      {
        name: "Post-reading / listening task",
        aim: "To develop fluency by reacting to the text; to personalise the topic",
      },
    ],
  },
  {
    key: "productive",
    name: "Productive Skills (speaking or writing)",
    stages: [
      { name: "Lead-in", aim: "To activate existing knowledge of the topic; to generate interest" },
      { name: "Preparing to write / speak", aim: "To generate ideas; to brainstorm, prepare notes, or work from a model" },
      { name: "Useful language", aim: "To provide language learners may find useful (NOT target language)" },
      { name: "Speaking / writing task", aim: "To develop oral fluency through a… task; to develop writing skills" },
      { name: "Feedback and error correction", aim: "To give feedback on outcomes, then deal with generic errors" },
    ],
  },
];

// ---------------- language analysis sheet ----------------

export type LanguageAnalysisType = "grammar" | "vocab" | "function";

// One block per structure/function. Optional fields since grammar and
// function blocks share most fields but not all (function adds `register`).
export interface AnalysisBlock {
  item?: string;
  register?: string;
  marker?: string;
  meaning?: string;
  source?: string;
  clarify?: string;
  meaning_problems: ProblemSolutionPair[];
  form?: string;
  form_problems: ProblemSolutionPair[];
  phonetic?: string;
  pronunciation_features?: string;
  pronunciation_problems: ProblemSolutionPair[];
}

export function emptyAnalysisBlock(): AnalysisBlock {
  return { meaning_problems: [], form_problems: [], pronunciation_problems: [] };
}

export interface VocabRow {
  item: string;
  definition: string;
  convey: string;
  clarification: string;
  form: string;
  problems: string;
}

export function emptyVocabRow(): VocabRow {
  return { item: "", definition: "", convey: "", clarification: "", form: "", problems: "" };
}

interface AnalysisFieldConfig {
  key: keyof AnalysisBlock;
  label: string;
  hint?: string;
  type: "input" | "textarea" | "phon" | "select" | "pairs";
  options?: string[];
}

interface AnalysisSheetConfig {
  title: string;
  blockName: string;
  guide: string;
  aimQuestion: string;
  fields: AnalysisFieldConfig[];
}

const COMMON_TAIL: AnalysisFieldConfig[] = [
  {
    key: "clarify",
    label: "Clarification technique",
    type: "textarea",
    hint: "How will you clarify the meaning in this lesson? How will you check they have understood? Include the answers to your CCQs.",
  },
  { key: "meaning_problems", label: "Meaning problems and solutions", type: "pairs" },
  {
    key: "form",
    label: "Form analysis",
    type: "textarea",
    hint: "Consider: parts of speech, word order, rules, positive / negative / question forms, singular / plural forms.",
  },
  { key: "form_problems", label: "Form problems and solutions", type: "pairs" },
  { key: "phonetic", label: "Phonetic transcription & stress", type: "phon" },
  {
    key: "pronunciation_features",
    label: "Pronunciation features",
    type: "textarea",
    hint: "Consider: weak forms, linking, assimilation, elision, intrusion, or geminates (twin sounds).",
  },
  { key: "pronunciation_problems", label: "Pronunciation problems and solutions", type: "pairs" },
];

export const ANALYSIS_SHEETS: Record<"grammar" | "function", AnalysisSheetConfig> = {
  grammar: {
    title: "Grammar analysis",
    blockName: "Structure",
    guide: "One block per structure. Add another if your lesson has more than one.",
    aimQuestion: "Is grammar the main aim of your lesson?",
    fields: [
      {
        key: "item",
        label: "Name of the structure",
        type: "input",
        hint: "Include the area of use — e.g. present perfect for unfinished past.",
      },
      { key: "marker", label: "Marker sentence(s)", type: "textarea", hint: "The sentence(s) you will use to present the structure above." },
      { key: "meaning", label: "Meaning analysis", type: "textarea" },
      { key: "source", label: "Source", type: "input", hint: "Where your analysis came from — grammar reference, learner dictionary." },
      ...COMMON_TAIL,
    ],
  },
  function: {
    title: "Functional language analysis",
    blockName: "Function",
    guide: "One block per function. Add another if your lesson covers more than one.",
    aimQuestion: "Is functional language the main aim of your lesson?",
    fields: [
      { key: "item", label: "Function and context", type: "input", hint: "e.g. Interrupting politely in a team meeting." },
      {
        key: "register",
        label: "Register",
        type: "select",
        options: ["", "Formal", "Neutral", "Informal", "Varies — see notes"],
        hint: "Who is speaking to whom, and how formal the exponents are.",
      },
      {
        key: "marker",
        label: "Functional items and language included",
        type: "textarea",
        hint: "The exponents you will teach, exactly as the students will meet them.",
      },
      { key: "meaning", label: "Meaning and use", type: "textarea", hint: "What the phrases do, and when a speaker would choose them." },
      { key: "source", label: "Source", type: "input", hint: "Coursebook, functional language reference, learner dictionary." },
      ...COMMON_TAIL,
    ],
  },
};

export const IPA_SYMBOL_GROUPS: { label: string; symbols: string[] }[] = [
  { label: "Vowels", symbols: "iː ɪ e æ ɑː ɒ ɔː ʊ uː ʌ ɜː ə".split(" ") },
  { label: "Diphthongs", symbols: "eɪ aɪ ɔɪ əʊ oʊ aʊ ɪə eə ʊə".split(" ") },
  {
    label: "Consonants",
    symbols: "p b t d k ɡ f v θ ð s z ʃ ʒ h m n ŋ l r j w tʃ dʒ".split(" "),
  },
  { label: "Marks", symbols: "ˈ ˌ ː / . ‿".split(" ") },
];

// ---------------- self-evaluation ----------------

export interface SelfEvalActionPoint {
  previous_point: string;
  what_i_did: string;
}

// ---------------- tutor feedback ----------------

// `starred` marks a point to carry forward into the *next* TP's
// self-evaluation "action points from last TP" (a live DB read now, not a
// hand-passed file). `criteria_codes` come from CELTA_CRITERIA_SECTIONS in
// src/lib/celta-criteria.ts.
export interface FeedbackPoint {
  text: string;
  criteria_codes: string[];
  starred: boolean;
}

export function emptyFeedbackPoint(): FeedbackPoint {
  return { text: "", criteria_codes: [], starred: false };
}

// ---------------- TP card lifecycle status (for the overview cards) ----------------

export interface TpCardStatus {
  label: string;
  tone: "pending" | "on-track" | "at-risk";
}

// Not imported from src/lib/supabase/types.ts (StandardRating) to avoid a
// circular import -- that file already imports several types from this one.
type StandardRatingValue = "above_standard" | "to_standard" | "not_to_standard";

export function getTpCardStatus(input: {
  planSubmitted: boolean;
  taught: boolean;
  selfEvalSubmitted: boolean;
  feedbackSubmitted: boolean;
  grade?: StandardRatingValue | null;
}): TpCardStatus {
  if (input.feedbackSubmitted) {
    return input.grade === "not_to_standard"
      ? { label: "Feedback received -- not to standard", tone: "at-risk" }
      : { label: "Feedback received", tone: "on-track" };
  }
  if (input.selfEvalSubmitted) return { label: "Awaiting tutor feedback", tone: "pending" };
  if (input.taught) return { label: "Self-evaluation due", tone: "pending" };
  if (input.planSubmitted) return { label: "Plan submitted", tone: "on-track" };
  return { label: "Draft in progress", tone: "pending" };
}

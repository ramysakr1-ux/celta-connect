// The Cambridge CELTA 5 criteria, transcribed verbatim from the official
// CELTA 5 Candidate Record Booklet (CELTA5: July 2023 revision),
// Appendix 1 / Stage Two Progress Record. If Cambridge revises the
// syllabus again, update this file to match the new booklet.

export const CELTA_CRITERIA_SECTIONS = [
  {
    section: "1",
    title: "Learners and Teachers and the Teaching and Learning Context",
    codes: ["1a", "1b", "1c", "1d"],
  },
  {
    section: "2",
    title: "Language Analysis and Awareness",
    codes: ["2a", "2b", "2c", "2d", "2e", "2f", "2g"],
  },
  {
    section: "3",
    title: "Language Skills: Reading, Listening, Speaking and Writing",
    codes: ["3a", "3b"],
  },
  {
    section: "4",
    title: "Planning and Resources for Different Teaching Contexts",
    codes: [
      "4a", "4b", "4c", "4d", "4e", "4f", "4g",
      "4h", "4i", "4j", "4k", "4l", "4m", "4n",
    ],
  },
  {
    section: "5",
    title: "Developing Teaching Skills and Professionalism",
    codes: [
      "5a", "5b", "5c", "5d", "5e", "5f", "5g",
      "5h", "5i", "5j", "5k", "5l", "5m", "5n",
    ],
  },
] as const;

export const CELTA_CRITERIA_CODES: readonly string[] = CELTA_CRITERIA_SECTIONS.flatMap(
  (s) => s.codes
);

// Official Cambridge CELTA criteria wording, verbatim from the booklet.
export const CRITERIA_LABELS: Record<string, string> = {
  "1a": "teaching a class with an awareness of the needs and interests of the learner group",
  "1b": "teaching a class with an awareness of learning preferences and cultural factors that may affect learning",
  "1c": "acknowledging, when necessary, learners' backgrounds and previous learning experiences",
  "1d": "establishing good rapport with learners and ensuring they are fully involved in learning activities",

  "2a": "adjusting their own use of language in the classroom according to the learner group and the context",
  "2b": "identifying errors and sensitively correcting learners' oral and written language",
  "2c": "providing clear contexts and a communicative focus for language",
  "2d": "providing accurate and appropriate models of oral and written language in the classroom",
  "2e": "focusing on language items in the classroom by clarifying relevant aspects of meaning, form and phonology to an appropriate depth",
  "2f": "showing awareness of differences in style and register",
  "2g": "providing appropriate practice of language items",

  "3a": "helping learners to understand reading and listening texts",
  "3b": "helping learners to produce oral and written language",

  "4a": "identifying and stating appropriate aims/outcomes for individual lessons",
  "4b": "ordering activities so that they achieve lesson aims",
  "4c": "selecting, adapting or designing materials, activities, resources and technical aids appropriate for the lesson",
  "4d": "presenting the materials for classroom use with a professional appearance, and with regard to copyright requirements",
  "4e": "describing the procedure of the lesson in sufficient detail",
  "4f": "including interaction patterns appropriate for the materials and activities used in the lesson",
  "4g": "ensuring balance, variety and a communicative focus in materials, tasks and activities",
  "4h": "allocating appropriate timing for different stages in the lesson",
  "4i": "analysing language with attention to form, meaning and phonology and using correct terminology",
  "4j": "anticipating potential difficulties with language, materials and learners",
  "4k": "suggesting solutions to anticipated problems",
  "4l": "using terminology that relates to language skills and subskills correctly",
  "4m": "working constructively with colleagues in the planning of teaching practice sessions",
  "4n": "reflecting on and evaluating their plans in the light of the learning process and suggesting improvements for future plans",

  "5a": "arranging the classroom appropriately for teaching and learning, bearing in mind safety regulations of the institution",
  "5b": "setting up and managing whole class and/or group and individual activities as appropriate",
  "5c": "selecting appropriate teaching techniques in relation to the content of the lesson",
  "5d": "managing the learning process in such a way that lesson aims are achieved",
  "5e": "making use of materials, resources and technical aids in such a way that they enhance learning",
  "5f": "using appropriate means to make instructions for tasks and activities clear to learners",
  "5g": "using a range of questions effectively for the purpose of elicitation and checking of understanding",
  "5h": "providing learners with appropriate feedback on tasks and activities",
  "5i": "maintaining an appropriate learning pace in relation to materials, tasks and activities",
  "5j": "monitoring learners appropriately in relation to the task or activity",
  "5k": "beginning and finishing lessons on time and, if necessary, making any relevant regulations pertaining to the teaching institution clear to learners",
  "5l": "maintaining accurate and up-to-date records in their portfolio",
  "5m": "noting their own teaching strengths and weaknesses in different teaching situations in light of feedback from learners, teachers and teacher educators",
  "5n": "participating in and responding to feedback",
};

export const CRITERIA_RATING_OPTIONS = [
  { value: "S+", label: "S+ (Above the standard)" },
  { value: "S", label: "S (Meets the standard)" },
  { value: "N", label: "N (Not to standard)" },
  { value: "X", label: "X (Not applicable yet)" },
] as const;

export const STANDARD_RATING_OPTIONS = [
  { value: "above_standard", label: "Above standard for this stage of the course" },
  { value: "to_standard", label: "To standard for this stage of the course" },
  { value: "not_to_standard", label: "Not to standard for this stage" },
] as const;

// Appendix 2 -- CELTA Performance Descriptors, verbatim from the syllabus
// (2024 edition). Used at the end of the course to decide the final
// recommended grade: performance must match ALL descriptors at a grade to
// achieve it. Shown as reference copy alongside the final-grade form.
export const GRADE_DESCRIPTORS = {
  dimensions: [
    {
      name: "Planning",
      Pass: "Candidates can plan effectively with guidance. They can analyse target language adequately and generally select appropriate resources and tasks for successful language and language skills development.",
      "Pass B": "Candidates can plan effectively with some guidance. They can analyse target language well and select appropriate resources and tasks for successful language and language skills development.",
      "Pass A": "Candidates can plan effectively with minimal guidance. They can analyse target language thoroughly and select appropriate resources and tasks for successful language and language skills development.",
    },
    {
      name: "Teaching",
      Pass: "Candidates can generally deliver effective language and skills lessons, using a variety of classroom teaching techniques with a degree of success.",
      "Pass B": "Candidates can deliver effective language and skills lessons, using a variety of classroom teaching techniques successfully.",
      "Pass A": "Candidates can deliver effective language and skills lessons, using a variety of classroom teaching techniques successfully.",
    },
    {
      name: "Awareness of learners",
      Pass: "Candidates show some awareness of learners and some ability to respond so that learners benefit from the lessons.",
      "Pass B": "Candidates show good awareness of learners and can respond so that learners benefit from the lessons.",
      "Pass A": "Candidates show very good awareness of learners and can respond so that learners benefit from the lessons.",
    },
    {
      name: "Reflection",
      Pass: "Candidates can reflect on some key strengths and weaknesses and generally use these reflections to develop their teaching skills.",
      "Pass B": "Candidates can reflect on key strengths and weaknesses and generally use these reflections to develop their teaching skills.",
      "Pass A": "Candidates can reflect on key strengths and weaknesses and consistently use these reflections to develop their teaching skills.",
    },
    {
      name: "Overall",
      Pass: "Candidates' planning and teaching show satisfactory understanding of English language learning and teaching processes at CELTA level.",
      "Pass B": "Candidates' planning and teaching show good understanding of English language learning and teaching processes at CELTA level.",
      "Pass A": "Candidates' planning and teaching show excellent understanding of English language learning and teaching processes at CELTA level.",
    },
  ],
  fail: "Candidates' performance does not match all of the Pass descriptors. Some CELTA assessment criteria are not achieved and/or requirements for written work are not met.",
  eligibility: [
    "Fail more than one written assignment: not eligible for a Pass at all.",
    "Fail exactly one written assignment: a Pass may still be recommended if there is sufficient other evidence (TP record and/or written work as a whole), but not Pass A.",
    "No portfolio submitted for Grade Review: outcome is Withdrawn, not Fail.",
  ],
} as const;

// ============================================================
// Per-criterion suggestion, derived from TP lesson tags (strength /
// action point). A starting point for the trainer's Stage 2 rating,
// never a final answer -- always shown as editable.
// ============================================================

export type CriteriaTagType = "strength" | "action_point";

export interface CriteriaTag {
  tag_type: CriteriaTagType;
  created_at: string;
}

export function computeCriteriaSuggestion(
  tags: CriteriaTag[]
): "S+" | "S" | "N" | null {
  if (tags.length === 0) return null; // no evidence yet -- leave as X

  const sorted = [...tags].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const last = sorted[sorted.length - 1];
  const earlier = sorted.slice(0, -1);

  if (last.tag_type === "action_point") {
    // Still an open concern, whether this is the first mention or a repeat.
    return "N";
  }

  // last.tag_type === "strength"
  const hadEarlierActionPoint = earlier.some((t) => t.tag_type === "action_point");
  if (hadEarlierActionPoint) return "S"; // improved from a weakness -- solid, not yet "consistent"

  const strengthCount = sorted.filter((t) => t.tag_type === "strength").length;
  return strengthCount >= 2 ? "S+" : "S"; // S+ needs a consistent pattern, not one good lesson
}

// ============================================================
// Trainer-only trajectory indicator: "currently tracking toward X".
// Purely advisory -- never shown to the trainee, never sets the real
// final grade. Needs a minimum spread of rated criteria before it says
// anything, to avoid a misleadingly confident read from TP1-2 alone.
// ============================================================

export type Trajectory = "Pass A" | "Pass B" | "Pass" | "Fail" | "not_enough_data";

const TRAJECTORY_MIN_RATED = 10; // out of 41 criteria

export function computeTrajectory(
  ratings: (("S+" | "S" | "N" | "X") | null)[]
): Trajectory {
  const rated = ratings.filter((r): r is "S+" | "S" | "N" => r != null && r !== "X");

  if (rated.length < TRAJECTORY_MIN_RATED) return "not_enough_data";
  if (rated.some((r) => r === "N")) return "Fail";

  const plusCount = rated.filter((r) => r === "S+").length;
  const ratio = plusCount / rated.length;

  if (ratio >= 0.75) return "Pass A";
  if (ratio >= 0.4) return "Pass B";
  return "Pass";
}

// The Cambridge CELTA 5 criteria, transcribed verbatim from the official
// CELTA 5 Candidate Record Booklet (CELTA 5: July 2023 revision, the actual
// PDF, re-read directly page by page 2026-08-20), Appendix 1 / Stage Two
// Progress Record. 41 codes total, not 42 -- Section 3 has exactly two,
// 3a and 3b, everywhere in the real booklet (Stage Two Progress Record,
// Stage Three Progress Record, and Appendix 1 all show only 3a/3b, never a
// 3c). A "3c" was wrongly added 2026-08-19 on a claimed syllabus-PDF
// confirmation -- confirmed 2026-08-26 that the syllabus document (CELTA
// Syllabus and Assessment Guidelines, Dec 2022) genuinely does contain a 3c;
// the two official documents disagree, and the booklet governs actual
// grading (celta5_matrix), so 41 codes/no-3c is correct here regardless --
// removed 2026-08-20, along with its backfilled celta5_matrix rows
// (migration 0171). If Cambridge revises the booklet again, update this
// file to match the new one -- and re-verify by reading the actual PDF
// directly, not a claimed prior confirmation.

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
  "2e": "focusing on language items in the classroom by clarifying relevant aspects of meaning and form (including phonology) to an appropriate degree of depth",
  "2f": "showing awareness of differences in style and register",
  "2g": "providing appropriate practice of language items",

  // Reading and listening are NOT split into separate codes -- 3a covers
  // both together. 3b covers BOTH oral and written production in one code
  // -- there is no separate "writing" criterion (no 3c; see the header
  // comment on why an earlier pass wrongly added one).
  "3a": "helping learners to understand reading and listening texts",
  "3b": "helping learners to produce oral and written language",

  "4a": "identifying and stating appropriate aims/outcomes for individual lessons",
  "4b": "ordering activities so that they achieve lesson aims",
  "4c": "selecting, adapting or designing materials, activities, resources and technical aids appropriate for the lesson",
  "4d": "presenting the materials for classroom use with a professional appearance, and with regard to copyright requirements",
  "4e": "describing the procedure of the lesson in sufficient detail",
  "4f": "including interaction patterns appropriate for the materials and activities used in the lesson",
  "4g": "ensuring balance, variety and a communicative focus in materials, tasks and activities",
  "4h": "allocating appropriate timing for different stages in the lessons",
  "4i": "analysing language with attention to form, meaning and phonology and using correct terminology",
  "4j": "anticipating potential difficulties with language, materials and learners",
  "4k": "suggesting solutions to anticipated problems",
  "4l": "using terminology that relates to language skills and subskills correctly",
  "4m": "working constructively with colleagues in the planning of teaching practice sessions",
  "4n": "reflecting on and evaluating their plans in light of the learning process and suggesting improvements for future plans",

  "5a": "arranging the classroom appropriately for teaching and learning, bearing in mind safety regulations of the institution",
  "5b": "setting up and managing whole class and/or group or individual activities as appropriate",
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

// Appendix 1's example/guidance bullets under each criterion code, verbatim
// from the booklet, transcribed 2026-08-04. Not shown anywhere in the app
// yet beyond the CELTA5 criteria matrix tooltips -- also intended as the
// seed glossary for the auto-tagging engine spec'd in
// project_grading_feedback_trainer_awareness.md (§2): matching a trainer's
// feedback bullet against this wording/phrasing is the first-pass mechanism
// before any trainer-shorthand glossary or LLM fallback is layered on.
export const CRITERIA_GUIDANCE: Record<string, string[]> = {
  "1a": [
    "find out from learners and peers about the needs and interests of learners",
    "use this information for selecting and adapting materials and activity types where appropriate",
    "use this information when setting up pair and group work and dealing with learners in open class where appropriate",
  ],
  "1b": [
    "find out from learners and peers about the cultural backgrounds of learners",
    "use this information for selecting and adapting materials and activity types where appropriate",
    "use this information when setting up pair and group work and dealing with learners in open class where appropriate",
  ],
  "1c": [
    "find out from learners and peers about the learning backgrounds of learners",
    "find out about the linguistic strengths and weaknesses of learners",
    "use this information for selecting materials and activity types where appropriate",
    "use this information when setting up pair and group work and dealing with learners in open class where appropriate",
  ],
  "1d": [
    "build a positive classroom atmosphere",
    "interact naturally with learners before, during and after the lesson",
    "maintain eye contact",
    "ensure that learners are involved in the lesson during teacher-fronted and learner-centred stages of the lesson",
  ],

  "2a": [
    "use comprehensible language to give instructions and when explaining",
    "keep your simplified language natural",
    "allow learners opportunity to speak by keeping teacher talk to an appropriate level",
  ],
  "2b": [
    "show an awareness of student errors",
    "correct learners' language sensitively during controlled oral practice activities",
    "give feedback on oral errors after a communicative activity",
    "correct learners' language sensitively during controlled written practice activities",
    "correct freer written tasks set in class or set for homework",
  ],
  "2c": [
    "provide a context for language by means of text, situation or task using visual aids and realia as appropriate",
    "ensure there is a clear link between the context and the target language",
    "ensure that the context provides learners with sufficient opportunity for communicative practice",
  ],
  "2d": [
    "choose natural examples of language from context",
    "ensure new language models are natural and accurate when drilling",
    "highlight the target language clearly",
    "ensure language used on the board and on worksheets is correct in terms of spelling and punctuation",
  ],
  "2e": [
    "clarify the meaning of language in language-based lessons by using one of the ways you have learnt on the course, e.g. concept questions, timelines or a learner-centred task",
    "clarify the form of language in language-based lessons by using one of the ways you have learnt on the course, e.g. using the board or a learner-centred task",
    "clarify the pronunciation of language in language-based lessons in one of the ways you have learnt on the course, e.g. finger highlighting, highlighting on the board",
  ],
  "2f": [
    "show awareness of formal, neutral and informal language",
    "show awareness of how language changes according to the different contexts in which it is used",
  ],
  "2g": [
    "provide as much practice in context as possible",
    "ensure the practice is appropriate to the target language",
    "stage practice activities logically",
  ],

  "3a": [
    "follow teaching procedures you have learnt on the course for a receptive skills-based lesson",
    "ensure an appropriate focus on developing receptive skills and subskills",
  ],
  "3b": [
    "follow teaching procedures you have learnt on the course for a speaking skills-based lesson",
    "ensure an appropriate focus on developing speaking skills and subskills",
    "ensure a communicative focus in speaking activities",
    "provide learners with opportunities to practise writing in language-focused and skills lessons",
    "ensure an appropriate focus on practising writing skills and subskills",
  ],

  "4a": [
    "write clear aims",
    "know the difference between main and subsidiary aims",
  ],
  "4b": [
    "sequence the activities/stages of a language focus lesson in one of the ways you have learnt on the course and so that aims are achieved",
    "sequence the activities/stages of a skills lesson in one of the ways you have learnt on the course so that aims are achieved",
  ],
  "4c": [
    "choose materials, tasks and activities from coursebooks and other sources that meet your aims",
    "create extra materials and tasks when appropriate",
    "adapt texts so they are easier or more relevant for your learners",
    "adapt tasks so that they present either more or less challenge for learners",
  ],
  "4d": [
    "make sure your handouts are legible for students",
    "remember to put a copyright label on photocopies",
  ],
  "4e": [
    "indicate what the learners will do so it is clear to someone reading the plan",
    "indicate what the teacher will do so it is clear to someone reading the plan",
  ],
  "4f": [
    "identify and state interaction patterns for each stage of the lesson in the procedure of the lesson plan, for example teacher-student, student-student, students work in pairs, students work in groups",
  ],
  "4g": [
    "ensure that there is a balance between teacher input and student practice",
    "ensure that there is a balance between teacher-led activity and student-centred activity",
    "ensure that there is variety in terms of activity type in the lesson, for example, oral as well as written practice, listening as well as oral practice",
    "ensure that there is variety in terms of materials, tasks and activities in the lesson",
  ],
  "4h": [
    "divide the procedure into clear stages in your lesson plan and indicate how long you think each stage will take",
  ],
  "4i": [
    "show that you can analyse language in detail for any language focused on in a lesson",
    "show how the form will be clarified on the board",
    "indicate how the concept will be established and checked",
    "indicate significant aspects of pronunciation relating to this language",
  ],
  "4j": [
    "list on the lesson plan cover sheet any potential problems for learners with language: form, meaning, pronunciation",
    "list on the lesson plan cover sheet any potential problems for learners with tasks",
  ],
  "4k": [
    "show on the lesson plan coversheet how you plan to deal with potential problems with language and tasks",
  ],
  "4l": [
    "write aims for skills lessons which relate to developing receptive and productive skills and subskills -- e.g. developing skim reading skills, listening for gist",
  ],
  "4m": [
    "liaise and co-operate willingly and constructively with your peers in supervised lesson preparation",
  ],
  "4n": [
    "discuss and note the strengths and weaknesses of your lesson plan after your lesson",
    "address weak areas in the planning of future TP lessons",
  ],

  "5a": [
    "arrange the classroom (online or face-to-face) to suit different types of activity",
  ],
  "5b": [
    "give clear instructions for pair, group, individual and plenary work",
    "organise the learners in pair, group, individual and plenary work",
    "give an example or demonstration of the task if appropriate",
  ],
  "5c": [
    "recognise different lesson types (skills based, language focus based) and follow teaching procedures you have learnt on the course to achieve the aims of different types of lesson",
  ],
  "5d": [
    "ensure that the activities and tasks help achieve the aim of the lesson",
    "ensure there is an appropriate balance between teacher-fronted and learner-centred activities",
    "be sufficiently directive when appropriate",
    "keep a low profile when appropriate",
    "know when to intervene or not",
  ],
  "5e": [
    "use games, puzzles, pictures, realia, audio material to help learners learn and to provide practice",
    "use technical aids (e.g., apps, video, projector or interactive whiteboard) so that they are clear to all",
  ],
  "5f": [
    "use simple language to give instructions for tasks and activities",
    "give instructions at an appropriate stage of the lesson",
    "give an example or demonstration of the task if appropriate",
    "check that learners have understood instructions for tasks and activities",
  ],
  "5g": [
    "use questions for setting context, building up information, assessing learners' prior knowledge, checking meaning of language items, and checking understanding of instructions",
  ],
  "5h": [
    "give learners time to check the answers to tasks in pairs/groups",
    "provide feedback on both the content of activities and the language used in them",
    "use a variety of techniques in order to give feedback on activities",
  ],
  "5i": [
    "keep teacher language and explanation to a minimum",
    "allow time for learners to complete tasks without allowing activities to go on too long",
    "be aware of when learners are ready to move on to the next stage of the lesson",
  ],
  "5j": [
    "listen to learners attentively but unobtrusively during stages of the lesson",
    "know when to intervene in learner-centred activities",
    "ensure that your attention is spread evenly amongst the learners",
    "know when to move on to the next stage of the lesson",
  ],
  "5k": [
    "ensure that you are in the classroom in good time to begin your lesson on time",
    "ensure that your materials are prepared in good time to begin your lesson on time",
    "ensure that you finish your lesson on time and that you do not exceed your allotted time",
    "ensure learners are aware of start and finish times as required",
    "ensure you pass on any relevant administrative information to learners when required",
  ],
  "5l": [
    "update your CELTA 5 booklet each day",
    "file TP and assignment documents (in the correct order) in your portfolio each day",
  ],
  "5m": [
    "complete a written self-evaluation for each TP lesson noting your strengths and weaknesses",
    "incorporate feedback from others in future TP lessons",
  ],
  "5n": [
    "evaluate your own lessons and your colleagues' lessons critically but constructively in TP feedback",
    "suggest strategies for improving weak areas",
    "respond positively to comments, suggestions and criticism made by peers and tutors on your lessons",
    "make constructive suggestions on your peers' teaching",
  ],
};

// specs/assessment-model.md's four-link model, unblocked 2026-08-19 by
// Ramy's `Criteria-by-Input-Session.md` (source: Criteria by Stage.dc.html
// CRITERIA array) -- link 3, "a [criterion] is live from the TP that
// follows its session." `entersAt` is that file's own already-resolved
// TP number (1-8) per code, transcribed verbatim, not re-derived from the
// input-session timetable tags above -- those feed a DIFFERENT feature
// (peer-observation's criteriaForTpDate, "this week's focus criterion"),
// not this one, and the two are allowed to diverge (see PPP/Sounds/
// Teaching vocabulary, which reinforce codes here without being where
// those codes formally enter scope).
//
// "Once entered, a criterion stays watched for every subsequent TP --
// nothing drops out" -- isCriterionLiveAtTp() below is the whole rule.
// This is the ENTRY point only; it says nothing about whether a rating is
// good or bad, matching "credit above stage, never penalise": a not-yet-
// live criterion can still be rated (early evidence), it's just not yet
// EXPECTED, which is a UI hint, not a gate.
export const CRITERIA_ENTERS_AT_TP: Record<string, number> = {
  "1a": 3,
  "1b": 3,
  "1c": 3,
  "1d": 1,

  "2a": 1,
  "2b": 4,
  "2c": 1,
  "2d": 1,
  "2e": 4,
  "2f": 5,
  "2g": 5,

  "3a": 1,
  "3b": 5,

  "4a": 1,
  "4b": 1,
  "4c": 1,
  "4d": 1,
  "4e": 1,
  "4f": 1,
  "4g": 1,
  "4h": 7,
  "4i": 3,
  "4j": 3,
  "4k": 3,
  "4l": 3,
  "4m": 7,
  "4n": 3,

  "5a": 1,
  "5b": 1,
  "5c": 3,
  "5d": 1,
  "5e": 1,
  "5f": 1,
  "5g": 2,
  "5h": 4,
  "5i": 1,
  "5j": 1,
  "5k": 1,
  "5l": 3,
  "5m": 3,
  "5n": 3,
};

// One-sentence, observable descriptions from the same source -- what a
// suggestion or a "not yet taught" hint should actually be citing, rather
// than just the bare code.
export const CRITERIA_SCOPE_DESCRIPTION: Record<string, string> = {
  "1a": "Shows awareness of learners' needs, goals and motivations, and how these affect their learning.",
  "1b": "Shows awareness of the social, cultural and educational backgrounds learners bring to the classroom.",
  "1c": "Shows awareness of learners' previous language learning experience and how it shapes expectations.",
  "1d": "Establishes and maintains rapport with learners, creating a supportive, non-threatening atmosphere.",

  "2a": "Grades own language and uses teacher talk appropriately for the level being taught.",
  "2b": "Corrects learner errors appropriately, choosing when and how to intervene without undermining fluency.",
  "2c": "Selects and creates contexts that make the meaning of target language clear and memorable.",
  "2d": "Provides accurate spoken and written models of target language for learners to work from.",
  "2e": "Clarifies meaning, form and pronunciation of language accurately, using CCQs rather than definitions.",
  "2f": "Shows awareness of register and appropriacy: when a phrase is formal, informal, or situation-specific.",
  "2g": "Designs practice activities that move learners from controlled accuracy work to freer fluency work.",

  "3a": "Develops learners' receptive skills through staged reading or listening tasks, gist before detail.",
  "3b": "Develops learners' speaking and writing skills through tasks that prioritise communication over accuracy.",

  "4a": "States clear, achievable lesson aims that are learner-focused, not just teacher-focused.",
  "4b": "Structures the lesson in a logical sequence of stages that build towards the aims.",
  "4c": "Designs or adapts materials that are appropriate to the aims, level and the learners in the room.",
  "4d": "Prepares materials to a professional standard: clear, correctly formatted, ready to use.",
  "4e": "Writes a clear procedure describing what the teacher and learners will actually do at each stage.",
  "4f": "Plans a variety of interaction patterns (whole class, pairs, groups, individual) matched to each stage.",
  "4g": "Balances the lesson across skills and systems work rather than over-weighting one area.",
  "4h": "Allocates realistic timing to each stage and plans contingencies if stages run short or long.",
  "4i": "Analyses the target language's meaning, form and pronunciation accurately in the written plan.",
  "4j": "Anticipates problems learners may have with the language or the task before the lesson happens.",
  "4k": "Plans practical solutions in advance for the problems anticipated.",
  "4l": "Uses correct pedagogical terminology accurately and consistently in the written lesson plan.",
  "4m": "Works constructively with peers during joint planning and supervision sessions.",
  "4n": "Reflects critically on their own plan, identifying what worked and what they would change.",

  "5a": "Arranges the physical classroom appropriately for the activity and interaction pattern.",
  "5b": "Groups learners appropriately and manages the transitions between groupings smoothly.",
  "5c": "Uses a range of teaching techniques appropriately for the stage and aim of the lesson.",
  "5d": "Achieves the stated lesson aims by the end of the lesson, adapting where needed.",
  "5e": "Uses teaching materials and aids effectively in the live lesson, not just on paper.",
  "5f": "Gives clear, concise instructions and checks understanding before setting learners off on a task.",
  "5g": 'Elicits language and checks concepts using CCQs rather than telling or asking "do you understand?"',
  "5h": "Gives learners feedback on their performance in a task that is specific and useful.",
  "5i": "Maintains an appropriate pace, adjusting it in response to how the class is responding.",
  "5j": "Monitors learners purposefully during tasks, without over-monitoring pairs that don't need it.",
  "5k": "Manages timing in the live lesson so that stages don't overrun at the expense of later ones.",
  "5l": "Maintains a complete, organised portfolio of lesson plans, materials and reflections.",
  "5m": "Reflects honestly and specifically on their own teaching in self-evaluations after each lesson.",
  "5n": "Participates constructively in peer feedback sessions, both giving and receiving feedback well.",
};

export function isCriterionLiveAtTp(code: string, currentTpRound: number): boolean {
  const entersAt = CRITERIA_ENTERS_AT_TP[code] ?? 1;
  return currentTpRound >= entersAt;
}

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
  // Only ever set for tags sourced from tp_feedback, which records both
  // natively -- tp_lesson_criteria_tags (the older per-lesson quick tags)
  // has neither without an extra join through tp_lessons, so those entries
  // leave these undefined and are simply excluded from anything that needs
  // per-TP or per-tutor grouping (computeAttentionFlags below).
  tp_number?: number;
  trainer_id?: string | null;
}

// Merges criteria tags from the TP card feedback system (`tp_feedback`,
// where a criterion is tagged via `FeedbackPoint.criteria_codes` on the
// strengths/action-points arrays) into a tagsByCriteria map already built
// from `tp_lesson_criteria_tags`. Both are real tagging surfaces trainers
// use -- the older per-lesson quick tags and the newer TP card feedback --
// and the criteria suggestion engine needs evidence from both, not just
// whichever one the trainer happened to use for a given TP. Draft (not yet
// submitted) feedback is excluded: it isn't locked-in evidence yet.
export interface TpFeedbackForCriteriaTags {
  submitted_at: string | null;
  tp_number: number;
  trainer_id: string | null;
  strengths_planning: { criteria_codes: string[] }[] | null;
  action_points_planning: { criteria_codes: string[] }[] | null;
  strengths_teaching: { criteria_codes: string[] }[] | null;
  action_points_teaching: { criteria_codes: string[] }[] | null;
}

export function addTpFeedbackCriteriaTags(
  tagsByCriteria: Map<string, CriteriaTag[]>,
  feedbackRows: TpFeedbackForCriteriaTags[]
): void {
  for (const fb of feedbackRows) {
    if (!fb.submitted_at) continue;
    const groups: [CriteriaTagType, { criteria_codes: string[] }[] | null][] = [
      ["action_point", fb.action_points_planning],
      ["action_point", fb.action_points_teaching],
      ["strength", fb.strengths_planning],
      ["strength", fb.strengths_teaching],
    ];
    for (const [tag_type, points] of groups) {
      for (const point of points ?? []) {
        for (const code of point.criteria_codes) {
          const list = tagsByCriteria.get(code) ?? [];
          list.push({
            tag_type,
            created_at: fb.submitted_at,
            tp_number: fb.tp_number,
            trainer_id: fb.trainer_id,
          });
          tagsByCriteria.set(code, list);
        }
      }
    }
  }
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
// assessment-model.md "Where a suggestion comes from" -- three of the
// four named patterns, each required to cite the evidence it came from
// ("a suggestion that cannot name its evidence is not shown"). Built from
// data that already exists (entersAt, TP-tagged strength/action-point
// evidence, per-tutor authorship on tp_feedback) -- nothing fabricated.
// The fourth named pattern, "plans still needing substantial input in
// week four," has no data behind it anywhere in the schema (no field
// records how much tutor input a plan needed) and isn't attempted here.
// ============================================================

export type AttentionFlagKind = "not_yet_met" | "consistent_strength" | "tutor_disagreement";

export interface AttentionFlag {
  kind: AttentionFlagKind;
  detail: string;
}

const ATTENTION_STREAK_THRESHOLD = 3; // matches the evidence bar used elsewhere (STAGE_FLAG_THRESHOLD, FOL's "three examples")

export function computeAttentionFlags(
  code: string,
  tags: CriteriaTag[],
  currentTpRound: number
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];

  // "a sub-criterion live for three TPs and never yet met"
  const entersAt = CRITERIA_ENTERS_AT_TP[code];
  if (entersAt != null) {
    const tpsSinceEntry = currentTpRound - entersAt + 1;
    const everMet = tags.some((t) => t.tag_type === "strength");
    if (tpsSinceEntry >= ATTENTION_STREAK_THRESHOLD && !everMet) {
      flags.push({
        kind: "not_yet_met",
        detail: `Live since TP${entersAt}, through TP${currentTpRound} (${tpsSinceEntry} TPs) with no strength evidence yet.`,
      });
    }
  }

  // "a sub-criterion met above standard in three consecutive TPs" -- a TP
  // only counts as a clean "met above standard" pass when every tag
  // recorded for this code at that TP is a strength, none alongside an
  // action point. The streak resets both on a dirty TP AND on a genuine
  // gap in TP numbers -- TP1/TP3/TP5 clean with TP2/TP4 unevidenced is
  // NOT "three consecutive TPs", just three clean ones with holes between.
  const tagTypesByTp = new Map<number, CriteriaTagType[]>();
  for (const t of tags) {
    if (t.tp_number == null) continue;
    const list = tagTypesByTp.get(t.tp_number) ?? [];
    list.push(t.tag_type);
    tagTypesByTp.set(t.tp_number, list);
  }
  const evidencedTps = [...tagTypesByTp.keys()].sort((a, b) => a - b);
  let streak: number[] = [];
  for (const tp of evidencedTps) {
    const clean = tagTypesByTp.get(tp)!.every((t) => t === "strength");
    if (!clean) {
      streak = [];
      continue;
    }
    const prev = streak[streak.length - 1];
    streak = prev != null && tp === prev + 1 ? [...streak, tp] : [tp];
  }
  if (streak.length >= ATTENTION_STREAK_THRESHOLD) {
    const last = streak.slice(-ATTENTION_STREAK_THRESHOLD);
    flags.push({
      kind: "consistent_strength",
      detail: `Met above standard in ${last.length} consecutive evidenced TPs (TP${last.join(", TP")}) -- Pass B evidence in the descriptor's own words.`,
    });
  }

  // "a criterion where two tutors have marked the same candidate
  // differently" -- celta5_matrix only ever holds one current tutor
  // rating (whoever saved last wins), so this reads it off tp_feedback's
  // per-tutor authorship instead: different trainers' TP feedback on this
  // code disagreeing. A trainer who ever raised an action point on this
  // code reads as "not yet met" from them even if they also logged a
  // strength elsewhere -- ties go to the more cautious read.
  const verdictByTrainer = new Map<string, CriteriaTagType>();
  for (const t of tags) {
    if (!t.trainer_id) continue;
    if (t.tag_type === "action_point" || !verdictByTrainer.has(t.trainer_id)) {
      const existing = verdictByTrainer.get(t.trainer_id);
      if (existing !== "action_point") verdictByTrainer.set(t.trainer_id, t.tag_type);
    }
  }
  const distinctVerdicts = new Set(verdictByTrainer.values());
  if (verdictByTrainer.size >= 2 && distinctVerdicts.size >= 2) {
    flags.push({
      kind: "tutor_disagreement",
      detail: `${verdictByTrainer.size} tutors have given TP feedback on this code and don't agree -- some read it as a strength, others as an action point.`,
    });
  }

  return flags;
}

// ============================================================
// Trainer-only trajectory indicator: "currently tracking toward X".
// Purely advisory -- never shown to the trainee, never sets the real
// final grade. Needs a minimum spread of rated criteria before it says
// anything, to avoid a misleadingly confident read from TP1-2 alone.
// ============================================================

export type Trajectory = "Pass A" | "Pass B" | "Pass" | "Fail" | "not_enough_data";

const TRAJECTORY_MIN_RATED = 10; // out of 41 criteria

function trajectoryFromRated(rated: ("S+" | "S" | "N")[], minRated: number): Trajectory {
  if (rated.length < minRated) return "not_enough_data";
  if (rated.some((r) => r === "N")) return "Fail";

  const plusCount = rated.filter((r) => r === "S+").length;
  const ratio = plusCount / rated.length;

  if (ratio >= 0.75) return "Pass A";
  if (ratio >= 0.4) return "Pass B";
  return "Pass";
}

export function computeTrajectory(
  ratings: (("S+" | "S" | "N" | "X") | null)[]
): Trajectory {
  const rated = ratings.filter((r): r is "S+" | "S" | "N" => r != null && r !== "X");
  return trajectoryFromRated(rated, TRAJECTORY_MIN_RATED);
}

// Shared by the roster table, the Today dashboard's cohort card, and the
// portfolio sidebar/TP Hub -- extracted so all four call sites can't
// silently drift on what "criteria %" means (same achieved-count-over-41
// calc every one of them used to compute independently).
export function computeCriteriaPct(matrixByCode: Map<string, string | null | undefined>): number {
  const achievedCount = CELTA_CRITERIA_CODES.filter((code) => {
    const status = matrixByCode.get(code);
    return status === "S+" || status === "S";
  }).length;
  return Math.round((achievedCount / CELTA_CRITERIA_CODES.length) * 100);
}

// ============================================================
// Per-dimension trajectory -- the gradient bar in the grading spec
// (project_grading_feedback_trainer_awareness.md) shows Planning / Teaching
// / Awareness of learners / Reflection / Overall as five INDEPENDENT bars,
// matching GRADE_DESCRIPTORS' five dimensions above. computeTrajectory()
// only ever produces one number from all 41 codes, so it can't drive that
// alone. The full spec ties each bar's movement to a per-TP step function
// driven by an auto-tagging engine that doesn't exist yet -- but a real,
// non-fabricated interim version IS possible today: score each dimension
// off just ITS OWN criteria codes, using the exact same statistical method
// Overall already uses. The code->dimension split below is grounded
// directly in the booklet section titles (not invented): section 1 IS
// "Learners and Teachers..." awareness, section 4 IS "Planning...", section
// 5 IS "Developing Teaching Skills...". Reflection has no dedicated
// section, so it's assembled from the specific codes whose own wording is
// literally about reflecting/responding to feedback (4n, 5m, 5n) -- pulled
// out of Planning/Teaching so no code double-counts into two bars.
// Sections 2 and 3 (language analysis, language skills) don't map onto any
// of the five GRADE_DESCRIPTORS dimensions and are intentionally left out
// of every per-dimension bar; they still count toward Overall.
export type GradeDimension = "Planning" | "Teaching" | "Awareness of learners" | "Reflection" | "Overall";

export const GRADE_DIMENSION_ORDER: GradeDimension[] = [
  "Planning",
  "Teaching",
  "Awareness of learners",
  "Reflection",
  "Overall",
];

const DIMENSION_CRITERIA_CODES: Record<GradeDimension, readonly string[]> = {
  Planning: ["4a", "4b", "4c", "4d", "4e", "4f", "4g", "4h", "4i", "4j", "4k", "4l", "4m"],
  Teaching: ["5a", "5b", "5c", "5d", "5e", "5f", "5g", "5h", "5i", "5j", "5k", "5l"],
  "Awareness of learners": ["1a", "1b", "1c", "1d"],
  Reflection: ["4n", "5m", "5n"],
  Overall: CELTA_CRITERIA_CODES,
};

export function computeTrajectoryByDimension(
  ratingsByCode: Record<string, ("S+" | "S" | "N" | "X") | null | undefined>
): Record<GradeDimension, Trajectory> {
  const result = {} as Record<GradeDimension, Trajectory>;
  for (const dimension of GRADE_DIMENSION_ORDER) {
    const codes = DIMENSION_CRITERIA_CODES[dimension];
    const rated = codes
      .map((code) => ratingsByCode[code])
      .filter((r): r is "S+" | "S" | "N" => r != null && r !== "X");
    // Overall keeps its original, larger fixed threshold (out of 41); the
    // much smaller per-dimension groups (as few as 3 codes for Reflection)
    // need a threshold scaled to their own size instead, or they'd never
    // leave "not_enough_data" in practice.
    const minRated = dimension === "Overall" ? TRAJECTORY_MIN_RATED : Math.max(2, Math.ceil(codes.length / 2));
    result[dimension] = trajectoryFromRated(rated, minRated);
  }
  return result;
}

// ============================================================
// Grades Report -- Planning/Teaching Strengths & Action Points, matching
// the real center's actual output (traced verbatim from a real filled
// "Grades Report" document, 5 Aug 2026): short criterion labels, not the
// full booklet wording, grouped by section 4 ("Planning") vs everything
// else ("Teaching"), listing only criteria that stand out either way --
// "*all criteria not listed below is assumed to be 'To standard'".
// ============================================================

// The labels the Grades Report writes. Checked against a real report on
// 30 Aug 2026 (C10/2026 IH Istanbul): sixteen of eighteen matched exactly,
// and 4c/4f were trimmed to agree with it. Change one only against a real
// report, not by eye.
export const SHORT_CRITERIA_LABELS: Record<string, string> = {
  "1a": "needs awareness",
  "1b": "cultural awareness",
  "1c": "background awareness",
  "1d": "rapport/learner involvement",

  "2a": "TTT/language grading",
  "2b": "error-correction",
  "2c": "context",
  "2d": "language models",
  "2e": "clarifying language",
  "2f": "register",
  "2g": "language practice",

  "3a": "reading/listening",
  "3b": "speaking/writing",

  "4a": "stating aims",
  "4b": "staging",
  "4c": "materials",
  "4d": "materials prep",
  "4e": "procedure",
  "4f": "interaction",
  "4g": "variety and balance",
  "4h": "timing",
  "4i": "language analysis",
  "4j": "anticipated problems",
  "4k": "anticipated solutions",
  "4l": "terminology",
  "4m": "teamwork",
  "4n": "reflection on plans",

  "5a": "classroom arrangement",
  "5b": "grouping",
  "5c": "teaching techniques",
  "5d": "achieving aims",
  "5e": "material use",
  "5f": "instructions",
  "5g": "eliciting/concept-checking",
  "5h": "feedback",
  "5i": "pace",
  "5j": "monitoring",
  "5k": "timing",
  "5l": "portfolio",
  "5m": "self-reflection",
  "5n": "participation",
};

export interface StrengthsAndActionPoints {
  planningStrengths: string[];
  planningActionPoints: string[];
  teachingStrengths: string[];
  teachingActionPoints: string[];
}

// Cambridge's full wording, for consistency with the rest of the app --
// Stage 2, Stage 3, TP feedback and the appendices all render
// CRITERIA_LABELS, and the Grades Report was the only screen abbreviating.
//
// Ramy's real report (C10/2026 IH Istanbul) writes them short and code-first
// -- "4a) stating aims" -- and I briefly switched to match it, but he sent
// that document for its LAYOUT: "treat this only as the headings, I'm only
// showing you the headings, not the actual grades." So the wording decision
// stands where he last put it, and the format question is still open rather
// than answered by a document that was not offered as an answer.
function formatCriterion(code: string): string {
  return `${CRITERIA_LABELS[code] ?? code} (${code})`;
}

/**
 * Given a trainee's rating per criterion code (from celta5_matrix, typically
 * tutor_status_stage2 or tutor_status_stage3), buckets the notable ones into
 * the four lists the real Grades Report shows. Section 4 codes are
 * "Planning"; every other section is "Teaching" -- matches the real
 * document's split exactly. Unrated ("X"/null) or plain "S" criteria that
 * aren't otherwise notable are omitted, same as the real report.
 */
export type GradesReportList =
  | "planningStrengths"
  | "planningActionPoints"
  | "teachingStrengths"
  | "teachingActionPoints";

export type GradesReportListOverrides = Partial<Record<GradesReportList, { add?: string[]; remove?: string[] }>>;

/**
 * The four lists as the tutor has left them: derived from the matrix, then
 * their own additions and removals applied.
 *
 * Ramy, 30 Aug 2026: "the strengths and action points would be the S pluses
 * and the N's... or the weak S's." There is no weak-S rating -- the matrix
 * has S+, S, N and X -- so raising a borderline S is a judgement only a tutor
 * can make, and the derivation has to be curatable rather than final.
 *
 * Codes go in, Cambridge's wording comes out. An added criterion is rendered
 * from CRITERIA_LABELS exactly like a derived one, so nothing here can
 * introduce a paraphrase.
 */
export function applyGradesReportOverrides(
  derived: StrengthsAndActionPoints,
  overrides: GradesReportListOverrides
): StrengthsAndActionPoints {
  const out: StrengthsAndActionPoints = {
    planningStrengths: [],
    planningActionPoints: [],
    teachingStrengths: [],
    teachingActionPoints: [],
  };

  for (const key of Object.keys(out) as GradesReportList[]) {
    const { add = [], remove = [] } = overrides[key] ?? {};
    const removed = new Set(remove.map((c) => formatCriterion(c)));
    const kept = derived[key].filter((line) => !removed.has(line));

    // An added code that the derivation already produced is a no-op rather
    // than a duplicate -- a tutor can add a criterion before or after the
    // rating that would have pulled it in anyway.
    const added = add
      .filter((code) => CRITERIA_LABELS[code] || CELTA_CRITERIA_CODES.includes(code))
      .map((code) => formatCriterion(code))
      .filter((line) => !kept.includes(line));

    out[key] = [...kept, ...added];
  }

  return out;
}

/** A criterion on the report: the code is the identity, the label is derived. */
export interface CriterionLine {
  code: string;
  label: string;
}

export function criterionLine(code: string): CriterionLine {
  return { code, label: formatCriterion(code) };
}

export function computeStrengthsAndActionPoints(
  ratingsByCode: Record<string, "S+" | "S" | "N" | "X" | null | undefined>
): StrengthsAndActionPoints {
  const result: StrengthsAndActionPoints = {
    planningStrengths: [],
    planningActionPoints: [],
    teachingStrengths: [],
    teachingActionPoints: [],
  };

  for (const code of CELTA_CRITERIA_CODES) {
    const rating = ratingsByCode[code];
    const isPlanning = code.startsWith("4");
    const label = formatCriterion(code);

    // S+ only. Ramy's Grades Report design: "every criterion rated S+ in the
    // CELTA 5 matrix arrives as a strength, every N as an action point."
    //
    // This read `"S+" || "S"`, which contradicted the docstring directly
    // above it AND the footnote the screen prints immediately above these
    // lists -- "All criteria not listed below are assumed to be to standard."
    // We were printing that footnote and then listing the to-standard ones.
    // Not academic: across the live matrix there are 15 S+, 13 S and 9 N, so
    // roughly half of every strengths list was criteria the report says it
    // omits by definition. Found 30 Aug 2026 checking the design file.
    if (rating === "S+") {
      (isPlanning ? result.planningStrengths : result.teachingStrengths).push(label);
    } else if (rating === "N") {
      (isPlanning ? result.planningActionPoints : result.teachingActionPoints).push(label);
    }
    // "X"/null/plain-to-standard: omitted, per the real report's own footnote.
  }

  return result;
}

export interface StageFlagSuggestion {
  section: string;
  title: string;
  nCount: number;
}

// for-claude-code-tp-cycle-decisions.md: "the criteria-evidenced tally may
// auto-suggest a Stage 1 or Stage 3 judgement -- never Stage 2 (mandatory
// for everyone regardless of standing, nothing to suggest)." Suggestion
// only -- surfaced as a heads-up a tutor can act on or ignore, never
// auto-triggering a tutorial or a record. Tallies tutor_status_stage2
// (the one ongoing 41-criteria rating column populated from TP1 onward --
// tutor_status_stage3 only starts filling in once Stage 3 is already
// triggered, so using it here would be circular). "Don't invent a new
// scoring rubric" -- this counts existing ratings, nothing else. Threshold
// of 3 matches the evidence bar used elsewhere in this app (FOL's "three
// examples of the same problem").
const STAGE_FLAG_THRESHOLD = 3;

export function computeStageFlagSuggestions(
  ratingsByCode: Record<string, "S+" | "S" | "N" | "X" | null | undefined>
): StageFlagSuggestion[] {
  const suggestions: StageFlagSuggestion[] = [];
  for (const { section, title, codes } of CELTA_CRITERIA_SECTIONS) {
    const nCount = codes.filter((code) => ratingsByCode[code] === "N").length;
    if (nCount >= STAGE_FLAG_THRESHOLD) suggestions.push({ section, title, nCount });
  }
  return suggestions;
}

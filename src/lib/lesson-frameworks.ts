// The center's real named lesson-shape frameworks, used as context for the
// TP Points Library's AI generation prompt (framework-tier / TP3-4 content)
// so generated stage lists use real framework names and real stage
// vocabulary rather than invented ones. Verbatim from Ramy's own "Lesson
// Systems and Framework" reference document (6 Aug 2026 -- supersedes an
// earlier, less accurate transcription sourced from a shared Drive copy of
// a similarly-named but different doc; Receptive Skills was missing two
// real stages, Prediction and Reading/listening for specific info).
// Framework CHOICE itself follows a real decision tree from the same doc,
// not free judgement: language vs skills -> (for language) clarification/
// practice/both -> (for clarification-or-both) does the target language
// arise from a reading/listening text? yes=Text-based, no=Test-Teach-Test
// or PPP (practice-only=Language Practice) -> (for skills) receptive
// (reading/listening) vs productive (speaking/writing).
export const LESSON_FRAMEWORKS = [
  {
    name: "Text-based Presentation of Language",
    stages: [
      "Lead in/ Building context",
      "Reading or Listening task",
      "Highlighting target language",
      "Clarifying target language",
      "Language practice",
      "Feedback",
    ],
  },
  {
    name: "Language Practice",
    stages: [
      "Lead in (optional)",
      "Set up",
      "Controlled Practice activity",
      "Free(r) practice activity",
      "Feedback and error correction",
    ],
  },
  {
    name: "Test-Teach-Test Presentation of Language",
    stages: ["Lead in", "First Test (diagnostic)", "Teach (clarifying)", "Second Test", "Feedback"],
  },
  {
    name: "Present-Practice-Produce (PPP)",
    stages: ["Lead in", "Present: clarify and focus on TL", "Practice", "Production", "Error correction"],
  },
  {
    name: "Receptive Skills",
    stages: [
      "Lead in",
      "Prediction task",
      "Pre-teach vocabulary",
      "Reading/listening for gist",
      "Reading/listening for detail",
      "Reading/listening for specific information",
      "Post reading/listening task",
    ],
  },
  {
    name: "Productive Skills",
    stages: [
      "Lead in",
      "Preparing to write/speak",
      "Useful language",
      "Speaking/writing task",
      "Feedback/error correction",
    ],
  },
] as const;

export type LessonFrameworkName = (typeof LESSON_FRAMEWORKS)[number]["name"];

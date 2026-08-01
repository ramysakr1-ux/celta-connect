// The center's real named lesson-shape frameworks, used as context for the
// TP Points Library's AI generation prompt (framework-tier / TP3-4 content)
// so generated stage lists use real framework names and real stage
// vocabulary rather than invented ones. Verbatim from the center's own
// "Lesson Framework" reference document.
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
      "Pre-teach vocabulary",
      "Reading/listening for gist",
      "Reading/listening for detail",
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

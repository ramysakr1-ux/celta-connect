import type { ComponentType } from "react";

export interface InputSessionMeta {
  slug: string;
  title: string;
  minutes: string;
  kind: string; // e.g. "Loop input", "Group task", "Pairs with Drilling Techniques"
}

// Fixed, global content -- every session here is one component under
// ./sessions, registered once. Not a DB table: nothing here is centre-
// editable (matches the GTKY bank's own reasoning), and a course's actual
// timetable is what decides WHEN a candidate does one, not this list.
export const INPUT_SESSIONS: InputSessionMeta[] = [
  { slug: "teaching-literacy", title: "Teaching literacy", minutes: "45 min", kind: "Learner literacy" },
  { slug: "professional-development", title: "Professional development & career advice", minutes: "~30 min", kind: "Group task" },
  { slug: "drilling-techniques", title: "Drilling techniques", minutes: "~65 min", kind: "1 of 2 — pairs with Language Practice" },
  { slug: "language-practice", title: "Language practice", minutes: "~72 min", kind: "2 of 2 — pairs with Drilling Techniques" },
  { slug: "ppp", title: "Presentation, Practice, Production (PPP)", minutes: "45 min", kind: "Loop input" },
  { slug: "guided-discovery", title: "Guided discovery", minutes: "45 min", kind: "Loop input" },
  { slug: "functional-language", title: "Functional language", minutes: "45 min", kind: "Language awareness" },
  { slug: "receptive-skills", title: "Receptive skills", minutes: "45 min", kind: "Loop input · day two, input 2" },
  { slug: "listening", title: "Listening", minutes: "45 min", kind: "Loop input" },
  { slug: "teaching-vocabulary", title: "Teaching vocabulary and lexis", minutes: "45 min", kind: "Language awareness" },
  { slug: "tense-and-aspect", title: "Tense and aspect", minutes: "45 min", kind: "Language awareness" },
  { slug: "eliciting-and-concept-checking", title: "Eliciting and concept checking", minutes: "~60 min", kind: "Language awareness" },
  { slug: "connected-speech", title: "Connected speech", minutes: "45 min", kind: "Phonology, spoken aloud" },
  { slug: "sounds", title: "Sounds", minutes: "45 min", kind: "Phonology, spoken aloud" },
  { slug: "stress-and-intonation", title: "Stress and intonation", minutes: "45 min", kind: "Phonology, spoken aloud" },
  { slug: "mfp", title: "MFPA — meaning, form, pronunciation, appropriacy", minutes: "45 min", kind: "Language awareness" },
  { slug: "language-analysis", title: "Language analysis", minutes: "45 min", kind: "Day five, input 1" },
  { slug: "lesson-planning", title: "Lesson planning", minutes: "45 min", kind: "Day two, input 1" },
  { slug: "lesson-framework", title: "Lesson framework — finding your shape", minutes: "45 min", kind: "Loop input" },
  { slug: "test-teach-test", title: "Test-Teach-Test", minutes: "45 min", kind: "Loop input" },
  { slug: "text-based-teaching", title: "Text-based teaching", minutes: "45 min", kind: "Loop input" },
];

export async function loadInputSessionComponent(slug: string): Promise<ComponentType | null> {
  switch (slug) {
    case "teaching-literacy":
      return (await import("@/app/input-sessions/sessions/teaching-literacy")).default;
    case "professional-development":
      return (await import("@/app/input-sessions/sessions/professional-development")).default;
    case "drilling-techniques":
      return (await import("@/app/input-sessions/sessions/drilling-techniques")).default;
    case "language-practice":
      return (await import("@/app/input-sessions/sessions/language-practice")).default;
    case "ppp":
      return (await import("@/app/input-sessions/sessions/ppp")).default;
    case "guided-discovery":
      return (await import("@/app/input-sessions/sessions/guided-discovery")).default;
    case "functional-language":
      return (await import("@/app/input-sessions/sessions/functional-language")).default;
    case "receptive-skills":
      return (await import("@/app/input-sessions/sessions/receptive-skills")).default;
    case "listening":
      return (await import("@/app/input-sessions/sessions/listening")).default;
    case "teaching-vocabulary":
      return (await import("@/app/input-sessions/sessions/teaching-vocabulary")).default;
    case "tense-and-aspect":
      return (await import("@/app/input-sessions/sessions/tense-and-aspect")).default;
    case "eliciting-and-concept-checking":
      return (await import("@/app/input-sessions/sessions/eliciting-and-concept-checking")).default;
    case "connected-speech":
      return (await import("@/app/input-sessions/sessions/connected-speech")).default;
    case "sounds":
      return (await import("@/app/input-sessions/sessions/sounds")).default;
    case "stress-and-intonation":
      return (await import("@/app/input-sessions/sessions/stress-and-intonation")).default;
    case "mfp":
      return (await import("@/app/input-sessions/sessions/mfp")).default;
    case "language-analysis":
      return (await import("@/app/input-sessions/sessions/language-analysis")).default;
    case "lesson-planning":
      return (await import("@/app/input-sessions/sessions/lesson-planning")).default;
    case "lesson-framework":
      return (await import("@/app/input-sessions/sessions/lesson-framework")).default;
    case "test-teach-test":
      return (await import("@/app/input-sessions/sessions/test-teach-test")).default;
    case "text-based-teaching":
      return (await import("@/app/input-sessions/sessions/text-based-teaching")).default;
    default:
      return null;
  }
}

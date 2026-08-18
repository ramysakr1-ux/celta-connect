// Not a Server Action -- kept out of volunteer-signup-actions.ts ("use
// server") because that file may only export async functions. Verbatim
// from Volunteer Sign-Up Desktop.dc.html's `questions` fixture. All six
// are optional -- "nothing here is marked... a blank answer moves on."
export const SIGNUP_QUESTIONS = [
  "How long have you studied English?",
  "Why are you learning English now?",
  "What is hardest for you?",
  "What do you enjoy?",
  "Where do you use English?",
  "Anything we should know?",
];

// Verbatim from Volunteer Sign-Up.dc.html screen 4 -- eight prompts that
// escalate, each chosen to elicit a specific tense/form/sound so the same
// two-to-three minutes serves the learner profile, language analysis and
// pronunciation work at once. Recorded as ONE continuous file: "Next
// question" advances which prompt is shown, the recording never stops.
export const RECORDING_PROMPTS = [
  { question: "What is your name? Where are you from?", elicits: "warm-up" },
  { question: "What is your job? Tell me a little about it.", elicits: "present simple" },
  { question: "What do you do on a normal day?", elicits: "present simple, frequency, third person -s" },
  { question: "What did you do yesterday?", elicits: "past simple, regular -ed endings" },
  { question: "Tell me about a place you like.", elicits: "adjectives, there is / there are" },
  { question: "What are you doing next week?", elicits: "future forms, going to, present continuous" },
  { question: "Why do you want to learn English?", elicits: "reasons, because, want to" },
  { question: "If you could change one thing about your city, what would it be?", elicits: "second conditional" },
];

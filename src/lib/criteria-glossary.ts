// project_grading_feedback_trainer_awareness.md §2 "auto-tagging engine" --
// as a trainer types a TP feedback bullet (e.g. "reduce your TTT"), the
// matching criterion code should silently land on it, no click/popup.
// "Trained on two layers: (1) official CELTA 5 criteria wording, (2) an
// expandable/ownable glossary of real trainer shorthand... seed it, then
// grow it from Ramy's trainers' actual phrasing." That memory's own
// "cost/build order" resolution: glossary-first and free, in-app, runs
// instant; an LLM fallback is explicitly deferred (not built here) because
// unlike this app's existing one-shot-per-document AI features, an
// auto-tagger would fire continuously -- near-every bullet, every trainer,
// every TP, every course -- and that call volume is the real cost.
//
// Deliberately NOT full-sentence fuzzy-matching against CRITERIA_GUIDANCE's
// booklet wording (src/lib/celta-criteria.ts) -- a one-line trainer bullet
// rarely reuses a guidance sentence's exact phrasing, and loose word-
// overlap against long sentences that all share common words ("learners",
// "materials", "activities") would over-match constantly, which is worse
// for trust than under-matching. Instead this is a curated table of short,
// distinctive terms -- official terminology and real trainer shorthand
// both included -- matched as whole-word/phrase substrings. It's meant to
// grow from real trainer phrasing over time, same as the spec asks.
export const CRITERIA_GLOSSARY: Record<string, string[]> = {
  // Section 1 -- learners and context
  rapport: ["1d"],
  "needs analysis": ["1a"],
  "learner needs": ["1a"],
  cultural: ["1b"],
  backgrounds: ["1c"],
  "prior learning": ["1c"],

  // Section 2 -- language analysis and awareness
  ttt: ["2a", "5i"],
  "teacher talking time": ["2a", "5i"],
  stt: ["3b", "5b"],
  "student talking time": ["3b", "5b"],
  "graded language": ["2a"],
  "grading language": ["2a"],
  echo: ["2b"],
  "error correction": ["2b"],
  "delayed correction": ["2b"],
  reformulation: ["2b"],
  ccqs: ["2e"],
  ccq: ["2e"],
  "concept check": ["2e"],
  "meaning check": ["2e"],
  drilling: ["2d"],
  drill: ["2d"],
  "model sentence": ["2d"],
  register: ["2f"],
  "controlled practice": ["2g"],
  "freer practice": ["2g"],

  // Section 3 -- skills
  gist: ["3a"],
  scan: ["3a"],
  skim: ["3a"],
  "receptive skills": ["3a"],
  "productive skills": ["3b"],

  // Section 4 -- planning
  "lesson aim": ["4a"],
  "main aim": ["4a"],
  "subsidiary aim": ["4a"],
  staging: ["4e", "4b"],
  "stage order": ["4b"],
  materials: ["4c"],
  copyright: ["4d"],
  "interaction pattern": ["4f"],
  timing: ["4h"],
  "time-box": ["4h"],
  timeboxing: ["4h"],
  "anticipated problems": ["4j"],
  "anticipated difficulties": ["4j"],
  terminology: ["4l"],
  metalanguage: ["4l"],
  "tp planning": ["4m"],

  // Section 5 -- teaching skills and professionalism
  seating: ["5a"],
  "classroom arrangement": ["5a"],
  groupwork: ["5b"],
  pairwork: ["5b"],
  icqs: ["5f"],
  icq: ["5f"],
  instructions: ["5f"],
  eliciting: ["5g"],
  elicit: ["5g"],
  questioning: ["5g"],
  "feedback on task": ["5h"],
  pace: ["5i"],
  pacing: ["5i"],
  monitoring: ["5j"],
  monitor: ["5j"],
  "self-evaluation": ["4n", "5m"],
  reflection: ["4n"],
};

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9' -]/g, " ")} `;
}

// Whole-phrase substring match, padded with spaces so e.g. "pace" doesn't
// fire inside "pacemaker" -- not that CELTA feedback tends to mention
// pacemakers, but the padding costs nothing and keeps short terms honest.
export function matchCriteriaCodes(text: string): string[] {
  const normalized = normalize(text);
  const codes = new Set<string>();
  for (const [term, termCodes] of Object.entries(CRITERIA_GLOSSARY)) {
    if (normalized.includes(` ${term} `)) {
      for (const code of termCodes) codes.add(code);
    }
  }
  return [...codes];
}

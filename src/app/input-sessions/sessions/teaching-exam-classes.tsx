"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";

// design_handoff_input_sessions_2 §2b -- "Teaching exam classes", slug
// teaching-exam-classes, 50 minutes, last week.
//
// Deliberately light: it sits after the final TP. The exam explorer is
// theirs to wander; the scenarios are where it earns its place, because
// every trainee gets asked one of those corridor questions in their first
// month of work -- which is also why a pick locks on the first click.

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const RED = "oklch(45% 0.15 27)";
const WARM = "oklch(30% 0.042 58)";
const GOLD_INK = "oklch(44% 0.1 68)";
const MUTED = "oklch(51% 0.017 70)";

const CEFR: { lvl: string; name: string; hue: string; hint: string; d: string }[] = [
  {
    lvl: "A1",
    name: "Beginner",
    hue: MUTED,
    hint: "pre-A1 Starters just below",
    d: "Can understand and use very basic phrases, introduce themselves and ask simple questions. Cambridge: Pre-A1 Starters sits just below this.",
  },
  {
    lvl: "A2",
    name: "Elementary",
    hue: TEAL,
    hint: "Movers · Flyers · A2 Key",
    d: "Can communicate in simple, routine tasks on familiar topics. Cambridge: Movers, Flyers and A2 Key (KET) sit here.",
  },
  {
    lvl: "B1",
    name: "Intermediate",
    hue: WARM,
    hint: "B1 Preliminary",
    d: "Can deal with most situations while travelling, describe experiences and give reasons for opinions. Cambridge: B1 Preliminary (PET). IELTS, TOEFL and PTE candidates often start scoring in this range.",
  },
  {
    lvl: "B2",
    name: "Upper-intermediate",
    hue: GOLD_INK,
    hint: "B2 First — the most taken",
    d: "Can interact fluently with native speakers and produce clear, detailed text. Cambridge: B2 First (FCE) — the most widely taken Cambridge exam.",
  },
  {
    lvl: "C1",
    name: "Advanced",
    hue: GOLD,
    hint: "C1 Advanced",
    d: "Can use language flexibly for social, academic and professional purposes. Cambridge: C1 Advanced (CAE) — accepted by many universities and employers.",
  },
  {
    lvl: "C2",
    name: "Proficiency",
    hue: RED,
    hint: "C2 Proficiency",
    d: "Can understand virtually everything and express themselves spontaneously with precision. Cambridge: C2 Proficiency (CPE) — near-native level.",
  },
];

const ACRONYMS = [
  { term: "CEFR", definition: "Common European Framework of Reference for Languages" },
  { term: "YLE", definition: "Young Learners English (Starters, Movers, Flyers)" },
  { term: "KET", definition: "Key English Test — now called A2 Key" },
  { term: "PET", definition: "Preliminary English Test — now called B1 Preliminary" },
  { term: "FCE", definition: "First Certificate in English — now called B2 First" },
  { term: "CAE", definition: "Certificate in Advanced English — now called C1 Advanced" },
  { term: "CPE", definition: "Certificate of Proficiency in English — now called C2 Proficiency" },
  { term: "IELTS", definition: "International English Language Testing System" },
  { term: "TOEFL", definition: "Test of English as a Foreign Language" },
  { term: "PTE", definition: "Pearson Test of English" },
  { term: "TKT", definition: "Teaching Knowledge Test" },
];

interface Exam {
  acro: string;
  full: string;
  hue: string;
  level: string;
  age: string;
  skills: string;
  format: string;
  fact: string;
}
const EXAMS: Exam[] = [
  { acro: "YLE", full: "Starters · Movers · Flyers", hue: MUTED, level: "Pre-A1 – A2", age: "6–12", skills: "Listening, Reading & Writing, Speaking", format: "Paper or computer", fact: "No pass or fail — candidates earn 1–5 shields, so every child comes away with something." },
  { acro: "A2 Key", full: "KET — Key English Test", hue: TEAL, level: "A2", age: "12+", skills: "Reading & Writing, Listening, Speaking", format: "Paper or computer", fact: "Often a learner’s first “proper” international exam." },
  { acro: "B1 Preliminary", full: "PET — Preliminary English Test", hue: WARM, level: "B1", age: "14+", skills: "Reading, Writing, Listening, Speaking", format: "Paper or computer", fact: "A common target for school-leaver exchange programmes." },
  { acro: "B2 First", full: "FCE — First Certificate in English", hue: GOLD_INK, level: "B2", age: "16+", skills: "Reading, Writing, Listening, Use of English, Speaking", format: "Paper or computer", fact: "The single most widely taken Cambridge exam in the world." },
  { acro: "C1 Advanced", full: "CAE — Certificate in Advanced English", hue: GOLD, level: "C1", age: "16+", skills: "Reading, Writing, Listening, Use of English, Speaking", format: "Paper or computer", fact: "Accepted by thousands of universities and employers worldwide." },
  { acro: "C2 Proficiency", full: "CPE — Certificate of Proficiency", hue: RED, level: "C2", age: "18+", skills: "Reading, Writing, Listening, Use of English, Speaking", format: "Paper or computer", fact: "Near-native level — some questions trip up native speakers too." },
  { acro: "IELTS", full: "International English Language Testing System", hue: WARM, level: "B1–C2 · band 0–9", age: "16+", skills: "Listening, Reading, Writing, Speaking (face-to-face)", format: "Paper or computer · Academic or General Training", fact: "The Speaking test is a real conversation with an examiner — no computer involved." },
  { acro: "TOEFL iBT", full: "Test of English as a Foreign Language", hue: RED, level: "B1–C2 · score 0–120", age: "16+", skills: "Reading, Listening, Speaking, Writing — all on computer", format: "Computer-based", fact: "Speaking answers are recorded and sent off for scoring — you never talk to a live examiner." },
  { acro: "PTE Academic", full: "Pearson Test of English", hue: GOLD_INK, level: "A2–C2 · score 10–90", age: "16+", skills: "All four skills, fully computer-based and AI-scored", format: "Computer-based", fact: "Results are often ready in under 48 hours — the fastest of the major exams." },
];

const SCENARIOS: ChoiceScenario[] = [
  {
    text: "“I’m 9 and I want to learn English through games — nothing scary!”",
    choices: ["YLE (Starters / Movers)", "C2 Proficiency", "PTE Academic"],
    correctIndex: 0,
    feedback: "Young Learners exams are built for this age: shields, not grades, and tasks that feel like play.",
  },
  {
    text: "“I want to study for a Bachelor’s degree in the United States.”",
    choices: ["A2 Key", "TOEFL iBT", "YLE"],
    correctIndex: 1,
    feedback: "TOEFL is the exam US universities know best; IELTS is widely accepted too, but TOEFL is the safe first answer.",
  },
  {
    text: "“I need a fast result — I have a visa deadline in one week and I’m comfortable on a computer.”",
    choices: ["PTE Academic", "C2 Proficiency", "B1 Preliminary"],
    correctIndex: 0,
    feedback: "PTE results usually land inside 48 hours, and it is accepted for most visa routes.",
  },
  {
    text: "“I’m B2 and I want a widely recognised certificate that doesn’t expire.”",
    choices: ["B2 First", "IELTS", "A2 Key"],
    correctIndex: 0,
    feedback: "Cambridge certificates do not expire; IELTS and TOEFL scores are usually only accepted for two years.",
  },
  {
    text: "“I’m moving to the UK for a skilled worker visa and need an official score. Face-to-face speaking is fine.”",
    choices: ["IELTS", "TOEFL iBT", "YLE"],
    correctIndex: 0,
    feedback: "IELTS for UKVI is the standard route, and its speaking test is a live interview.",
  },
];

const ROLES: { title: string; intro: string; points: string[] }[] = [
  {
    title: "Speaking examiner",
    intro:
      "In Cambridge exams, speaking is usually assessed by two examiners: an interlocutor, who runs the conversation and asks the questions, and an assessor, who sits silently and scores. IELTS speaking is one examiner, face-to-face, following a structured script.",
    points: [
      "Requirements: a recognised teaching qualification (CELTA is enough to apply) and usually three years’ relevant experience.",
      "You apply through an approved centre — British Council, a Cambridge-authorised centre, IDP.",
      "Paid training, then standardisation: practice sessions scored against a benchmark until you are reliably consistent.",
      "You sit in on live exams before being signed off to examine alone.",
      "Examiners are re-standardised regularly so everyone keeps marking to the same standard.",
    ],
  },
  {
    title: "Writing and other papers",
    intro:
      "Writing (and Reading or Listening, where relevant) is usually marked remotely, online, often from home — a popular route for teachers who want flexible exam-season income.",
    points: [
      "Same starting point: a teaching qualification and relevant experience.",
      "Apply via Cambridge English, the IELTS partners, or ETS / Pearson depending on the exam.",
      "Training is about applying the mark scheme consistently — many sample scripts, much moderation.",
      "You periodically re-mark “seeded” scripts with known scores to prove you are still calibrated.",
      "TKT (Teaching Knowledge Test) is a useful extra credential if you want to broaden into assessment work.",
    ],
  },
];

const CLOSING = [
  "Which exam would you feel most confident teaching tomorrow?",
  "Which one do you want to find out more about?",
  "Would you consider training as an examiner — speaking or writing?",
];

export default function TeachingExamClassesSession() {
  return (
    <SessionShell
      eyebrow="Input session · 50 minutes · the wider profession · last week"
      title="Teaching exam classes"
      intro="Young learners to C2, Cambridge, IELTS, TOEFL and PTE — what each one is, who it is for, and which you would recommend when a student asks in the corridor. Then the other side of the desk: how teachers become examiners."
      agenda={[
        { time: "0–8", title: "The CEFR ladder", spine: TEAL },
        { time: "8–16", title: "Decode the acronyms", spine: TEAL },
        { time: "16–31", title: "Exam explorer", spine: WARM },
        { time: "31–39", title: "Which exam?", spine: GOLD },
        { time: "39–49", title: "Being an examiner", spine: WARM },
        { time: "49–50", title: "Wrap-up", spine: RED },
      ]}
    >
      <RunningThisSession>
        Deliberately light — it sits in the last week, after the final TP. The exam explorer is theirs to wander through at
        their own pace; don’t walk them through every card. The scenarios are where the session earns its place: every
        trainee will be asked one of these questions in their first month of work.
      </RunningThisSession>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">1 · The CEFR ladder · 8 minutes</h2>
          <p className="text-xs text-muted">
            Bottom rung up. Click each for the descriptor — and at each one, name a learner from your own TP who sat there.
          </p>
        </div>
        {/* Drawn bottom-up, the way a ladder is climbed. */}
        <div className="flex flex-col-reverse gap-2">
          {CEFR.map((c) => (
            <LadderRung key={c.lvl} rung={c} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">2 · Decode the acronyms · 8 minutes</h2>
          <p className="text-xs text-muted">
            Half the profession says FCE, half says B2 First. Job adverts and parents use both, so you need to recognise
            both.
          </p>
        </div>
        <MatchTermsExercise terms={ACRONYMS} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">3 · Exam explorer · 15 minutes</h2>
          <p className="text-xs text-muted">
            Nine exams, yours to wander. Find the one you would least like to teach, and be ready to say why.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMS.map((e) => (
            <ExamCard key={e.acro} exam={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">4 · Which exam? · 8 minutes</h2>
          <p className="text-xs text-muted">
            Five corridor questions. Your pick locks on the first click — in the corridor there is no second guess.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {SCENARIOS.map((s) => (
            <ChoiceScenarioCard key={s.text} scenario={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">5 · Being an examiner · 10 minutes</h2>
          <p className="text-xs text-muted">The other side of the desk, and a real route into paid work with a CELTA.</p>
        </div>
        <div className="flex flex-col gap-2">
          {ROLES.map((r) => (
            <RoleAccordion key={r.title} role={r} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-[8px] border border-dashed p-5" style={{ borderColor: GOLD }}>
          <h2 className="font-serif text-lg font-semibold text-ink">You can now tell your KET from your CAE</h2>
          <p className="text-[12.5px] leading-relaxed text-ink">
            — and an IELTS band from a TOEFL score. That is more than most first-year teachers can say, and it is the
            question you will be asked most.
          </p>
        </div>
        <ol className="flex flex-col gap-2">
          {CLOSING.map((q, i) => (
            <li key={q} className="flex items-start gap-3 rounded-[8px] border border-border bg-card px-4 py-3">
              <span className="flex size-5 flex-none items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink">{q}</span>
            </li>
          ))}
        </ol>
      </section>

      <TrainerNotes
        notes={[
          {
            label: "0–8 · Ladder from the bottom",
            text: "Open the rungs bottom-up and ask, at each one, which of their TP learners sat there. The ladder is only useful if it attaches to people they have taught.",
          },
          {
            label: "8–16 · Acronyms, old and new names",
            text: "Half the room will know the old names (FCE, CAE), half the new (B2 First, C1 Advanced). Both are still used in job adverts and by parents; they need to recognise both.",
          },
          {
            label: "16–31 · Explorer, hands off",
            text: 'Do not present the cards. Set the task — "find the exam you would least like to teach, and say why" — and let them browse. Fifteen minutes; collect three answers.',
          },
          {
            label: "31–39 · Scenarios lock",
            text: "The picks lock on first click on purpose: in the corridor there is no second guess. Where they get one wrong, the feedback names the reason — read one or two aloud.",
          },
          {
            label: "39–49 · Examining is a real option",
            text: "Be concrete about money and timing: exam seasons, day rates at your own centre, how long standardisation took you. If anyone in the room examines, hand over.",
          },
          {
            label: "49–50 · Close",
            text: "Three questions, no feedback. This is the last input session before course close; leave them with something to look up tonight.",
          },
        ]}
      />
    </SessionShell>
  );
}

function LadderRung({ rung }: { rung: (typeof CEFR)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="flex flex-col gap-1 rounded-[8px] border-l-[4px] border border-border bg-card px-4 py-3 text-left"
      style={{ borderLeftColor: rung.hue }}
    >
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2.5">
          <span className="font-serif text-base font-semibold" style={{ color: rung.hue }}>
            {rung.lvl}
          </span>
          <span className="text-[12.5px] font-semibold text-ink">{rung.name}</span>
        </span>
        <span className="text-[10.5px] text-muted">{rung.hint}</span>
      </span>
      {open ? <span className="border-t border-border pt-1.5 text-[11.5px] leading-relaxed text-ink">{rung.d}</span> : null}
    </button>
  );
}

function ExamCard({ exam }: { exam: Exam }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="flex h-full flex-col gap-1 rounded-[8px] border border-t-[3px] border-border bg-card p-3.5 text-left"
      style={{ borderTopColor: exam.hue }}
    >
      <span className="font-serif text-[15px] font-semibold text-ink">{exam.acro}</span>
      <span className="text-[10.5px] text-muted">{exam.full}</span>
      <span className="text-[11px] font-semibold" style={{ color: exam.hue }}>
        {exam.level}
      </span>
      {open ? (
        <span className="mt-1 flex flex-col gap-1 border-t border-border pt-2 text-[11px] leading-relaxed text-ink">
          <span>
            <strong className="font-semibold">Age:</strong> {exam.age}
          </span>
          <span>
            <strong className="font-semibold">Skills:</strong> {exam.skills}
          </span>
          <span>
            <strong className="font-semibold">Format:</strong> {exam.format}
          </span>
          <span className="italic text-primary">{exam.fact}</span>
        </span>
      ) : (
        <span className="mt-auto pt-1.5 text-[10.5px] font-semibold text-primary">Click to open ▾</span>
      )}
    </button>
  );
}

function RoleAccordion({ role }: { role: (typeof ROLES)[number] }) {
  return (
    <RevealCard
      variant="list"
      question={role.title}
      answer={`${role.intro}\n\n• ${role.points.join("\n• ")}`}
    />
  );
}

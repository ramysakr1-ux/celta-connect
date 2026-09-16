"use client";

import { SessionShell } from "@/components/input-sessions/session-shell";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";

// design_handoff_input_sessions_2 §4 -- "Teaching Speaking Input Session",
// one of the five finished designs that had never been ported, so its day-12
// card on a candidate's Resources tab had nothing behind it.
//
// A loop input: the session is staged exactly like the lesson it teaches --
// prepare ideas, get useful language, do the task, get feedback -- and the
// shape is only named at the debrief. Cambridge treats speaking and writing
// as ONE criterion (3b), not two; this is the speaking half of that pair,
// and Teaching Writing is the other.

const TERMS: { name: string; desc: string }[] = [
  {
    name: "STT vs TTT",
    desc: "Student Talking Time vs Teacher Talking Time. In a speaking lesson the aim is maximum STT — give clear instructions fast, then get out of the way.",
  },
  {
    name: "Task achievement",
    desc: "Whether the task actually got done — a discussion reached a decision, an info-gap found all the differences — independent of how accurate the language was.",
  },
  {
    name: "Monitoring",
    desc: "Listening in on pairs or groups while they work, without interrupting. The teacher notes good and problem language for feedback afterwards.",
  },
  {
    name: "Delayed error correction",
    desc: "Noting errors during the task and dealing with them once it finishes, rather than stopping learners mid-sentence to fix them.",
  },
  {
    name: "Information gap",
    desc: "Each speaker holds information the other doesn’t have, so there’s a genuine reason to talk — unlike a scripted dialogue both partners can already read.",
  },
  {
    name: "Communicative output",
    desc: "Real, purposeful language use — as opposed to the accuracy-focused mechanical practice covered in Drilling. This is the stage that comes after.",
  },
];

const TASK_TYPES: { name: string; example: string; bestFor: string }[] = [
  {
    name: "Information-gap",
    example: "Two learners each have half a picture, schedule, or map; they describe their half to find the differences.",
    bestFor: "Practising specific target language while guaranteeing a genuine need to speak.",
  },
  {
    name: "Role-play",
    example:
      "Each learner gets a role card and situation — a customer complaining, a doctor’s appointment — and improvises within it.",
    bestFor: "Functional language and real-world transactional situations.",
  },
  {
    name: "Discussion",
    example: "Open questions on a topic learners have opinions on, with no single right answer.",
    bestFor: "Fluency and free practice, usually near the end of a lesson.",
  },
  {
    name: "Problem-solving / ranking",
    example: "A group ranks items or agrees on a solution together — a survival scenario, allocating a budget.",
    bestFor: "Extended negotiation, natural turn-taking, language of agreeing and disagreeing.",
  },
  {
    name: "Describe and draw / spot the difference",
    example:
      "One learner describes an image while their partner draws it, or two similar pictures are compared for differences.",
    bestFor: "Lower levels, concrete vocabulary, and high engagement with low language demands.",
  },
];

const DETAILS: { q: string; a: string }[] = [
  {
    q: "Should useful language always be pre-taught before a productive skills task?",
    a: "No — it’s optional, and many lessons skip it entirely if the target language was already covered earlier.",
  },
  {
    q: "What comes before language in preparing to speak or write?",
    a: "Ideas and content — engaging with the topic itself, something to actually say.",
  },
  {
    q: "What are the two parts of feedback at the end?",
    a: "Task achievement first (content), then delayed language feedback (form) — never the other way round.",
  },
  {
    q: "Why does the teacher get out of the way during the task?",
    a: "To maximise STT and let monitoring happen instead of interrupting — every minute of TTT is a minute a learner isn’t producing language.",
  },
];

const MONITORING: ChoiceScenario[] = [
  {
    text: "Two pairs never actually decided on a restaurant — they got distracted and ran out of time.",
    choices: ["Task achievement", "Language feedback"],
    correctIndex: 0,
    feedback: "Task achievement — worth raising in feedback on the task itself, separate from any language point.",
  },
  {
    text: 'Half the class said "I am agree" instead of "I agree."',
    choices: ["Task achievement", "Language feedback"],
    correctIndex: 1,
    feedback: "Language feedback — a common form error, worth a quick delayed correction slot with the whole class.",
  },
  {
    text: 'One pair used "actually" really naturally to introduce a surprising fact.',
    choices: ["Task achievement", "Language feedback"],
    correctIndex: 1,
    feedback: "Language feedback — but positive. Highlighting good language matters as much as fixing errors.",
  },
  {
    text: "A student went completely silent when it was their turn; their partner did all the talking.",
    choices: ["Task achievement", "Language feedback"],
    correctIndex: 0,
    feedback: "Task achievement / participation — worth noting for feedback, but it isn’t a language point.",
  },
];

const CORRECT_ORDER = ["Lead-in", "Preparing to speak", "Useful language", "Task", "Feedback"];
const SHUFFLED = ["Task", "Lead-in", "Feedback", "Useful language", "Preparing to speak"];

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const RED = "oklch(45% 0.15 27)";
const MUTED = "oklch(51% 0.017 70)";

export default function TeachingSpeakingSession() {
  return (
    <SessionShell
      eyebrow="Input session · 45 minutes · loop input"
      title="Teaching speaking — staged the way you’ll teach it"
      intro="This session is staged exactly like the lesson it teaches: prepare ideas, get useful language, do the task, get feedback. Do the stages first — the debrief afterwards is where it gets named."
      agenda={[
        { time: "0–2", title: "Lead-in", spine: GOLD },
        { time: "2–5", title: "Preparing to speak", spine: TEAL },
        { time: "5–13", title: "Useful language", spine: TEAL },
        { time: "13–20", title: "Task: five task types", spine: TEAL },
        { time: "20–28", title: "Task: read and check", spine: TEAL },
        { time: "28–36", title: "Task: detail + classify", spine: TEAL },
        { time: "36–43", title: "Debrief: order the stages", spine: MUTED },
        { time: "43–45", title: "Trainer notes", spine: RED },
      ]}
    >
      <div className="flex items-start gap-3 rounded-[8px] border border-border bg-card p-4">
        <span className="flex-none rounded-[5px] bg-primary px-2 py-1 text-label font-bold text-primary-foreground">3b</span>
        <p className="text-meta leading-relaxed text-ink">
          Helping learners to produce oral language — a dedicated pass on speaking fluency. Cambridge combines speaking and
          writing as one criterion (3b), not two.
        </p>
      </div>

      <RunningThisSession>
        Don’t name “the Productive Skills framework” until the debrief. Let trainees move through preparing ideas, getting
        useful language, doing the task and getting feedback without knowing that’s the shape — the reveal is the point.
      </RunningThisSession>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-h3 font-semibold text-ink">Stage 1 · Lead-in</h2>
        <RevealCard variant="hero" question="What is a productive skill?" answer="Speaking or writing." />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">Stage 2 · Preparing to speak</h2>
        <p className="text-meta leading-relaxed text-ink">
          Think of a real opinion or story you’d actually want to share about your journey into teaching. Don’t write it
          down yet — just have it ready.
        </p>
        <p className="text-label italic text-muted">A minute alone, then compare with a partner.</p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stage 3 · Six terms you’ll need</h2>
          <p className="text-label text-muted">Click each to reveal.</p>
        </div>
        <div className="flex flex-col gap-2">
          {TERMS.map((t) => (
            <RevealCard key={t.name} question={t.name} answer={t.desc} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stage 4 · Now do it — pick the right task type</h2>
          <p className="text-label text-muted">
            Using the opinion or story from Stage 2: which task type below would actually get a partner to hear it? Click
            each to see what it’s for, then tell your partner which you’d pick and why.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {TASK_TYPES.map((t) => (
            <RevealCard key={t.name} question={t.name} answer={`${t.example} Best for: ${t.bestFor}`} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-h3 font-semibold text-ink">
          Stage 4, continued · Read the text and check whether your ideas were right
        </h2>
        <article className="flex flex-col gap-3 rounded-[8px] border border-border bg-card p-5">
          <h3 className="font-serif text-h3 font-semibold text-ink">Staging a productive skills lesson</h3>
          <p className="text-meta leading-relaxed text-ink">
            A productive skills lesson doesn’t open with instructions. It opens by creating interest in the topic and
            giving learners something to think or feel before they need any language for it — ideas and content come
            first, because nobody can speak or write about a topic they haven’t engaged with yet.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            Useful language comes next, but only if it’s needed — a handful of words or phrases learners are missing to do
            the task, not a full presentation. Many productive skills lessons skip this stage entirely if the target
            language was already covered earlier in the day.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            The task itself is where the teacher gets out of the way. Clear instructions, a genuine information gap or a
            real opinion to share, then the teacher circulates and monitors without interrupting — every minute of teacher
            talk here is a minute a learner isn’t producing language.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            Feedback closes the lesson in two parts. First, feedback on whether the task was actually achieved — content,
            not language. Only after that does the teacher share language noticed while monitoring: what worked, and what
            to fix, dealt with once the task is over rather than mid-flow.
          </p>
        </article>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stage 5 · Look again, then check with your partner</h2>
        </div>
        <div className="flex flex-col gap-2">
          {DETAILS.map((d) => (
            <RevealCard key={d.q} question={d.q} answer={d.a} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">
            Stage 5, continued · Content feedback, or language feedback?
          </h2>
          <p className="text-label text-muted">Four things a teacher notices while monitoring a task. Choose for each.</p>
        </div>
        <div className="flex flex-col gap-2">
          {MONITORING.map((s) => (
            <ChoiceScenarioCard key={s.text} scenario={s} />
          ))}
        </div>
      </section>

      <OrderExercise correctOrder={CORRECT_ORDER} shuffled={SHUFFLED} />

      <TrainerNotes
        runningNote="Correct order: Lead-in → Preparing to speak → Useful language → Task → Feedback. This is the exact Productive Skills shape from Lesson Framework — say so explicitly at the reveal; trainees should recognise it immediately from that earlier session."
        notes={[
          {
            label: "Monitoring answers",
            text: "1 = task achievement (didn't finish), 2 = language (form error, common enough to deal with as a class), 3 = language (positive — highlight good language too, not just errors), 4 = task achievement (participation imbalance, not a language point).",
          },
          {
            label: "Stage 2 has to be real",
            text: "Preparing to speak only works if trainees actually think of something real — don't let them skip straight to Stage 3. The point is to feel that ideas came before language, exactly as in the framework.",
          },
          {
            label: "At the debrief, if time allows",
            text: "Ask trainees to name which stage of today's session was optional in a real lesson (useful language) and which one they, as teachers, disappear from (task) — both should fall out naturally from what they just lived through.",
          },
          {
            label: "The misreading to watch for",
            text: 'Trainees conflating "communicative" with "no error correction at all" — the point of delayed correction is timing, not avoidance.',
          },
        ]}
      />
    </SessionShell>
  );
}

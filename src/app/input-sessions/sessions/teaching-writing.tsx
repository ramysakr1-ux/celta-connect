"use client";

import { SessionShell } from "@/components/input-sessions/session-shell";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { VideoReveal } from "@/components/input-sessions/video-reveal";

// design_handoff_input_sessions_2 §4 -- "Teaching Writing Input Session",
// the fifth of the never-ported designs; its day-12 card had nothing behind
// it.
//
// The pair to Teaching Speaking: the same Productive Skills shape, walked a
// second time, so trainees recognise it themselves rather than being told.
// What is new here is the one distinction that shapes every writing lesson
// -- product versus process -- and that one IS named explicitly, once the
// read-and-check stage lands. Cambridge treats writing and speaking as one
// criterion (3b), not two.

const TERM_PAIRS: { term: string; definition: string }[] = [
  { term: "Product approach", definition: "Learners study a sample cover letter, then write their own copying its structure." },
  { term: "Process approach", definition: "Learners plan, write a first draft, get feedback, then write it again." },
  { term: "Draft", definition: "A first attempt at the email, before any feedback." },
  { term: "Redraft", definition: "The rewritten email after fixing what the feedback pointed out." },
  { term: "Model text", definition: "The sample formal letter learners study before writing their own." },
  { term: "Peer feedback", definition: "A partner reads your draft and suggests one change before the final version." },
];

const TASK_TYPES: { name: string; example: string; bestFor: string }[] = [
  {
    name: "Guided / parallel writing",
    example: "Learners follow a model text closely, substituting their own details into the same structure.",
    bestFor:
      "Lower levels and fixed genres — a formal email, a for-and-against essay — where the format itself is the target language.",
  },
  {
    name: "Collaborative writing",
    example: "Pairs or small groups plan and draft a text together, negotiating content and language as they go.",
    bestFor:
      "Generating and testing ideas out loud before committing them to paper; weaker writers get support mid-draft.",
  },
  {
    name: "Process writing with redrafting",
    example:
      "Learners plan, write a first draft, get peer or teacher feedback, then produce a second, improved draft.",
    bestFor:
      "Longer or higher-stakes pieces where the finished quality matters more than speed — reports, personal statements.",
  },
  {
    name: "Transactional writing",
    example:
      "A real-world functional text with a clear purpose — a complaint email, a text message arranging plans, a note to a colleague.",
    bestFor: "Practising register and genre conventions tied to an authentic, everyday purpose.",
  },
  {
    name: "Free / creative writing",
    example:
      "An open prompt — a short story, a description, a personal reflection — with minimal structural constraint.",
    bestFor: "Fluency in writing and personal expression, usually once accuracy in the genre is already secure.",
  },
];

const DETAILS: { q: string; a: string }[] = [
  {
    q: "What does a product approach focus on?",
    a: "The finished piece matching a known format or structure, learned by studying and imitating a model text.",
  },
  {
    q: "What does a process approach add that a product approach doesn’t?",
    a: "Planning, drafting, feedback and redrafting — treating writing as several stages rather than one attempt.",
  },
  {
    q: "Do most real writing lessons pick one approach only?",
    a: "No — most blend both: a model text for structure and language, then drafting and redrafting on top of it.",
  },
  {
    q: "What are the two parts of feedback at the end?",
    a: "Task achievement first (did the writing do its job), then delayed language feedback on accuracy — not the other way round.",
  },
];

const MOVES: ChoiceScenario[] = [
  {
    text: "Learners read a sample cover letter, label its sections, then write their own following the same structure.",
    choices: ["Product move", "Process move"],
    correctIndex: 0,
    feedback: "Product move — studying and imitating a model text’s structure.",
  },
  {
    text: "Learners write a first draft of a complaint email, get feedback from the teacher, then rewrite it before submitting.",
    choices: ["Product move", "Process move"],
    correctIndex: 1,
    feedback: "Process move — drafting and redrafting based on feedback rather than stopping at the first attempt.",
  },
  {
    text: "Before the final version, partners swap drafts and suggest one thing to add and one thing to cut.",
    choices: ["Product move", "Process move"],
    correctIndex: 1,
    feedback: "Process move — peer feedback between drafts is a core process-approach stage.",
  },
  {
    text: "The task specifies the writing must follow the exact layout of a formal letter, with a fixed opening and closing.",
    choices: ["Product move", "Process move"],
    correctIndex: 0,
    feedback: "Product move — matching a fixed genre format is the defining feature of a product approach.",
  },
];

const CORRECT_ORDER = ["Lead-in", "Preparing to write", "Useful language", "Task", "Feedback"];
const SHUFFLED = ["Task", "Lead-in", "Feedback", "Useful language", "Preparing to write"];

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const RED = "oklch(45% 0.15 27)";
const MUTED = "oklch(51% 0.017 70)";

export default function TeachingWritingSession() {
  return (
    <SessionShell
      eyebrow="Input session · 45 minutes · loop input"
      title="Teaching writing — product, process, and the difference it makes"
      intro="This session is staged like the lesson it teaches: prepare ideas, get useful language, do the task, get feedback. Do the stages first — the debrief afterwards is where it gets named. Along the way it builds the one distinction that shapes every writing lesson: product versus process."
      agenda={[
        { time: "0–2", title: "Lead-in", spine: GOLD },
        { time: "2–5", title: "Preparing to write", spine: TEAL },
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
          Helping learners to produce written language — staged, purposeful writing tasks. Cambridge combines writing and
          speaking as one criterion (3b), not two.
        </p>
      </div>

      <RunningThisSession>
        Don’t name “the Productive Skills framework” until the debrief — trainees should recognise the shape themselves
        from Teaching Speaking. Do name product and process explicitly once the read-and-check stage lands; that
        distinction is the whole point of this particular session.
      </RunningThisSession>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stage 1 · Lead-in</h2>
          <p className="text-label text-muted">
            Probably the most universally recognisable attitude to writing there is.
          </p>
        </div>
        <VideoReveal embedUrl="https://www.youtube-nocookie.com/embed/w4NsjnL4ieA?end=95" />
        <p className="text-meta leading-relaxed text-ink">
          What was his attitude to writing? Have you ever felt exactly like that?
        </p>
        <p className="text-label italic text-muted">Quick discussion, a minute.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">Stage 2 · Preparing to write</h2>
        <p className="text-meta leading-relaxed text-ink">
          Think of the last piece of writing you did that actually mattered — a job application, a difficult email, a
          complaint. Did you write it once, or several times, changing it along the way?
        </p>
        <p className="text-label italic text-muted">A minute alone, then compare with a partner.</p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stage 3 · Match each term to a real example</h2>
        </div>
        <MatchTermsExercise terms={TERM_PAIRS} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stage 4 · Now do it — pick the right task type</h2>
          <p className="text-label text-muted">
            Using the piece of writing from Stage 2: which task type below would suit teaching that kind of writing? Click
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
          <h3 className="font-serif text-h3 font-semibold text-ink">Product versus process</h3>
          <p className="text-meta leading-relaxed text-ink">
            A product approach treats writing as the end result. Learners study a model text, notice its features and
            organisation, then produce their own version closely following that model — the focus is on the finished piece
            matching a known format, like a formal email or a for-and-against essay.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            A process approach treats writing as a series of stages the writer moves through, not a single pass:
            generating ideas, planning or outlining, drafting, getting feedback, then redrafting based on that feedback
            before a final version. The focus shifts from the finished product to what happens on the way there.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            Most real writing lessons on this course blend both. A model text still supplies useful language and
            structure, borrowed from the product approach, but learners plan, draft and redraft rather than writing once
            and stopping, borrowed from process. Peer feedback between drafts does real work here — it increases
            involvement, lets writers see their draft through another reader’s eyes, and builds confidence by making
            revision feel normal rather than a correction.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            Feedback at the end still splits in two: first, whether the task was achieved — did the letter actually
            persuade, did the email cover everything asked — then delayed language feedback on accuracy, dealt with once
            the writing is finished rather than mid-draft.
          </p>
        </article>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-h3 font-semibold text-ink">Stage 5 · Look again, then check with your partner</h2>
        <div className="flex flex-col gap-2">
          {DETAILS.map((d) => (
            <RevealCard key={d.q} question={d.q} answer={d.a} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stage 5, continued · Product move, or process move?</h2>
          <p className="text-label text-muted">Four things a teacher might do in a writing lesson. Choose for each.</p>
        </div>
        <div className="flex flex-col gap-2">
          {MOVES.map((m) => (
            <ChoiceScenarioCard key={m.text} scenario={m} />
          ))}
        </div>
      </section>

      <OrderExercise correctOrder={CORRECT_ORDER} shuffled={SHUFFLED} />

      <TrainerNotes
        runningNote="Correct order: Lead-in → Preparing to write → Useful language → Task → Feedback — the same Productive Skills shape as Teaching Speaking. Point out at the reveal that trainees have now done this framework twice, once per productive skill."
        notes={[
          {
            label: "Product / process answers",
            text: "1 = product (studying a model text and its structure), 2 = process (drafting and redrafting based on feedback), 3 = process (peer feedback between drafts), 4 = product (matching a fixed format or genre, e.g. a formal letter template).",
          },
          {
            label: 'Push past "process is better"',
            text: "Most CELTA writing lessons blend both, and a low-level group often needs more product scaffolding — a model to imitate — before process stages make sense to them.",
          },
          {
            label: "Stage 2 has to be real",
            text: "Preparing to write only works if trainees genuinely recall something real — don't let them skip to Stage 3. The point is to feel content coming before language, same as in Teaching Speaking.",
          },
          {
            label: "If time allows",
            text: "Ask trainees which of the five task types would need the most redrafting time in a real 45-minute TP slot — most land on collaborative or transactional writing, not free writing.",
          },
        ]}
      />
    </SessionShell>
  );
}

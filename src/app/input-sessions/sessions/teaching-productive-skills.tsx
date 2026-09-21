"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { ChoiceScenarioCard } from "@/components/input-sessions/choice-scenario";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { SessionLabel } from "@/components/input-sessions/session-label";

// Teaching productive skills — one shape, two skills.
//
// Ramy's own standalone (Desktop, 21 Sep 2026), ported here so it lives with
// the other sessions. It runs the productive-skills shape ONCE with speaking
// and writing inside it, rather than teaching the shape twice.
//
// It does NOT replace the separate Teaching speaking and Teaching writing
// sessions. The standalone's own trainer notes said it did; Ramy overruled
// that on 21 Sep -- "leave the other two sessions as they are" -- so the note
// below says what is actually true, and all three stay in the registry.
//
// A candidate can only reach a session their timetable puts in front of them,
// and this one is on no timetable. The trainer material is staff-gated anyway,
// by RunningThisSession and TrainerNotes.

type Lane = "both" | "speaking" | "writing";

const TERMS: { term: string; definition: string; lane: Lane }[] = [
  { lane: "both", term: "STT vs TTT", definition: "Student Talking Time vs Teacher Talking Time. In any productive skills lesson the aim is maximum learner output — give clear instructions fast, then get out of the way." },
  { lane: "both", term: "Task achievement", definition: "Whether the task actually got done — a discussion reached a decision, a complaint email covered everything asked — independent of how accurate the language was." },
  { lane: "both", term: "Monitoring", definition: "Watching pairs or groups work without interrupting: listening in during speaking, reading over shoulders during writing. The teacher notes good and problem language for feedback afterwards." },
  { lane: "both", term: "Delayed error correction", definition: "Noting errors during the task and dealing with them once it finishes, rather than stopping learners mid-sentence or mid-draft to fix them." },
  { lane: "speaking", term: "Information gap", definition: "Each speaker holds information the other doesn't have, so there's a genuine reason to talk — unlike a scripted dialogue both partners can already read." },
  { lane: "writing", term: "Model text", definition: "The sample text learners study before writing their own — a formal letter, a for-and-against essay. It supplies both structure and useful language." },
  { lane: "writing", term: "Product vs process", definition: "Product treats writing as the finished piece matching a known format. Process treats it as stages: ideas, plan, draft, feedback, redraft. Most lessons blend both." },
  { lane: "writing", term: "Drafting, redrafting and peer feedback", definition: "Writing can be revised, so a draft gets read — by a partner or the teacher — and rewritten. Peer feedback between drafts raises involvement and makes revision feel normal rather than corrective." },
];

const SPEAKING_TASKS = [
  { name: "Information-gap", example: "Two learners each have half a picture, schedule, or map; they describe their half to find the differences.", bestFor: "Practising specific target language while guaranteeing a genuine need to speak." },
  { name: "Role-play", example: "Each learner gets a role card and situation — a customer complaining, a doctor's appointment — and improvises within it.", bestFor: "Functional language and real-world transactional situations." },
  { name: "Discussion", example: "Open questions on a topic learners have opinions on, with no single right answer.", bestFor: "Fluency and free practice, usually near the end of a lesson." },
  { name: "Problem-solving / ranking", example: "A group ranks items or agrees on a solution together — a survival scenario, allocating a budget.", bestFor: "Extended negotiation, natural turn-taking, language of agreeing and disagreeing." },
  { name: "Describe and draw", example: "One learner describes an image while their partner draws it, or two similar pictures are compared for differences.", bestFor: "Lower levels, concrete vocabulary, high engagement with low language demands." },
];

const WRITING_TASKS = [
  { name: "Guided / parallel writing", example: "Learners follow a model text closely, substituting their own details into the same structure.", bestFor: "Lower levels and fixed genres — a formal email, a for-and-against essay — where the format itself is the target language." },
  { name: "Collaborative writing", example: "Pairs or small groups plan and draft a text together, negotiating content and language as they go.", bestFor: "Testing ideas out loud before committing them to paper; weaker writers get support mid-draft." },
  { name: "Process writing with redrafting", example: "Learners plan, write a first draft, get peer or teacher feedback, then produce a second, improved draft.", bestFor: "Longer or higher-stakes pieces where finished quality matters more than speed — reports, personal statements." },
  { name: "Transactional writing", example: "A real-world functional text with a clear purpose — a complaint email, a text arranging plans, a note to a colleague.", bestFor: "Register and genre conventions tied to an authentic, everyday purpose." },
  { name: "Free / creative writing", example: "An open prompt — a short story, a description, a personal reflection — with minimal structural constraint.", bestFor: "Fluency in writing and personal expression, once accuracy in the genre is already secure." },
];

const DETAILS = [
  { q: "What comes before language in preparing to speak or write?", a: "Ideas and content — engaging with the topic itself, something to actually say." },
  { q: "Should useful language always be pre-taught before a productive skills task?", a: "No — it's optional, and many lessons skip it entirely if the target language was already covered earlier." },
  { q: "Why does the teacher get out of the way during the task?", a: "To maximise learner output and let monitoring happen instead of interrupting — every minute of teacher talk is a minute a learner isn't producing language." },
  { q: "What are the two parts of feedback at the end — for either skill?", a: "Task achievement first (did it do its job), then delayed language feedback on accuracy. Never the other way round." },
  { q: "Which stage genuinely differs between speaking and writing, and why?", a: "Feedback. Writing leaves a draft that can be revised, so feedback can feed a redraft; speech isn't recoverable, so accuracy work lands as delayed correction instead." },
];

const CHOICES = ["Task achievement", "Language feedback"];
const SCENARIOS: { lane: Exclude<Lane, "both">; text: string; correctIndex: number; feedback: string }[] = [
  { lane: "speaking", text: "Two pairs never actually decided on a restaurant — they got distracted and ran out of time.", correctIndex: 0, feedback: "Task achievement — worth raising in feedback on the task itself, separate from any language point." },
  { lane: "speaking", text: 'Half the class said "I am agree" instead of "I agree."', correctIndex: 1, feedback: "Language feedback — a common form error, worth a quick delayed correction slot with the whole class." },
  { lane: "speaking", text: "A student went completely silent when it was their turn; their partner did all the talking.", correctIndex: 0, feedback: "Task achievement / participation — worth noting for feedback, but it isn't a language point." },
  { lane: "writing", text: "A complaint email is polite and accurate but never says what the writer wants done about it.", correctIndex: 0, feedback: "Task achievement — the text didn't do its job, whatever its accuracy." },
  { lane: "writing", text: 'Four learners opened their formal letters with "Hey" before the greeting.', correctIndex: 1, feedback: "Language feedback — register, and worth naming as register rather than as a mistake." },
  { lane: "writing", text: 'One pair used "I would be grateful if you could" entirely naturally in their first draft.', correctIndex: 1, feedback: "Language feedback — the positive kind. Good language noticed while monitoring is fed back too, not only errors." },
];

const COMPARE = [
  { stage: "Lead-in", speaking: "Create interest in the topic. Nobody talks about something they haven't engaged with.", writing: "Identical — create interest in the topic first." },
  { stage: "Preparing", speaking: "Have something real to say; compare with a partner.", writing: "Have something real to write; plan or note it." },
  { stage: "Useful language", speaking: "Optional. A handful of phrases learners are missing.", writing: "Optional — and often carried by a model text rather than taught separately." },
  { stage: "Task", speaking: "Instructions, then the teacher disappears and monitors.", writing: "Instructions, then the teacher disappears and monitors." },
  { stage: "Feedback", speaking: "Task achievement, then delayed correction. The talk is gone.", writing: "Task achievement, then language — and the draft can be revised, so feedback can feed a redraft." },
];

const CORRECT_ORDER = ["Lead-in", "Preparing to speak or write", "Useful language", "Task", "Feedback"];
const SHUFFLED = ["Task", "Lead-in", "Feedback", "Useful language", "Preparing to speak or write"];

const NOTES = [
  { label: "Correct order", text: "Lead-in → Preparing to speak or write → Useful language → Task → Feedback. Same shape as Lesson framework's productive skills slot — say so explicitly at the reveal; trainees should recognise it." },
  { label: "Alongside the single-skill sessions", text: "Teaching speaking and Teaching writing stay in the library and are unchanged. Use the lens control to give this session a single skill's emphasis where a cohort has already had one of them." },
  { label: "Feedback classify answers", text: "1 task achievement, 2 language, 3 task achievement / participation, 4 task achievement, 5 language (register), 6 language (positive)." },
  { label: "Push past \"process is better\"", text: "Most CELTA writing lessons blend product and process, and a low-level group often needs a model to imitate before process stages make sense." },
  { label: "Stage 2 is the point", text: "It only works if trainees think of something real for both skills — don't let them skip to Stage 3. The point is to feel content arriving before language." },
  { label: "Communicative is not correction-free", text: "Watch for trainees conflating \"communicative\" with \"no correction at all\" — delayed correction is about timing, not avoidance. Writing makes this concrete: the draft survives, so the correction has somewhere to go." },
];

// The lens dims one skill so a single-skill cohort can run the same session
// narrower. It is the trainee's control as much as the trainer's, so it is
// not gated -- it changes what is shown, not what is given away.
function useLens() {
  return useState<"Both" | "Speaking" | "Writing">("Both");
}

function TaskColumn({ heading, tasks }: { heading: string; tasks: typeof SPEAKING_TASKS }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SessionLabel>{heading}</SessionLabel>
      {tasks.map((t) => (
        <RevealCard key={t.name} variant="list" question={t.name} answer={`${t.example} Best for: ${t.bestFor}`} />
      ))}
    </div>
  );
}

export default function TeachingProductiveSkillsSession() {
  const [lens, setLens] = useLens();
  const showSpeaking = lens !== "Writing";
  const showWriting = lens !== "Speaking";
  const keep = (l: Lane) => l === "both" || (l === "speaking" && showSpeaking) || (l === "writing" && showWriting);
  // The agenda counts follow the lens, as they do in Ramy's original: narrowing
  // to one skill hides terms and a whole task column, so a fixed "8 terms / 10
  // task types" would be describing a session the reader is not looking at.
  const termCount = TERMS.filter((t) => keep(t.lane)).length;
  const taskCount = (showSpeaking ? SPEAKING_TASKS.length : 0) + (showWriting ? WRITING_TASKS.length : 0);

  return (
    <SessionShell
      slug="teaching-productive-skills"
      title="Teaching productive skills — one shape, two skills."
      intro="Speaking and writing are staged the same way: prepare ideas, get useful language, do the task, get feedback. This session runs that shape once, with both skills inside it — so the shared spine and the few real differences land together. Do the stages first. The debrief is where it gets named."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-primary)", title: "Preparing — both skills" },
        { time: "5–13", spine: "var(--color-primary)", title: `Useful language: ${termCount} terms` },
        { time: "13–20", spine: "var(--color-primary)", title: `Task: ${taskCount} task types` },
        { time: "20–28", spine: "var(--color-primary)", title: "Task: read and check" },
        { time: "28–36", spine: "var(--color-primary)", title: "Detail + classify feedback" },
        { time: "36–43", spine: "var(--color-muted)", title: "Debrief: order the stages" },
        { time: "43–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t name &quot;the productive skills framework&quot; until the debrief — trainees should feel the shape
        before they see it. Do name product and process explicitly once the read-and-check stage lands; that is the one
        place the two skills genuinely part company. The lens control below dims one skill so a single-skill cohort can
        run the same session narrower.
      </RunningThisSession>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label font-semibold text-muted">Lens</span>
        {(["Both", "Speaking", "Writing"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLens(l)}
            className={`h-[30px] rounded-full border px-3.5 text-label font-semibold ${
              lens === l ? "border-ink bg-ink/5 text-ink" : "border-border bg-card text-muted"
            }`}
          >
            {l}
          </button>
        ))}
        <span className="text-label text-muted">
          {lens === "Both" ? "Everything shown — the full session." : `${lens} only — the other skill is hidden.`}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <SessionLabel>Stage 1 · Lead-in · 2 minutes</SessionLabel>
        <RevealCard
          variant="hero"
          question="What is a productive skill?"
          answer="A skill where the learner produces language rather than receives it — speaking and writing. Reading and listening are the receptive pair."
        />
        <p className="text-label text-muted">
          Then ask the room about attitudes to writing, and whether anyone would say the same about speaking. A minute,
          no more.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SessionLabel>Stage 2 · Preparing — one prompt per skill · 3 minutes</SessionLabel>
        {showSpeaking ? (
          <div className="rounded-[8px] border border-border bg-card p-3.5">
            <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">Speaking</p>
            <p className="text-meta leading-relaxed text-ink">
              Think of a real opinion or story you&apos;d actually want to share about your journey into teaching. A
              minute alone, then tell a partner.
            </p>
          </div>
        ) : null}
        {showWriting ? (
          <div className="rounded-[8px] border border-border bg-card p-3.5">
            <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">Writing</p>
            <p className="text-meta leading-relaxed text-ink">
              Think of the last piece of writing you did that actually mattered — a job application, a difficult email, a
              complaint. Did you write it once, or several times? A minute alone, then compare with a partner.
            </p>
          </div>
        ) : null}
        <p className="text-label text-muted">
          Don&apos;t write anything down yet. Notice that you had something to say before you had any language for it.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <SessionLabel>Stage 3 · Useful language — the terms you&apos;ll need · 8 minutes</SessionLabel>
        <MatchTermsExercise terms={TERMS.filter((t) => keep(t.lane)).map(({ term, definition }) => ({ term, definition }))} />
      </div>

      <div className="flex flex-col gap-2.5">
        <SessionLabel>Stage 4 · Now do it — pick the right task type · 7 minutes</SessionLabel>
        <p className="text-meta leading-relaxed text-ink">
          Take the opinion and the piece of writing from Stage 2. Which task type would actually get a partner to hear
          the one, and suit teaching the other? Click each to see what it&apos;s for, then tell your partner which
          you&apos;d pick and why.
        </p>
        {showSpeaking ? <TaskColumn heading="Speaking tasks" tasks={SPEAKING_TASKS} /> : null}
        {showWriting ? <TaskColumn heading="Writing tasks" tasks={WRITING_TASKS} /> : null}
      </div>

      <div className="flex flex-col gap-2.5">
        <SessionLabel>Stage 4, continued · Read the text and check if your ideas were right · 8 minutes</SessionLabel>
        <div className="flex flex-col gap-3 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-h3 font-semibold text-ink">
            Staging a productive skills lesson — and where writing goes its own way
          </p>
          <p className="text-meta leading-relaxed text-ink">
            A productive skills lesson doesn&apos;t open with instructions. It opens by creating interest in the topic
            and giving learners something to think or feel before they need any language for it — ideas and content come
            first, because nobody can speak or write about a topic they haven&apos;t engaged with yet.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            Useful language comes next, but only if it&apos;s needed — a handful of words or phrases learners are
            missing to do the task, not a full presentation. Many productive skills lessons skip this stage entirely if
            the target language was already covered earlier in the day.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            The task itself is where the teacher gets out of the way. Clear instructions, a genuine information gap or a
            real opinion to share, then the teacher circulates and monitors without interrupting — every minute of
            teacher talk here is a minute a learner isn&apos;t producing language.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            Feedback closes the lesson in two parts. First, feedback on whether the task was actually achieved —
            content, not language. Only after that does the teacher share language noticed while monitoring: what
            worked, and what to fix, dealt with once the task is over rather than mid-flow.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            So far this describes both skills. The difference is that writing leaves a draft behind, and a draft can be
            worked on. A product approach treats writing as the end result: learners study a model text, notice its
            features and organisation, then produce their own version closely following that model. A process approach
            treats writing as stages the writer moves through — generating ideas, planning, drafting, getting feedback,
            redrafting. Most real writing lessons blend the two: a model text supplies structure and language, then
            learners plan, draft and redraft rather than writing once and stopping. Speaking has no equivalent, because
            speech isn&apos;t recoverable — which is why delayed correction, not redrafting, is where a speaking lesson
            puts its accuracy work.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <SessionLabel>Stage 5 · Look again at the text · 8 minutes</SessionLabel>
        {DETAILS.map((d) => (
          <RevealCard key={d.q} variant="list" question={d.q} answer={d.a} />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <SessionLabel>Stage 5, continued · Content feedback, or language feedback?</SessionLabel>
        <p className="text-meta leading-relaxed text-ink">
          Six things a teacher notices while monitoring — three from a speaking task, three from a writing task. The
          split works the same way in both. Click your answer for each.
        </p>
        {SCENARIOS.filter((s) => keep(s.lane)).map((s) => (
          <div key={s.text} className="flex flex-col gap-1">
            <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">{s.lane}</p>
            <ChoiceScenarioCard
              scenario={{ text: s.text, choices: CHOICES, correctIndex: s.correctIndex, feedback: s.feedback }}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <SessionLabel>The shared spine, and the one real difference</SessionLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr>
                <th className="border-b border-border p-2 text-label font-bold uppercase tracking-[0.08em] text-muted">Stage</th>
                <th className="border-b border-border p-2 text-label font-bold uppercase tracking-[0.08em] text-muted">Speaking</th>
                <th className="border-b border-border p-2 text-label font-bold uppercase tracking-[0.08em] text-muted">Writing</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((c) => (
                <tr key={c.stage}>
                  <td className="border-b border-border p-2 text-label font-semibold text-ink">{c.stage}</td>
                  <td className="border-b border-border p-2 text-label text-ink">{c.speaking}</td>
                  <td className="border-b border-border p-2 text-label text-ink">{c.writing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <OrderExercise
        correctOrder={CORRECT_ORDER}
        shuffled={SHUFFLED}
        intro={
          <>
            You just moved through five stages — click each one in the order you actually experienced it. This is a{" "}
            <strong className="text-ink">loop input</strong>: the session modelled the framework instead of only
            describing it, and it did it once for both skills.
          </>
        }
      />

      <TrainerNotes notes={NOTES} />
    </SessionShell>
  );
}

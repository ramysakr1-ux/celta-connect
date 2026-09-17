"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { GOLD, TEAL } from "@/components/input-sessions/tokens";

// design_handoff_input_sessions_2 §4 -- "Giving Feedback on Tasks".
//
// Another finished design that had never been ported, so the day-8 card on a
// candidate's Resources tab had nothing behind it. Reviewed before this
// package too: it was three activities with no timings, no lead-in and no
// trainer notes -- roughly twenty minutes of material. It now runs 45, with
// a lead-in from the trainees' own TP, per-stage timings, an eight-minute
// "Run it live" round in threes, a wrap-up and trainer notes.
//
// Not error correction. This is feedback on whether the TASK worked.

const METHODS: { task: string; method: string }[] = [
  {
    task: "True/false or multiple-choice questions",
    method:
      "Read out the statement, ask for a show of hands or a quick chorus answer — fast, and you can see who’s unsure without cold-calling anyone.",
  },
  {
    task: "Open discussion task (no single right answer)",
    method:
      'Whole-class round-up: ask a few pairs what they concluded and why, rather than an "answer key" — the goal is comparing reasoning, not marking right/wrong.',
  },
  {
    task: "Ordering or matching task",
    method:
      "Put the correct order on the board (or reveal an answer slide) and have students self-check against it — faster than going through it item by item out loud.",
  },
  {
    task: "Writing task (a short paragraph or email)",
    method:
      "Peer feedback first using a simple checklist, then a few models shared with the class — not marking every paper live in the lesson.",
  },
  {
    task: "Information-gap or role-play",
    method:
      "Ask a couple of pairs to briefly report what they found out — checks the task worked without restaging the whole role-play for the class.",
  },
];

const MOVES: { text: string; good: boolean; why: string }[] = [
  {
    text: "Nominate one pair to read out all five answers while everyone else listens.",
    good: false,
    why: "Only checks one pair’s work — the rest of the room never finds out if they were right.",
  },
  {
    text: "Put the answers on the board and have pairs self-check, then ask who got all five.",
    good: true,
    why: "Every pair checks their own work directly, and the quick show of hands tells you where confusion is, fast.",
  },
  {
    text: 'Ask "does everyone understand?" and move on.',
    good: false,
    why: "This checks nothing — it’s a closed question nobody ever answers honestly.",
  },
  {
    text: "Go through the answers together, but ask a different pair to justify each one from the text.",
    good: true,
    why: "Slower, but it surfaces reading strategy, not just the answer — worth it if you have the time.",
  },
  {
    text: "Collect every pair’s answers to mark after the lesson, say nothing in class.",
    good: false,
    why: "Feedback that arrives after the lesson has ended can’t inform anything that happens in it.",
  },
];

const ORDER_CORRECT = [
  "Students finish the task",
  "Check answers as a group (method matched to task type)",
  "Address any answers that came up wrong",
  "Move to language focus or the next stage",
];
const ORDER_SHUFFLED = [
  "Address any answers that came up wrong",
  "Students finish the task",
  "Move to language focus or the next stage",
  "Check answers as a group (method matched to task type)",
];

const LIVE_CARDS: { task: string; watch: string }[] = [
  {
    task: "Students match six phrasal verbs to their meanings.",
    watch:
      "Did the answers go on the board so everyone self-checked, or did one student read them out while the rest waited?",
  },
  {
    task: "Pairs decide the three most useful apps for learning English.",
    watch: 'Open task — did the teacher compare reasoning across pairs, or try to find a "right answer"?',
  },
  {
    task: "Students listen and note four prices from a short recording.",
    watch:
      "Fast method wanted: chorus or hands. Did the teacher also play the extract again for any price the room split on?",
  },
];

const RED = "oklch(45% 0.15 27)";

export default function GivingFeedbackOnTasksSession() {
  return (
    <SessionShell
      slug="giving-feedback-on-tasks"
      title="Giving feedback on tasks"
      intro="Not error correction — this is feedback on whether students completed the task itself: did they get the right answer, finish the discussion, reach a decision. Skipping this stage means students never find out if the activity actually worked."
      agenda={[
        { time: "0–5", title: "Lead-in", spine: GOLD },
        { time: "5–15", title: "Method to task", spine: TEAL },
        { time: "15–28", title: "Weak moves", spine: TEAL },
        { time: "28–35", title: "The order", spine: TEAL },
        { time: "35–43", title: "Run it live", spine: GOLD },
        { time: "43–45", title: "Wrap-up", spine: RED },
      ]}
    >
      <RunningThisSession>
        Pairs for the first four stages, threes for the live round. Everything here is a planning decision — the method is
        chosen while writing the lesson, not improvised once the task has finished.
      </RunningThisSession>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">Lead-in · 5 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          Think of the last TP you watched. After a task finished, how did the teacher check it — and how long did it take?
          In pairs: was there a moment where students never found out whether they were right?
        </p>
        <p className="text-label italic text-muted">
          Two minutes in pairs, then three answers from the room. No feedback from the trainer yet — the session supplies
          it.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Match the task to its feedback method · 10 minutes</h2>
          <p className="text-label text-muted">
            Every task type needs a different way of checking answers. Click each task for the fastest, clearest way to
            close the loop.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {METHODS.map((m) => (
            <RevealCard key={m.task} question={m.task} answer={m.method} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Spot the weak feedback move · 13 minutes</h2>
          <p className="text-label text-muted">
            Same task, five ways a teacher might run feedback on it. Pick each one to find out whether it works.
          </p>
          <p className="mt-1 rounded-[6px] border border-dashed border-border bg-accent/40 px-3 py-2 text-meta text-ink">
            <strong className="font-semibold">Task:</strong> pairs read a short text and answer five true/false
            comprehension questions.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {MOVES.map((mv) => (
            <MoveCard key={mv.text} text={mv.text} good={mv.good} why={mv.why} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <OrderExercise
          title="The order that actually works · 7 minutes"
          intro="Click each stage in the order you would run it."
          correctOrder={ORDER_CORRECT}
          shuffled={ORDER_SHUFFLED}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Run it live · 8 minutes</h2>
          <p className="text-label text-muted">
            In threes: one teacher, two students. The students do the task for 90 seconds, then the teacher runs feedback
            in under a minute — method matched to the task. Swap roles. Click a card to take it.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {LIVE_CARDS.map((c, i) => (
            <LiveCard key={c.task} n={i + 1} task={c.task} watch={c.watch} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">Wrap-up · 2 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          One line each, round the room: the feedback method you will use in your next TP, and for which task.
        </p>
      </section>

      <TrainerNotes
        notes={[
          {
            label: "0–5 · Lead-in from their own TP",
            text: 'Every trainee has now watched at least six lessons. Anchor to one they saw this week. If nobody offers the "never found out" moment, offer one of your own.',
          },
          {
            label: "5–15 · Method to task",
            text: "Reveal one card together, then let pairs do the other four. The point is that the method is a design decision made while planning, not improvised after.",
          },
          {
            label: "15–28 · Weak moves",
            text: 'Let them pick all five before discussing. The two "good" moves are deliberately different speeds — draw out when you would choose the slow one.',
          },
          {
            label: "28–35 · The order",
            text: 'The trap is "address wrong answers" before "check as a group" — you cannot know what went wrong until the room has checked. Say that out loud.',
          },
          {
            label: "35–43 · Run it live",
            text: "Strict timing: 90 seconds task, 60 seconds feedback, swap. Observers use the card note. Three rounds fits; do not let the task itself run long.",
          },
          {
            label: "43–45 · Close",
            text: "One line each. Write the methods on the board as they say them — it becomes the list they plan from tomorrow.",
          },
        ]}
      />
    </SessionShell>
  );
}

function MoveCard({ text, good, why }: { text: string; good: boolean; why: string }) {
  const [picked, setPicked] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setPicked(true)}
      disabled={picked}
      className={`flex w-full flex-col gap-1.5 rounded-[8px] border px-4 py-3 text-left ${
        !picked ? "border-border bg-card" : good ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-meta leading-relaxed text-ink">{text}</span>
        {picked ? (
          <span className={`flex-none text-body font-bold ${good ? "text-primary" : "text-destructive"}`}>
            {good ? "✓" : "✗"}
          </span>
        ) : null}
      </span>
      {picked ? (
        <span className={`text-label leading-relaxed ${good ? "text-primary" : "text-destructive"}`}>{why}</span>
      ) : (
        <span className="text-micro font-semibold text-primary">Click to judge it ▾</span>
      )}
    </button>
  );
}

function LiveCard({ n, task, watch }: { n: number; task: string; watch: string }) {
  const [taken, setTaken] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setTaken((t) => !t)}
      className={`flex w-full flex-col gap-1.5 rounded-[8px] border px-4 py-3 text-left ${
        taken ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <span className="text-micro font-bold uppercase tracking-[0.12em] text-muted">Task card {n}</span>
      <span className="text-meta leading-relaxed text-ink">{task}</span>
      {taken ? (
        <span className="border-t border-border pt-1.5 text-label leading-relaxed text-primary">
          <strong className="font-semibold">Watch for:</strong> {watch}
        </span>
      ) : (
        <span className="text-micro font-semibold text-primary">Click to take this card ▾</span>
      )}
    </button>
  );
}

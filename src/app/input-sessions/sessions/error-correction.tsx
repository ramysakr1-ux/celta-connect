"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { VideoReveal } from "@/components/input-sessions/video-reveal";

// design_handoff_input_sessions_2 §4 -- "Error Correction Input Session".
//
// This one was a finished design that had never been ported, so the day-8
// card on a candidate's Resources tab rendered as a plain <li> with a
// calendar icon and nothing behind it. Ramy, 13 Sep 2026: "some of them seem
// to have a bug -- they're supposed to be interactive but they're not."
//
// The design was also reviewed before this package: it had three activities,
// no timings, no lead-in and no trainer notes -- about twenty minutes of
// material. It now runs 45, with the agenda, per-stage timings and the
// trainer notes carried here verbatim.
//
// The two sequences are drag-to-reorder in the design; they are the shared
// OrderExercise here -- same task ("put these in order"), and the library's
// own interaction, which works on a phone and from a keyboard.

const DECISION_FLOW = [
  "Decide on the type of error",
  "Will you deal with it or not?",
  "When will you deal with it?",
  "Who will deal with it?",
  "Decide on technique to use",
];
// The design's own starting scramble, kept so the exercise opens the same way.
const DECISION_FLOW_SHUFFLED = [
  "When will you deal with it?",
  "Decide on technique to use",
  "Decide on the type of error",
  "Who will deal with it?",
  "Will you deal with it or not?",
];

const CORRECTION_SEQUENCE = [
  "Indicate to the student that an error has been made.",
  "Give the student a chance to identify the error.",
  "Teacher identifies the error for the student.",
  "Give the student time to self-correct.",
  "Teacher models the correct version.",
  "Student repeats the correct version.",
  "Drill for pronunciation and correct use.",
  "Give a mini practice.",
];
const CORRECTION_SEQUENCE_SHUFFLED = [
  "Give the student time to self-correct.",
  "Indicate to the student that an error has been made.",
  "Student repeats the correct version.",
  "Give a mini practice.",
  "Give the student a chance to identify the error.",
  "Teacher models the correct version.",
  "Teacher identifies the error for the student.",
  "Drill for pronunciation and correct use.",
];

const TECHNIQUES: { label: string; desc: string }[] = [
  { label: "Facial expression", desc: "quizzical look, raised eyebrows." },
  {
    label: "Gesture & facial expression",
    desc: "a quizzical look plus a hand movement to ‘hold’ the sentence, showing it needs attention.",
  },
  { label: "Finger correction", desc: "rebuild the sentence and use a finger to indicate the missing word." },
  { label: "Repeat leading up to the error", desc: "“They went…?” with questioning intonation." },
  { label: "Echo with different intonation", desc: "draw attention to the problem." },
  { label: "Ask a question", desc: "“Did you go yesterday?” to establish which tense the learner meant." },
  { label: "One-word question", desc: "“Tense?” “Preposition?”" },
  { label: "Timelines", desc: "especially useful for tenses." },
  { label: "Write it on the board", desc: "for whole-class discussion, if it’s a common issue." },
  {
    label: "Exploit the funny side",
    desc: "“You cooked kitchen in the chicken? I’ve never eaten kitchen before!”",
  },
  { label: "Phonemic chart", desc: "draw attention to a sound problem." },
  { label: "Tell them", desc: "sometimes, just give the correct form." },
];

const PRACTICE: { utterance: string; suggestion: string }[] = [
  {
    utterance: "He like this school.",
    suggestion: "Finger correction, or a one-word question (“Verb?”) — subject-verb agreement.",
  },
  {
    utterance: "Where you did go yesterday?",
    suggestion: "Repeat leading up to the error with questioning intonation, or write it on the board — word order.",
  },
  {
    utterance: "I eat schocolate every day.",
    suggestion: "Phonemic chart, or echo with different intonation — pronunciation.",
  },
  {
    utterance: "I am here since Tuesday.",
    suggestion: "Timelines, or a one-word question (“Tense?”) — wrong tense.",
  },
  {
    utterance: "Give me one butterbread!",
    suggestion: "Tell them, or exploit the funny side — wrong collocation.",
  },
];

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const RED = "oklch(45% 0.15 27)";

export default function ErrorCorrectionSession() {
  return (
    <SessionShell
      eyebrow="Input session · 45 minutes · classroom skills"
      title="Facilitating self & peer correction of oral errors"
      intro="Not whether to correct, but how to get the learner — or the person next to them — to do it. Two sequences to put in order, twelve techniques, then five real errors to choose a technique for."
      agenda={[
        { time: "0–6", title: "Video lead-in", spine: GOLD },
        { time: "6–14", title: "Decision flow", spine: TEAL },
        { time: "14–24", title: "Correction sequence", spine: TEAL },
        { time: "24–30", title: "Twelve techniques", spine: TEAL },
        { time: "30–42", title: "Practice on five errors", spine: GOLD },
        { time: "42–45", title: "Wrap-up", spine: RED },
      ]}
    >
      <RunningThisSession>
        Trainees work in pairs throughout. The two ordering exercises are the thinking; the practice is the doing — every
        error is said out loud to a partner playing the learner before anyone reveals a suggestion.
      </RunningThisSession>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">Video lead-in · 6 minutes</h2>
          <p className="text-xs text-muted">
            Watch once, then one question: <strong className="text-ink">who did the correcting?</strong>
          </p>
        </div>
        <VideoReveal embedUrl="https://www.youtube-nocookie.com/embed/nsGY5-tjsFU" />
      </section>

      <section className="flex flex-col gap-3">
        <OrderExercise
          title="Decision flow — put the steps in order · 8 minutes"
          intro="Five decisions, and they only work in one order. Click each one in the order you would make it."
          correctOrder={DECISION_FLOW}
          shuffled={DECISION_FLOW_SHUFFLED}
        />
      </section>

      <section className="flex flex-col gap-3">
        <OrderExercise
          title="Correction sequence — put the steps in order · 10 minutes"
          intro="What actually happens, moment to moment, once you have decided to correct."
          correctOrder={CORRECTION_SEQUENCE}
          shuffled={CORRECTION_SEQUENCE_SHUFFLED}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">How to correct: twelve techniques · 6 minutes</h2>
          <p className="text-xs text-muted">Read them fast. The practice below is where they get used.</p>
        </div>
        <ol className="flex flex-col gap-1.5">
          {TECHNIQUES.map((t, i) => (
            <li key={t.label} className="flex items-start gap-3 rounded-[7px] border border-border bg-card px-3.5 py-2.5">
              <span className="flex size-5 flex-none items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink">
                <strong className="font-semibold">{t.label}</strong> — {t.desc}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">Practice — choose a technique · 12 minutes</h2>
          <p className="text-xs text-muted">
            For each error, pick the technique you would use, <strong className="text-ink">try it on your partner out loud</strong>,
            then reveal a suggestion. The suggestion is one answer, not the answer.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {PRACTICE.map((p) => (
            <PracticeRow key={p.utterance} utterance={p.utterance} suggestion={p.suggestion} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg font-semibold text-ink">Wrap-up · 3 minutes</h2>
        <p className="text-[12.5px] leading-relaxed text-ink">
          Which two techniques will you try in your next TP — and which one error type from your own learners will you try
          them on? Say it to your partner; write it in your plan tonight.
        </p>
      </section>

      <TrainerNotes
        notes={[
          {
            label: "0–6 · Video, then one question",
            text: 'Play the clip once. Ask only: "Who did the correcting?" The answer — the learner, then a peer, and the teacher last — is the whole session in one sentence.',
          },
          {
            label: "6–14 · Decision flow",
            text: 'Pairs work it out, then check. Most put "technique" too early. The order matters because technique depends on who and when — say that when they check.',
          },
          {
            label: "14–24 · Correction sequence",
            text: "Eight steps is a lot; the point is the gaps — steps 2 and 4 are the waiting. Ask how long they actually waited in their last TP before jumping in. Usually under two seconds.",
          },
          {
            label: "24–30 · Techniques, briefly",
            text: "Read the list aloud fast, demonstrating three or four (finger correction, echo, one-word question). Do not explain all twelve; the practice does that.",
          },
          {
            label: "30–42 · Practice out loud",
            text: "The choice is for their own record; the real task is saying it to a partner who plays the learner. Two minutes per error, then reveal. Insist on the learner self-correcting before the teacher gives anything.",
          },
          {
            label: "42–45 · Close",
            text: "Two techniques each, named. These go in tomorrow's plan under Anticipated problems — that is the transfer.",
          },
        ]}
      />
    </SessionShell>
  );
}

function PracticeRow({ utterance, suggestion }: { utterance: string; suggestion: string }) {
  const [choice, setChoice] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-3.5">
      <p className="font-serif text-[15px] font-semibold text-ink">“{utterance}”</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-[11.5px] text-ink outline-none focus:border-primary"
        >
          <option value="">Choose a technique…</option>
          {TECHNIQUES.map((t) => (
            <option key={t.label} value={t.label}>
              {t.label}
            </option>
          ))}
        </select>
        <RevealCard question="Suggested technique" answer={suggestion} />
      </div>
    </div>
  );
}

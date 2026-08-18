"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";

const CONCEPTS = [
  { label: "Non-literate vs. non-fluent", detail: "A learner may speak conversational English well but have never learned to read or write any language, including their own — literacy and oral fluency develop independently." },
  { label: "Different script vs. no script", detail: "Someone literate in Arabic, Mandarin, or Amharic script is transferring existing decoding skill to a new alphabet. Someone with no prior literacy is building decoding itself for the first time." },
  { label: "Pen-and-paper motor skill", detail: "Holding a pen, writing left to right, forming letter shapes — these are learned physical skills, not given. Some adult beginners are doing this for the first time in your class." },
  { label: "Print concepts", detail: "Which way is up on a page, that print (not the picture) carries the meaning, that spaces separate words — none of this is obvious without prior exposure." },
  { label: "Where this shows up on this course", detail: "Mostly relevant for community/ESOL-style teaching contexts, less so exam-prep or academic groups. It rarely applies to a whole class — usually one or two learners within an otherwise literate group." },
];

const SCENARIOS: ChoiceScenario[] = [
  {
    text: "A learner consistently writes letters as mirror images or upside down, well past the point classmates have stopped.",
    choices: ["Literacy barrier", "Normal language gap"],
    correctIndex: 0,
    feedback: "Literacy barrier — likely still building basic letter-formation and orientation, not a language-level issue.",
  },
  {
    text: 'A learner asks you to repeat a word slower and mispronounces the /θ/ sound in "think" as /s/.',
    choices: ["Literacy barrier", "Normal language gap"],
    correctIndex: 1,
    feedback: "Normal language gap — a pronunciation/phonology issue any beginner might have, unrelated to literacy.",
  },
  {
    text: "A learner grips the pen awkwardly, writes very slowly, and seems to copy letter-by-letter rather than word-by-word.",
    choices: ["Literacy barrier", "Normal language gap"],
    correctIndex: 0,
    feedback: "Literacy barrier — the motor and visual-processing skills behind fluent writing haven't developed yet.",
  },
  {
    text: "Given a matching worksheet with printed words and pictures, a learner can't find where to start or which direction to read in.",
    choices: ["Literacy barrier", "Normal language gap"],
    correctIndex: 0,
    feedback: "Literacy barrier — this is a print-concepts gap (direction, layout), not vocabulary or grammar.",
  },
];

const ADAPT_ORIGINAL = [
  "Complete the form below. Write your full name, date of birth, and address in the boxes provided. Sign at the bottom once finished.",
  "Read the instructions carefully, then underline the correct word in each sentence and check your answers with a partner.",
];

const ADAPT_OPTIONS = [
  [
    { text: 'Shortened version: "Write your name, birthday, and address. Sign at the bottom."', good: false, note: "Still assumes fluent reading and writing of connected text — shorter isn't the same as accessible to a non-reader." },
    { text: "One box at a time, each labelled with a matching picture icon (a person for name, a calendar for date of birth), teacher demonstrates each step live before learners attempt it.", good: true, note: "Breaks the task into pieces small enough to model, and uses images to carry meaning the print alone can't yet." },
    { text: "Same form, but read aloud to the class first.", good: false, note: "Helps comprehension of what's being asked, but doesn't solve the actual barrier — still requires writing fluently into the boxes unaided." },
  ],
  [
    { text: "Same worksheet, with extra time given.", good: false, note: "Extra time helps a slow-but-capable reader, not someone who can't yet decode the sentence at all." },
    { text: 'Replace "underline the correct word" with matching a picture to one of two spoken/repeated words, no independent reading required.', good: true, note: "Removes the reading step entirely and checks the same language point through listening and image matching instead." },
    { text: "Pair the learner with a stronger reader to do the worksheet together.", good: false, note: "Common but risky as a default — it can mean the stronger learner does all the actual reading while the other watches, learning nothing about print themselves." },
  ],
];

const TECHNIQUES = [
  { technique: "Language Experience Approach (learner dictates, teacher writes)", week1: true, note: "connects spoken words the learner already has to their written form, no prior print skill assumed." },
  { technique: "Phonics / letter-sound drilling", week1: true, note: "foundational, usually starts immediately alongside oral work." },
  { technique: "Independent silent reading of a short text", week1: false, note: "asking for this too early just produces guessing or copying." },
  { technique: "Realia and picture-based vocabulary matching (no text)", week1: true, note: "carries meaning without requiring any reading at all." },
  { technique: "Cloze/gap-fill worksheets", week1: false, note: "filling a gap requires reading the surrounding text." },
];

const NOTES = [
  { label: "Framing this session", text: "Most trainees will never teach a fully pre-literate class on this course — the point isn't to make them experts, it's to make them notice the possibility before they misread silence as low ability or disengagement." },
  { label: '"Spot the barrier": there\'s no trick answer', text: "Scenario 3 (can't hold a pen correctly) is deliberately the one most likely to be misjudged as babyish or irrelevant — it's a real signal in adult pre-literacy classes and worth a beat of discussion." },
  { label: '"Adapt the handout": push past "make it simpler"', text: "The wrong-but-tempting answer is usually the version that's just shorter text — still assumes fluent decoding. The right answer relies on images/realia doing the work language can't yet." },
  { label: "Techniques: there's genuine disagreement here", text: "Don't present the notes as the only right sequencing — some centres introduce letter names before letter sounds, or vice versa. Use disagreement in the room as the discussion, not a wrong-answer moment." },
  { label: "Time is tight — protect the wrap-up", text: "45 minutes is short for this much ground. If the handout activity runs long, cut to two of the three techniques cards rather than skipping the wrap-up question — that question is the actual takeaway." },
];

function ConceptCard({ n, label, detail }: { n: number; label: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-col gap-1 rounded-[8px] border border-border bg-card px-3.5 py-2.5 text-left">
      <div className="flex items-baseline gap-2.5">
        <span className="min-w-[16px] text-[10.5px] font-bold text-muted">{String(n).padStart(2, "0")}</span>
        <span className="flex-1 text-[12.5px] font-semibold text-ink">{label}</span>
      </div>
      {open ? <p className="pl-[26px] text-[11.5px] leading-relaxed text-muted">{detail}</p> : null}
    </button>
  );
}

function TechniqueRow({ technique, week1, note }: { technique: string; week1: boolean; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`grid grid-cols-[1fr_1.3fr] items-center gap-3 rounded-[6px] border px-3.5 py-2.5 text-left ${open ? "border-status-on-track-text/30 bg-status-on-track-bg" : "border-border bg-card"}`}
    >
      <span className="text-xs font-semibold text-ink">{technique}</span>
      {open ? (
        <span className="text-[11.5px] text-status-on-track-text">{(week1 ? "Week one. " : "Once basic decoding is established. ") + note}</span>
      ) : (
        <span className="text-[10.5px] font-semibold text-muted">Click to reveal</span>
      )}
    </button>
  );
}

function AdaptHandout() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const options = ADAPT_OPTIONS[index];

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-bold text-ink">Adapt the handout</p>
        <p className="text-[10.5px] font-semibold text-muted">
          Handout {index + 1} of {ADAPT_OPTIONS.length}
        </p>
      </div>
      <p className="text-[11.5px] text-muted">This handout is written for a fluent reader. Pick the version you&apos;d actually give a pre-literate beginner group.</p>
      <div className="rounded-[8px] bg-accent p-3.5">
        <p className="mb-1 text-xs font-semibold text-muted">Original handout</p>
        <p className="text-[13px] leading-relaxed text-ink">{ADAPT_ORIGINAL[index]}</p>
      </div>
      {options.map((o, i) => {
        const picked = choice === i;
        return (
          <button
            key={o.text}
            type="button"
            onClick={() => setChoice(i)}
            className={`flex flex-col gap-1 rounded-[8px] border px-3.5 py-3 text-left ${
              picked ? (o.good ? "border-status-on-track-text/40 bg-status-on-track-bg" : "border-destructive/40 bg-destructive/5") : "border-border bg-card"
            }`}
          >
            <p className="text-[13px] leading-relaxed text-ink">{o.text}</p>
            {picked ? <p className={`text-[11.5px] leading-relaxed ${o.good ? "text-status-on-track-text" : "text-destructive"}`}>{o.note}</p> : null}
          </button>
        );
      })}
      {choice !== null && index < ADAPT_OPTIONS.length - 1 ? (
        <button
          type="button"
          onClick={() => {
            setIndex((i) => i + 1);
            setChoice(null);
          }}
          className="self-start flex h-7 items-center gap-1.5 rounded-full border border-border px-3.5 text-[11px] font-semibold text-ink"
        >
          Next handout →
        </button>
      ) : null}
    </div>
  );
}

export default function TeachingLiteracySession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · Input session · 45 minutes · learner literacy"
      title="Teaching literacy — when the barrier isn't the language."
      intro="Some learners can't yet read or write fluently in ANY script, including their own. This session is about noticing that, and adapting — not about ESOL methodology in general, which the rest of this course already covers."
      agenda={[
        { time: "0–3", spine: "var(--color-gold)", title: "Lead-in" },
        { time: "3–13", spine: "var(--color-gold)", title: "What literacy covers" },
        { time: "13–20", spine: "var(--color-primary)", title: "Spot the barrier" },
        { time: "20–28", spine: "var(--color-destructive)", title: "Adapt the handout" },
        { time: "28–45", spine: "var(--color-status-on-track-text)", title: "Techniques + wrap-up" },
      ]}
    >
      <RunningThisSession>
        One shared screen — project it, or have trainees open it on their own devices for the individual activities.
        Trainer notes stay hidden until you click to reveal them.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 3 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">Look at the line below for two seconds, then look away. What did it say?</p>
          <div className="mt-2.5 rounded-[6px] bg-accent px-3.5 py-2.5 text-center text-xl tracking-wide text-ink">
            ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ ᠰᠤᠷᠬᠤ
          </div>
          <p className="mt-2 text-[11.5px] text-muted">
            Most people can&apos;t hold or reproduce a script they&apos;ve never learned to decode. That&apos;s the position some
            of your learners are in with the Latin alphabet — even after weeks in your class.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">What &quot;literacy&quot; covers here · 10 minutes</p>
        <p className="text-[11.5px] text-muted">Click each to reveal what it actually looks like in the room.</p>
        {CONCEPTS.map((c, i) => (
          <ConceptCard key={c.label} n={i + 1} label={c.label} detail={c.detail} />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-5">
        <p className="text-[13px] font-bold text-ink">Spot the pre-literacy barrier</p>
        <p className="text-[11.5px] text-muted">
          Each of these is a real moment from a beginner class. Decide: does this need a literacy adaptation, or is it a
          normal beginner-level language gap? Click to check.
        </p>
        {SCENARIOS.map((s) => (
          <ChoiceScenarioCard key={s.text} scenario={s} />
        ))}
      </div>

      <AdaptHandout />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">Techniques for a pre-literate class · 12 minutes</p>
        <p className="text-[11.5px] text-muted">
          In pairs, look at each technique below and agree: would you use this in week one, or only once basic letter
          recognition is established? Click to compare with the note.
        </p>
        {TECHNIQUES.map((t) => (
          <TechniqueRow key={t.technique} {...t} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Wrap-up · 5 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            In one sentence each: what&apos;s one thing you&apos;d check about a new learner&apos;s literacy before assuming their
            silence in a reading task is a language problem?
          </p>
        </div>
      </div>

      <TrainerNotes notes={NOTES} />
    </SessionShell>
  );
}

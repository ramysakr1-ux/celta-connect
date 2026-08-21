"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Presentation", definition: "The teacher gives the target language directly, with context, model and CCQs." },
  { term: "Controlled practice", definition: "Accuracy-focused practice with one right answer, teacher corrects closely." },
  { term: "Production", definition: "Freer, fluency-focused practice using the learner's own ideas." },
  { term: "Drilling", definition: "Students repeat a word or sentence, chorally then individually, for pronunciation." },
  { term: "MFP", definition: "Meaning, form, pronunciation — covered in that order before any practice begins." },
];

const DETAILS = [
  { q: "Students work out the rule themselves before the teacher confirms it.", a: "False — the teacher presents the form directly." },
  { q: "Practice always splits into controlled, then freer.", a: "True." },
  { q: "Feedback on errors during production is usually immediate, not delayed.", a: "False — usually delayed to the end." },
  { q: "Pronunciation is covered as part of presentation, not skipped.", a: "True." },
  { q: "PPP suits a class where everyone already knows the target form.", a: "False — it assumes nobody has met it yet." },
  { q: "The three stages can run in any order.", a: "False — presentation, then practice, then production, always." },
];

const CORRECT_ORDER = ["Pre-teach terms", "Predict the staging", "Read the text, check ideas", "Detail check"];
const SHUFFLED = ["Read the text, check ideas", "Pre-teach terms", "Detail check", "Predict the staging"];

const EXAMPLE_ROWS = [
  { stage: "Context", time: "3′", text: 'T holds up two phones: "Which one is bigger?"' },
  { stage: "Presentation", time: "7′", text: "T models \"My phone is bigger than my friend's\", drills, checks meaning with CCQs against the real phones." },
  { stage: "Form + pronunciation", time: "5′", text: "Board: adjective + -er + than / more + adjective + than. Drill weak \"than\"." },
  { stage: "Controlled practice", time: "10′", text: "Substitution table comparing classroom objects, T monitors closely." },
  { stage: "Freer practice", time: "15′", text: "Ss compare their hometown and this city in open pairs." },
  { stage: "Delayed feedback", time: "5′", text: "T addresses errors noted during production, as a whole class." },
];

const NOTES = [
  { label: "Keep the order strict", text: "Accuracy work — presentation, then controlled practice — always precedes fluency work. Don't let the room jump ahead to production early." },
  { label: "Its main weakness, worth naming", text: "PPP assumes the whole class needs the same language at the same time — a poor fit for mixed-level groups or when some students already partly know the form." },
  { label: "Delayed feedback, genuinely delayed", text: "Resist correcting during production — note errors and address them once the freer practice has finished." },
];

function StagingExample() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2.5 border-t border-border pt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-print-hide
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-muted/10 px-4 text-xs font-semibold text-muted"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
        {open ? "Hide staging example" : "See staging example"}
      </button>
      {open ? (
        <div className="flex flex-col gap-2">
          <p className="font-serif text-lg font-semibold text-ink">Example lesson — comparative adjectives</p>
          <div className="overflow-hidden rounded-[6px] border border-border">
            <div className="grid grid-cols-[150px_60px_1fr] bg-accent px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
              <p>Stage</p>
              <p>Time</p>
              <p>Procedure</p>
            </div>
            {EXAMPLE_ROWS.map((r) => (
              <div key={r.stage} className="grid grid-cols-[150px_60px_1fr] gap-2 border-b border-border-faint px-3 py-2 last:border-b-0">
                <p className="text-[11px] font-bold text-ink">{r.stage}</p>
                <p className="text-[11px] text-muted">{r.time}</p>
                <p className="text-[11.5px] leading-relaxed text-muted">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PppSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · loop input"
      title="Presentation, Practice, Production — taught the way you'll teach it."
      intro="This session is staged exactly like the lesson framework it teaches. Do the tasks first — naming what happened is what the debrief is for."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-primary)", title: "What is PPP?" },
        { time: "5–10", spine: "var(--color-primary)", title: "Match the terms" },
        { time: "10–13", spine: "var(--color-primary)", title: "Predict the staging" },
        { time: "13–23", spine: "var(--color-primary)", title: "Read the text, check ideas" },
        { time: "23–33", spine: "var(--color-primary)", title: "Detail questions" },
        { time: "33–43", spine: "var(--color-primary)", title: "Debrief: order the stages" },
        { time: "43–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t name &quot;PPP&quot; until the debrief. Present the form yourself in stage 3 rather than eliciting it — that
        contrast with the other frameworks is the point.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: who learned a language mostly by being told the rule first, then practising it? Did that
            work for you?
          </p>
        </div>
      </div>

      <RevealCard
        variant="hero"
        question="What does PPP stand for?"
        answer="Presentation, Practice, Production — language given, then practised, then produced freely."
      />

      <MatchTermsExercise terms={TERMS} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 2</p>
        <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">How do you think a PPP lesson should be staged?</p>
          <p className="text-[11px] italic text-muted">Discuss with your partner, about a minute — no wrong answers yet.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 3 · Read the text and check if your ideas were right or wrong</p>
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">Staging a PPP lesson</p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            A PPP lesson opens with the target language given directly, not discovered. The teacher sets up a clear
            context, models the form once or twice, and checks meaning with CCQs — all before students produce
            anything themselves. Form comes next, usually a short board summary, then pronunciation: stress, weak
            forms, drilling chorally and individually. Practice follows in two distinct phases. Controlled practice
            comes first — gap-fills, substitution drills, matching — with one right answer and the teacher correcting
            closely as students work. Freer, or production, practice comes last: students use the language to say
            something of their own, the teacher monitors without interrupting, and feedback on errors is saved for
            the end. The three stages always run in that order — presentation, then practice, then production —
            because accuracy work has to come before fluency work in this framework.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Stage 4</p>
          <p className="text-[11px] italic text-muted">More time now — answer these from the text, then check with your partner.</p>
        </div>
        {DETAILS.map((d) => (
          <RevealCard key={d.q} question={d.q} answer={d.a} />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
        <p className="font-serif text-sm font-semibold text-ink">Presentation and practice, kept brief</p>
        <p className="text-[12.5px] leading-relaxed text-ink">
          Present the form directly — a short board example and a quick CCQ check, not an extended explanation. Then
          move to controlled practice (drilling, a gap-fill, or a matching task using the same form) before freer
          practice (students producing the language themselves in a short exchange or writing task). Keep each stage
          tight — PPP&apos;s risk is spending too long presenting and leaving too little time for students to actually
          use the language.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <OrderExercise correctOrder={CORRECT_ORDER} shuffled={SHUFFLED} />
      </div>

      <AnswerKey terms={TERMS.map((t) => ({ term: t.term, def: t.definition }))} details={DETAILS} />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
  );
}

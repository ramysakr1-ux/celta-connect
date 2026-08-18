"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Marker sentence", definition: "An example sentence, taken from context, that contains the target language." },
  { term: "CCQ", definition: "A concept checking question — checks meaning without naming the grammar." },
  { term: "Inductive", definition: "Examples come first, the rule comes last, worked out by the students." },
  { term: "Elicit", definition: "Draw an answer out of students rather than giving it to them." },
  { term: "MFP", definition: "Meaning, form, pronunciation — the three things any target language item needs covered." },
];

const DETAILS = [
  { q: "The teacher gives the rule before students see any examples.", a: "False — examples come first." },
  { q: "Marker sentences should come from a context students have already met.", a: "True." },
  { q: "CCQs check meaning, not form or pronunciation.", a: "True." },
  { q: "Guided discovery skips form and goes straight to practice.", a: "False — form is elicited too, usually as a board summary." },
  { q: "Pronunciation — stress, weak forms, connected speech — is covered in guided discovery too.", a: "True — usually via drilling once form is on the board." },
  { q: "Practice should ideally return to something close to the original context.", a: "True." },
];

const CORRECT_ORDER = ["Pre-teach terms", "Predict the staging", "Read the text, check ideas", "Detail check"];
const SHUFFLED = ["Read the text, check ideas", "Pre-teach terms", "Detail check", "Predict the staging"];

const EXAMPLE_ROWS = [
  { stage: "Context", time: "3′", text: "Ss read a short text: two colleagues each had something interrupt them mid-action last week." },
  { stage: "Marker sentences", time: "2′", text: '"As he was travelling on a plane, the door came open." / "Her car caught fire while she was driving."' },
  { stage: "CCQs", time: "5′", text: "Same time? Which action started first? Long or short action?" },
  { stage: "Complete the rule", time: "5′", text: "Ss complete a gapped rule in pairs, T elicits and confirms as a class." },
  { stage: "Form + pronunciation", time: "5′", text: 'Board summary of positive/negative/question forms; T drills, marking weak "was/were".' },
  { stage: "Controlled practice", time: "10′", text: "Gap-fill using both tenses, checked in pairs." },
  { stage: "Freer practice", time: "10′", text: 'Ss tell their own "interrupted" story to a partner.' },
];

const NOTES = [
  { label: "Watch for the confirm-then-restate habit", text: "Some trainees elicit the rule, then explain it again anyway. The whole point is that the class states it — resist restating it for them." },
  { label: "Only for grammar or lexis", text: "Guided discovery doesn't work for writing or speaking — flag that limit explicitly during the debrief." },
  { label: "If the room goes quiet at Stage 2", text: "Prompt with a CCQ of your own rather than filling the silence with the answer — it's the same skill they're about to teach with." },
];

function StagingExample() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2.5 border-t border-border pt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-print-hide
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-gold/45 bg-gold/10 px-4 text-xs font-semibold text-gold"
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
          <p className="font-serif text-lg font-semibold text-ink">Example lesson — past continuous for interrupted actions</p>
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

function DebriefWithTrainerNotes() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-print-hide
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-gold/45 bg-gold/10 px-4 text-xs font-semibold text-gold"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="M11 12 20 3" />
          <path d="M16 8l2 2" />
          <path d="M13 11l2 2" />
        </svg>
        Skip to debrief — trainer only
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-4">
        <div />
        <button
          type="button"
          onClick={() => setOpen(false)}
          data-print-hide
          className="h-7 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink"
        >
          Hide
        </button>
      </div>
      <OrderExercise correctOrder={CORRECT_ORDER} shuffled={SHUFFLED} />
      <div className="flex flex-col gap-2.5 rounded-[8px] border border-destructive/25 bg-destructive/5 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-destructive">
          <span className="size-1.5 rounded-full bg-current" />
          Trainer only — trainer notes
        </p>
        {NOTES.map((n) => (
          <div key={n.label} className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-ink">{n.label}</p>
            <p className="text-xs leading-relaxed text-ink">{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GuidedDiscoverySession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · loop input"
      title="Guided discovery — taught the way you'll teach it."
      intro="This session is staged exactly like the lesson framework it teaches. Do the tasks first — naming what happened is what the debrief is for."
      agenda={[
        { time: "0–2", spine: "var(--color-gold)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-primary)", title: "What is guided discovery?" },
        { time: "5–10", spine: "var(--color-primary)", title: "Match the terms" },
        { time: "10–13", spine: "var(--color-primary)", title: "Predict the staging" },
        { time: "13–23", spine: "var(--color-primary)", title: "Read the text, check ideas" },
        { time: "23–33", spine: "var(--color-primary)", title: "Detail questions" },
        { time: "33–43", spine: "var(--color-status-on-track-text)", title: "Debrief: order the stages" },
        { time: "43–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t name &quot;guided discovery&quot; until the debrief — run stages 1 to 4 as if this were a real grammar
        lesson, not a session about one. Elicit the rule from the room; don&apos;t confirm it until they&apos;ve stated it
        themselves.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: who worked out a grammar rule for themselves at school, rather than being told it?
            Did it stick better?
          </p>
        </div>
      </div>

      <RevealCard
        variant="hero"
        question="What is guided discovery?"
        answer="Students work out a rule themselves, from examples, guided by questions."
      />

      <MatchTermsExercise terms={TERMS} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 2</p>
        <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">How do you think a guided discovery lesson should be staged?</p>
          <p className="text-[11px] italic text-muted">Discuss with your partner, about a minute — no wrong answers yet.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 3 · Read the text and check if your ideas were right or wrong</p>
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">Staging a guided discovery lesson</p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            A guided discovery lesson starts with the target language already sitting inside a context — a short
            text, a story, a listening — never on the board in isolation. From that context the teacher lifts one or
            two marker sentences that contain the target form. Students don&apos;t get a rule yet; instead the teacher
            asks concept checking questions (CCQs), simple questions that test understanding of{" "}
            <strong className="font-semibold">meaning</strong>{" "}without ever naming the grammar. From there the class
            works together to complete a gapped rule about meaning and use — the teacher elicits it, doesn&apos;t state
            it. Only once meaning is secure does the lesson turn to <strong className="font-semibold">form</strong>,
            usually as a short board summary students copy down. The teacher then drills the sentence, marking stress
            and any weak forms or connected speech — the{" "}
            <strong className="font-semibold">pronunciation</strong> stage, easy to skip but not optional. Controlled
            and then freer practice follow, ideally back inside a context close to the original one. Meaning, form,
            pronunciation — MFP — has to be covered for any target item, whichever framework is teaching it.
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

      <AnswerKey terms={TERMS.map((t) => ({ term: t.term, def: t.definition }))} details={DETAILS} />

      <DebriefWithTrainerNotes />

      <StagingExample />
    </SessionShell>
  );
}

"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Gist", definition: "Reading or listening fast, once, for the main idea only." },
  { term: "Detail", definition: "A slower, closer pass for specific information." },
  { term: "Authentic text", definition: "A real text or recording made for real readers, not simplified for learners." },
  { term: "Follow-on task", definition: "A speaking, writing or discussion task that responds to the text's content." },
  { term: "Lead-in", definition: "A short task that creates interest in the topic before the text appears." },
];

const DETAILS = [
  { q: "The target language is chosen before the text.", a: "False — the text comes first, language is lifted from it." },
  { q: "A gist task should be timed, to keep students reading fast.", a: "True." },
  { q: "Students should look up every unknown word before reading for gist.", a: "False — only pre-teach words essential to understanding." },
  { q: "Detail tasks come before gist tasks.", a: "False — gist always comes first." },
  { q: "The follow-on task should relate to the text's content.", a: "True." },
  { q: "A text-based lesson can only use one language item from the text.", a: "False — it can use several, wherever they occur." },
];

const CORRECT_ORDER = ["Pre-teach terms", "Predict the staging", "Read the text, check ideas", "Detail check", "Highlight, then language focus and practice"];
const SHUFFLED = ["Read the text, check ideas", "Highlight, then language focus and practice", "Pre-teach terms", "Detail check", "Predict the staging"];

const LANG_CARDS = [
  { q: "Example — highlighting stage", a: "Students go back into the same text, alone or in pairs, and underline or highlight the target language themselves — e.g. every phrase used to talk about renting. Clarification then works from exactly what they marked, so the language stays visibly anchored to the text rather than announced by the teacher." },
  { q: "Example — clarifying the teach stage", a: 'The text mentions renting, not buying. Board the sentence, ask two or three CCQs ("do they own the flat?", "is this permanent?") and let students answer their way to the meaning, rather than explaining the rule.' },
  { q: "Example — the practice stage", a: "Controlled first: a gap-fill using sentences adapted from the same text. Then freer: students write or say two sentences about their own housing situation, using the target language — the text stays the anchor, the practice does not float free of it." },
];

const EXAMPLE_ROWS = [
  { stage: "Lead-in", time: "4′", text: "Ss predict the article's content from its photo and headline." },
  { stage: "Gist task", time: "6′", text: "Ss skim-read once, timed, to answer one general question." },
  { stage: "Detail task", time: "8′", text: "Ss read again, slower, for specific information." },
  { stage: "Language focus", time: "15′", text: "Comparative structures lifted from the article, unpacked with CCQs and practised." },
  { stage: "Follow-on task", time: "12′", text: "Ss discuss how their own city has changed, using the target structures." },
];

const NOTES = [
  { label: "Watch for PPP wearing a text-based costume", text: "Some trainees pick the text last and force it to fit a language point they already chose. The text has to come first and genuinely drive everything else." },
  { label: "Language items can be plural", text: "Unlike PPP or GD, a text-based lesson can lift more than one target item, wherever it occurs — don't force it back down to a single point." },
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
          <p className="font-serif text-lg font-semibold text-ink">Example lesson — a magazine article about changing city life</p>
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

export default function TextBasedTeachingSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · loop input"
      title="Text-based teaching — taught the way you'll teach it."
      intro="This session is staged exactly like the lesson framework it teaches. Do the tasks first — naming what happened is what the debrief is for."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-primary)", title: "What is text-based teaching?" },
        { time: "5–10", spine: "var(--color-primary)", title: "Match the terms" },
        { time: "10–13", spine: "var(--color-primary)", title: "Predict the staging" },
        { time: "13–23", spine: "var(--color-primary)", title: "Read the text, check ideas" },
        { time: "23–33", spine: "var(--color-primary)", title: "Detail questions" },
        { time: "33–43", spine: "var(--color-primary)", title: "Debrief: order the stages" },
        { time: "43–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t name &quot;text-based teaching&quot; until the debrief. Keep the language focus stage tied visibly
        back to the text — that&apos;s the detail trainees tend to lose first.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: think of the last coursebook lesson you did as a student. Did it start from a
            grammar point, or from a text?
          </p>
        </div>
      </div>

      <RevealCard
        variant="hero"
        question="What makes a lesson text-based?"
        answer="A text drives the whole lesson — topic, language and skills work all come from it."
      />

      <MatchTermsExercise terms={TERMS} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 2</p>
        <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">How do you think a text-based lesson should be staged?</p>
          <p className="text-[11px] italic text-muted">Discuss with your partner, about a minute — no wrong answers yet.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 3 · Read the text and check if your ideas were right or wrong</p>
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">Staging a text-based lesson</p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            A text-based lesson starts from a text — a reading or a listening — chosen for its content and its
            language together, not from a grammar point chosen first. It opens with a lead-in that creates interest
            in the topic, often a prediction task from a title or image. A gist task comes next, testing global
            understanding only: skim reading under a time limit, or hearing the audio once. Only once gist is secure
            does a detail task follow, prompting a closer, slower pass. From there the lesson turns to language:
            target items are lifted straight from the text itself, wherever they occur, rather than pre-selected —
            sometimes several different items, not just one. The lesson closes with a follow-on task that responds to
            the text&apos;s content, a discussion, a role play or a piece of writing. Everything in the lesson — topic,
            language, skills work — comes from that one text.
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Highlight, then language focus and practice</p>
          <p className="text-[11px] italic text-muted">Click each card for an example of how that stage can look with language that emerged from this text.</p>
        </div>
        {LANG_CARDS.map((d) => (
          <RevealCard key={d.q} question={d.q} answer={d.a} />
        ))}
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

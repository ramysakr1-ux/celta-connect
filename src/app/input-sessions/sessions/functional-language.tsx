"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Exponent", definition: 'One of several phrases that carry out a function — e.g. "How about...?" for suggesting.' },
  { term: "Function", definition: "The social job language does — suggesting, apologising, complaining, requesting." },
  { term: "Appropriacy", definition: "Whether an exponent fits the context — formality, relationship, setting." },
  { term: "Register", definition: "The level of formality a phrase carries — casual, neutral, formal." },
  { term: "Fixed expression", definition: "A phrase learned as a whole chunk rather than built word by word." },
];

const DETAILS = [
  { q: "A functional lesson clarifies a single correct form.", a: "False — it teaches several exponents students choose between." },
  { q: "Appropriacy is checked alongside meaning and pronunciation.", a: "True." },
  { q: "Intonation is a minor detail in functional language.", a: "False — it often carries whether the phrase sounds polite or rude." },
  { q: "Different exponents for the same function usually differ in formality.", a: "True." },
  { q: "Practice should include ordering or matching by formality.", a: "True." },
  { q: "A functional lesson always opens with a grammar rule.", a: "False — it opens with a situation or dialogue establishing the function." },
];

const CORRECT_ORDER = ["Pre-teach terms", "Predict the staging", "Read the text, check ideas", "Detail check"];
const SHUFFLED = ["Read the text, check ideas", "Pre-teach terms", "Detail check", "Predict the staging"];

const RANK_CORRECT = ["Would you mind closing the window?", "Could you close the window?", "Can you close the window?", "Close the window, would you?"];
const RANK_SHUFFLED = ["Can you close the window?", "Would you mind closing the window?", "Close the window, would you?", "Could you close the window?"];

const EXAMPLE_ROWS = [
  { stage: "Lead-in", time: "3′", text: 'Ss look at a picture of a messy shared kitchen — "What would you say to your flatmate?"' },
  { stage: "Present exponents", time: "10′", text: "T presents 4 suggestion exponents of varying formality, elicits the social effect of each." },
  { stage: "Meaning + appropriacy", time: "10′", text: "Ss match exponents to situations (close friend vs. new flatmate vs. landlord)." },
  { stage: "Pronunciation", time: "7′", text: "T drills rise-fall intonation, contrasts with a flat, rude-sounding version." },
  { stage: "Freer practice", time: "15′", text: "Roleplay: Ss choose the right exponent for three different relationships." },
];

const NOTES = [
  { label: "Several exponents, not one form", text: "Watch for trainees trying to teach a single \"correct\" phrase — the point is a set students can choose between depending on context." },
  { label: "Appropriacy is not optional", text: "A trainee who clarifies meaning and pronunciation but skips register has only done two-thirds of the job — push them to name who each exponent suits." },
  { label: "Intonation carries the politeness", text: "The same words said flat can sound sarcastic or rude — model the rise-fall pattern yourself before asking students to produce it." },
];

function RankByFormality() {
  const [picked, setPicked] = useState<string[]>([]);
  const remaining = RANK_SHUFFLED.filter((item) => !picked.includes(item));
  const wrong = picked.length === RANK_CORRECT.length && picked.some((r, i) => r !== RANK_CORRECT[i]);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Rank these exponents, most to least formal</p>
      <p className="text-[11.5px] text-muted">Function: making a suggestion. Click each in order, most formal first.</p>
      <div className="flex flex-col gap-1.5">
        {picked.map((item, i) => (
          <div
            key={item}
            className={`flex h-[38px] items-center rounded-[6px] border-[1.5px] px-3.5 text-[12.5px] font-semibold text-ink ${
              wrong ? "border-destructive bg-destructive/10" : "border-status-on-track-text bg-status-on-track-bg"
            }`}
          >
            {i + 1}. {item}
          </div>
        ))}
        {remaining.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPicked((p) => [...p, item])}
            className="flex h-[38px] items-center rounded-[6px] border border-border bg-card px-3.5 text-left text-[12.5px] text-ink"
          >
            {item}
          </button>
        ))}
      </div>
      {wrong ? <p className="text-[11.5px] text-destructive">Not the order most people would rank these — reset and try again.</p> : null}
      <button
        type="button"
        onClick={() => setPicked([])}
        className="self-start flex h-7 items-center rounded-[6px] border border-border px-3 text-[11.5px] font-semibold text-ink"
      >
        Reset
      </button>
    </div>
  );
}

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
          <p className="font-serif text-lg font-semibold text-ink">Example lesson — making suggestions</p>
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

export default function FunctionalLanguageSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · language awareness"
      title="Functional language — taught the way you'll teach it."
      intro="Functional language isn't one grammar structure — it's a set of phrases that all do the same social job. This session is staged the way a functional lesson is staged. Do the tasks first — naming what happened is what the debrief is for."
      agenda={[
        { time: "0–2", spine: "var(--color-gold)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-primary)", title: "What is functional language?" },
        { time: "5–10", spine: "var(--color-primary)", title: "Match the terms" },
        { time: "10–23", spine: "var(--color-primary)", title: "Predict, read the text, detail check" },
        { time: "23–33", spine: "var(--color-status-on-track-text)", title: "Rank by formality" },
        { time: "33–45", spine: "var(--color-destructive)", title: "Debrief + trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t name &quot;functional language&quot; until the debrief. Push on appropriacy as hard as on meaning — a
        phrase that&apos;s the wrong register is as wrong as one with the wrong grammar.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: how many different ways can you think of, right now, to ask someone to close a
            window?
          </p>
        </div>
      </div>

      <RevealCard
        variant="hero"
        question="What is functional language?"
        answer="A set of phrases (exponents) that all achieve the same social function, chosen by context and formality."
      />

      <MatchTermsExercise terms={TERMS} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 2</p>
        <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">How do you think a functional language lesson should be staged?</p>
          <p className="text-[11px] italic text-muted">Discuss with your partner, about a minute — no wrong answers yet.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 3 · Read the text and check if your ideas were right or wrong</p>
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">Staging a functional language lesson</p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            A functional lesson doesn&apos;t clarify one grammar structure — it teaches a set of exponents that all
            achieve the same social function, such as suggesting, complaining, or apologising. It usually opens with
            a situation or short dialogue that makes the function&apos;s context obvious. From that context the
            teacher elicits or presents several exponents at once — &quot;How about...?&quot;, &quot;Why don&apos;t
            you...?&quot;, &quot;You could...&quot; — rather than a single form. Meaning here is about the social
            effect (&quot;What is this person trying to get the other person to do?&quot;), and appropriacy matters
            as much as meaning: which exponent suits a close friend, and which suits a stranger or a boss?
            Pronunciation work usually centres on intonation, since a technically correct exponent said with the
            wrong intonation can sound rude or insincere. Practice moves from matching or ordering exponents by
            formality to freer roleplay in a realistic situation.
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

      <RankByFormality />

      <div className="border-t border-border pt-4">
        <OrderExercise correctOrder={CORRECT_ORDER} shuffled={SHUFFLED} />
      </div>

      <AnswerKey terms={TERMS.map((t) => ({ term: t.term, def: t.definition }))} details={DETAILS} />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
  );
}

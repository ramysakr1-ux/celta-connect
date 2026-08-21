"use client";

import { useEffect, useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Tense", definition: "The grammatical marking of time — past, present, future — usually shown by the verb form." },
  { term: "Aspect", definition: "How the speaker views the action: as complete, ongoing, or connected to another point in time." },
  { term: "Simple aspect", definition: "An action or state viewed as a whole — complete, or a general habit or fact." },
  { term: "Continuous (progressive) aspect", definition: "An action viewed as ongoing or in progress at a particular time." },
  { term: "Perfect aspect", definition: "An action connected to a later point in time, often showing a result or present relevance." },
  { term: "Perfect continuous aspect", definition: "An ongoing action connected to another point in time, usually emphasising duration." },
];

const CHOOSE_ITEMS = [
  { context: "Look! The bus ___ (leave).", a: "is leaving", b: "leaves", correct: "is leaving", feedback: "Present continuous — an action in progress right now, visible at the moment of speaking." },
  { context: "I ___ (finish) my homework, so I can go out now.", a: "have finished", b: "finished", correct: "have finished", feedback: "Present perfect — the action is in the past, but its result (being free to go out) is relevant right now." },
  { context: "When I arrived, she ___ (cook) dinner.", a: "was cooking", b: "cooked", correct: "was cooking", feedback: "Past continuous — sets a scene in progress at a specific past moment, interrupted by another past event." },
  { context: "By the time we got there, the film ___ (start).", a: "had started", b: "started", correct: "had started", feedback: "Past perfect — one past action completed before a second, later past action." },
];

const SORT_A = ["I play tennis every Sunday.", "She wrote the report yesterday.", "They will visit us next week."];
const SORT_B = ["I'm playing tennis right now.", "She was writing the report when I called.", "They will be visiting us this time next week."];
const SORT_ITEMS: { s: string; key: "simple" | "continuous" }[] = [
  ...SORT_A.map((s) => ({ s, key: "simple" as const })),
  ...SORT_B.map((s) => ({ s, key: "continuous" as const })),
];

const DISCUSS_PAIRS = [
  { a: "I've lived in Istanbul for ten years.", b: "I've been living in Istanbul for ten years.", prompt: "Both are true — what does the continuous add that the simple doesn't?" },
  { a: "She was tired because she had run 10km.", b: "She was tired because she had been running for an hour.", prompt: "One tells you how much was completed, the other how long it went on. Which is which?" },
  { a: "I'm meeting Ali at six.", b: "I meet Ali at six every Tuesday.", prompt: "Same verb, same time — one is a fixed arrangement, one is a routine. How does aspect signal that?" },
  { a: "I read the report before the meeting.", b: "I had read the report before the meeting.", prompt: "Both put the reading first — what does the second sentence make explicit that the first leaves you to infer?" },
  { a: "I'll be seeing him tomorrow anyway, so I'll tell him then.", b: "I'll tell him tomorrow.", prompt: "One treats the meeting as already arranged and in motion, the other as a decision made right now. Which is which?" },
];

const EXAMPLE_ROWS = [
  { label: "Item", value: "used to + infinitive, vs past simple" },
  { label: "Meaning", value: "A past habit or state that is no longer true, contrasted with the present." },
  { label: "Technique", value: 'Timeline: mark a habit spanning several years in the past, then a clear break to "now, not true." Elicit why past simple alone doesn\'t show the contrast.' },
  { label: "Form", value: "used to + base verb (no -ed on the main verb)" },
  { label: "Pronunciation", value: '/ˈjuːst tə/ — "used to" weakens in connected speech; "use to" is a common learner spelling error worth flagging.' },
];

const NOTES = [
  { label: "Tense and aspect are not the same thing", text: '"Present perfect" is a tense-and-aspect label, not a single tense — present tense, perfect aspect. Trainees who conflate the two end up teaching form without meaning.' },
  { label: "Meaning before form, every time", text: "Establish the situation that needs continuous or perfect aspect before naming or drilling the structure — the same guided-discovery principle, applied to grammar most trainees assume they already know." },
  { label: "Future is a modal, not a tense in English", text: 'English has no future tense inflection — "will" is a modal verb. "Future continuous" is really modal + continuous aspect. Worth flagging so trainees don\'t teach three "future tenses" as if they were parallel to past and present.' },
];

function ChooseAspect() {
  const [picked, setPicked] = useState<Record<number, string>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Choose the aspect the context needs</p>
      <p className="text-[11.5px] text-muted">Each situation only works with one option — click your answer, then check.</p>
      {CHOOSE_ITEMS.map((item, ci) => {
        const pick = picked[ci];
        return (
          <div key={item.context} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
            <p className="font-serif text-sm font-semibold text-ink">{item.context}</p>
            <div className="flex flex-wrap gap-1.5">
              {[item.a, item.b].map((opt) => {
                const isCorrectPick = pick === opt && opt === item.correct;
                const isWrongPick = pick === opt && opt !== item.correct;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPicked((p) => ({ ...p, [ci]: opt }))}
                    className={`rounded-full border-[1.5px] px-3 py-1.5 text-[11.5px] font-semibold ${
                      isCorrectPick
                        ? "border-primary bg-primary/10 text-primary"
                        : isWrongPick
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border bg-card text-ink"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {pick ? <p className="text-[11.5px] leading-relaxed text-muted">{item.feedback}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function SortByAspect() {
  const [items, setItems] = useState(SORT_ITEMS);
  const [picked, setPicked] = useState<Record<string, "simple" | "continuous">>({});

  useEffect(() => {
    setItems(shuffle(SORT_ITEMS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function column(label: string, key: "simple" | "continuous") {
    return (
      <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-3.5">
        <p className="font-serif text-sm font-semibold text-ink">{label}</p>
        <div className="flex flex-col gap-1.5">
          {items.map((item) => {
            const shown = picked[item.s] === key;
            const isCorrect = item.key === key;
            return (
              <button
                key={item.s}
                type="button"
                onClick={() => setPicked((p) => ({ ...p, [item.s]: key }))}
                className={`rounded-[6px] border-[1.5px] px-2.5 py-1.5 text-left text-[11.5px] ${
                  shown
                    ? isCorrect
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-card text-ink"
                }`}
              >
                {item.s}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-bold text-ink">Sort by aspect</p>
        <p className="text-[11.5px] text-muted">Same idea, different tense. Click each sentence into Simple or Continuous.</p>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {column("Simple aspect", "simple")}
        {column("Continuous aspect", "continuous")}
      </div>
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
        <div className="flex flex-col gap-2.5">
          <p className="font-serif text-lg font-semibold text-ink">Example — staging &quot;used to&quot; vs past simple</p>
          <div className="overflow-hidden rounded-[6px] border border-border">
            {EXAMPLE_ROWS.map((r) => (
              <div key={r.label} className="grid grid-cols-[150px_1fr] border-b border-border-faint last:border-b-0">
                <p className="bg-accent px-3 py-2 text-[11px] font-semibold text-ink">{r.label}</p>
                <p className="px-3 py-2 text-[11.5px] leading-relaxed text-muted">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TenseAndAspectSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · language awareness"
      title="Tense and aspect."
      intro="Tense marks when. Aspect marks how the speaker views the action — complete, ongoing, or connected to another point in time. Most language-analysis errors trace back to confusing the two."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–12", spine: "var(--color-primary)", title: "Match the terms" },
        { time: "12–25", spine: "var(--color-destructive)", title: "Choose the aspect" },
        { time: "25–33", spine: "var(--color-primary)", title: "Sort by aspect" },
        { time: "33–42", spine: "var(--color-muted)", title: "Discuss: given pairs" },
        { time: "42–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t lead with terminology. Start from a situation that needs a particular aspect, and let trainees notice
        why the &quot;obvious&quot; tense doesn&apos;t fit — the same principle as guided discovery, applied to grammar most
        trainees think they already know.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            &quot;I&apos;ve read three books this month&quot; and &quot;I&apos;ve been reading a book about Istanbul all
            month.&quot; Both present perfect. What&apos;s different, and it isn&apos;t tense?
          </p>
        </div>
      </div>

      <MatchTermsExercise terms={TERMS} />

      <ChooseAspect />

      <SortByAspect />

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Discuss: these pairs</p>
          <p className="text-[11.5px] text-muted">
            Same idea, two aspects. With a partner, agree what changes in meaning — not just which is &quot;more
            correct.&quot;
          </p>
        </div>
        {DISCUSS_PAIRS.map((p) => (
          <div key={p.a} className="flex flex-col gap-1.5 rounded-[8px] border border-border bg-card p-4">
            <p className="font-serif text-[13px] font-semibold text-ink">{p.a}</p>
            <p className="font-serif text-[13px] font-semibold text-ink">{p.b}</p>
            <p className="text-[11.5px] italic text-muted">{p.prompt}</p>
          </div>
        ))}
      </div>

      <AnswerKey terms={TERMS.map((t) => ({ term: t.term, def: t.definition }))} details={[]} />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
  );
}

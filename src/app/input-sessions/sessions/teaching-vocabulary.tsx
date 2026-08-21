"use client";

import { useEffect, useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Lexical set", definition: "A group of words that share a topic, e.g. weather words." },
  { term: "Collocation", definition: 'Words that naturally occur together — "make a decision," not "do a decision."' },
  { term: "Receptive vocabulary", definition: "Words a learner can understand but might not produce." },
  { term: "Productive vocabulary", definition: "Words a learner can understand and actively use." },
  { term: "Realia", definition: "Real objects brought into the classroom to clarify meaning." },
  { term: "Connotation", definition: "The feeling or association a word carries beyond its literal meaning." },
];

const CHOOSE_OPTIONS = ["Realia / picture", "Cline / scale", "Situation / example sentences", "Definition + example"];
const CHOOSE_ITEMS = [
  { word: "furious", correct: "Cline / scale", feedback: 'A cline against "angry" and "annoyed" shows the relative strength — a definition alone doesn\'t convey intensity.' },
  { word: "umbrella", correct: "Realia / picture", feedback: "A concrete object — showing beats defining." },
  { word: "take up (a hobby)", correct: "Situation / example sentences", feedback: 'A phrasal verb with a non-literal meaning needs context to show what "take up" actually means here.' },
  { word: "nostalgic", correct: "Definition + example", feedback: "An abstract feeling word usually needs a clear definition plus a relatable example, since it can't be shown." },
];

const COLLO_MAKE = ["a decision", "a mistake", "progress", "money"];
const COLLO_MAKE_DISTRACTORS = ["homework", "a favour"];
const COLLO_DO = ["homework", "a favour", "business", "the shopping"];
const COLLO_DO_DISTRACTORS = ["a decision", "money"];

const DISCUSS_QS = [
  "What's one item from your point that could be a whole lexical set, not just a single word?",
  "Which technique would you use for it, and why not one of the others?",
  "Is there a collocation your students are likely to get wrong with this item?",
];

const EXAMPLE_ROWS = [
  { label: "Item", value: "take up (a hobby)" },
  { label: "Meaning", value: "To start doing something regularly, as a new habit or interest." },
  { label: "Technique", value: 'Situation: "I was bored last year, so I took up painting." Elicit what "took up" means from context.' },
  { label: "Form", value: "take up + noun (the object, an activity)" },
  { label: "Pronunciation", value: "/ˈteɪk ʌp/ — stress on both words equally, linking across the phrasal verb." },
];

const NOTES = [
  { label: "Chunks, not just single words", text: 'Push trainees to teach "take up a hobby" as one chunk, not "take" plus "up" separately — much vocabulary is multi-word by nature.' },
  { label: "Don't over-teach", text: "Not every item needs full MFP treatment — a receptive vocabulary item met in a text may only need a quick gloss, not a full clarification stage." },
  { label: "Watch for false friends between techniques and levels", text: 'A technique that works cleanly at B1 (a definition) may need a very different one at A1 (realia, mime) — the "right" technique depends on the group.' },
];

function ChooseTechnique() {
  const [picked, setPicked] = useState<Record<number, string>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Choose a technique for each item</p>
      <p className="text-[11.5px] text-muted">For each word, click the technique you&apos;d actually use to clarify it — then check.</p>
      {CHOOSE_ITEMS.map((item, ci) => {
        const pick = picked[ci];
        return (
          <div key={item.word} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
            <p className="font-serif text-sm font-semibold text-ink">{item.word}</p>
            <div className="flex flex-wrap gap-1.5">
              {CHOOSE_OPTIONS.map((opt) => {
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

function CollocationGroup({ verb, base, correctSet }: { verb: string; base: string[]; correctSet: string[] }) {
  const [options, setOptions] = useState(base);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOptions(shuffle(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-3.5">
      <p className="font-serif text-sm font-semibold text-ink">{verb} ___</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((word) => {
          const isPicked = picked.has(word);
          const isCorrect = correctSet.includes(word);
          return (
            <button
              key={word}
              type="button"
              onClick={() => setPicked((p) => new Set(p).add(word))}
              className={`rounded-[6px] border-[1.5px] px-2.5 py-1 text-[11.5px] font-semibold ${
                isPicked
                  ? isCorrect
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card text-ink"
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TeachingVocabularySession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · language awareness"
      title="Teaching vocabulary and lexis."
      intro="A word isn't one fact to give — it's several: meaning, form, pronunciation, and how it combines with other words. This session works through a real item using techniques you'll use in your own teaching."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–12", spine: "var(--color-primary)", title: "Match the terms" },
        { time: "12–25", spine: "var(--color-destructive)", title: "Choose a technique" },
        { time: "25–35", spine: "var(--color-primary)", title: "Build the collocations" },
        { time: "35–40", spine: "var(--color-muted)", title: "Discuss: your own examples" },
        { time: "40–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        Push past &quot;look it up in a dictionary&quot; — the point of this session is choosing a clarification
        technique deliberately, not defaulting to the same one every time.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: how many words do you think &quot;take up (a hobby)&quot; actually is — one, or more
            than one?
          </p>
        </div>
      </div>

      <MatchTermsExercise terms={TERMS} />

      <ChooseTechnique />

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Build the collocations</p>
          <p className="text-[11.5px] text-muted">
            Vocabulary rarely stands alone. Click the words that naturally collocate with &quot;make,&quot; then with
            &quot;do.&quot;
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <CollocationGroup verb="Make" base={[...COLLO_MAKE, ...COLLO_MAKE_DISTRACTORS]} correctSet={COLLO_MAKE} />
          <CollocationGroup verb="Do" base={[...COLLO_DO, ...COLLO_DO_DISTRACTORS]} correctSet={COLLO_DO} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Discuss: your own examples</p>
          <p className="text-[11.5px] text-muted">Think of your own next TP point&apos;s vocabulary. For each question, jot a quick answer before comparing with a partner.</p>
        </div>
        {DISCUSS_QS.map((q, i) => (
          <div key={q} className="rounded-[6px] border border-border bg-card px-3.5 py-2.5">
            <p className="text-[12.5px] font-semibold text-ink">
              {i + 1}. {q}
            </p>
          </div>
        ))}
      </div>

      <AnswerKey terms={TERMS.map((t) => ({ term: t.term, def: t.definition }))} details={[]} />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
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
          <p className="font-serif text-lg font-semibold text-ink">Example — clarifying &quot;take up (a hobby)&quot;</p>
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

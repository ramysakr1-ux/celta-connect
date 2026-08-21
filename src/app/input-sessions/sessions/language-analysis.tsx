"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const DISCUSS = [
  { question: "Why analyse language before you teach it, rather than just teaching what you already know?", answer: "Because what you already know is intuitive, not explicit — you can use \"used to\" correctly without being able to explain why it's wrong to say \"I use to play.\" Teaching requires the explicit version." },
  { question: "What happens if you skip the phonetic transcription and stress?", answer: "Students learn a grammatically correct sentence they can't say naturally, and can't recognise in fast speech — accuracy on paper, failure in conversation." },
];

const TERMS = [
  { term: "Marker sentence", definition: "The example sentence you'll use to present the structure — natural, in context." },
  { term: "CCQ", definition: "A concept checking question — tests meaning without naming the grammar." },
  { term: "Anticipated problem", definition: "A specific error or confusion you predict for this group, with this item." },
  { term: "Form analysis", definition: "The pattern the structure follows — word order, morphology, what changes." },
  { term: "Phonemic transcription", definition: "The pronunciation written in phonemic symbols, stress marked." },
  { term: "Connected speech", definition: 'How words run together and change in natural fast speech — "gonna," weak "to."' },
  { term: "Clarification technique", definition: "The method used to make meaning clear — a timeline, realia, a definition." },
];

const LA_TYPES = ["Grammar", "Vocabulary", "Functional"] as const;
type LaType = (typeof LA_TYPES)[number];

interface Field {
  label: string;
  hint: string;
  placeholder: string;
}

const GRAMMAR_FIELDS: Field[] = [
  { label: "Name of the structure", hint: "", placeholder: "e.g. going to for future plans" },
  { label: "Marker sentence(s)", hint: "The sentence(s) you will use to present the structure above.", placeholder: "Write a natural, in-context example sentence" },
  { label: "Meaning analysis", hint: "", placeholder: "What does it mean? What could it be confused with?" },
  { label: "Form analysis", hint: "", placeholder: "subject + ... — the pattern, spelled out" },
  { label: "Phonetic transcription & stress", hint: "", placeholder: "Write it in phonemic script, mark the stress" },
  { label: "Source", hint: "Where your analysis came from — grammar reference, learner dictionary.", placeholder: "e.g. Practical English Usage, §___" },
];

const VOCAB_FIELDS: Field[] = [
  { label: "Item", hint: "", placeholder: "e.g. take up (a hobby)" },
  { label: "Definition", hint: "", placeholder: "A clear, learner-level definition" },
  { label: "Clarification technique", hint: "", placeholder: "How will you make the meaning clear?" },
  { label: "Phonetic transcription & stress", hint: "", placeholder: "Write it in phonemic script, mark the stress" },
  { label: "Meaning problems and solutions", hint: "", placeholder: "What could it be confused with, and how will you head that off?" },
  { label: "Source", hint: "", placeholder: "e.g. Cambridge Learner's Dictionary" },
];

const FUNCTIONAL_FIELDS: Field[] = [
  { label: "Function", hint: "", placeholder: "e.g. making suggestions" },
  { label: "Exponent(s)", hint: "The phrase(s) that carry out the function.", placeholder: "e.g. How about...? Why don't you...? You could..." },
  { label: "Meaning analysis", hint: "", placeholder: "What is being achieved socially, not just literally?" },
  { label: "Appropriacy", hint: "", placeholder: "Which context, formality level, relationship does this suit?" },
  { label: "Phonetic transcription & stress, intonation", hint: "", placeholder: "Mark stress and the intonation pattern — often what makes it sound genuine" },
  { label: "Source", hint: "", placeholder: "e.g. a functional language reference or coursebook exponent list" },
];

const EXAMPLE_ROWS = [
  { label: "Name of the structure", value: "going to for future plans" },
  { label: "Marker sentence(s)", value: "I'm going to visit my sister in June." },
  { label: "Meaning analysis", value: "A plan decided before the moment of speaking. Not a prediction, not a spontaneous decision." },
  { label: "Form analysis", value: "subject + be + going to + bare infinitive" },
  { label: "Phonetic transcription & stress", value: "/aɪm ˈɡəʊɪŋ tə ˈvɪzɪt/ — going to often /ɡənə/ in connected speech" },
  { label: "Source", value: "Practical English Usage, §217" },
];

const NOTES = [
  { label: "A grammar reference, always open", text: "Have Practical English Usage or an equivalent to hand — the point isn't memorised knowledge, it's knowing where to check." },
  { label: "Marker sentences must come from somewhere real", text: "Push back on invented, decontextualised sentences — a marker sentence should sound like something a person would plausibly say." },
  { label: "Vocabulary items need the same rigour as grammar", text: 'Trainees often shortcut the vocab sheet because it "feels simpler" — a bad clarification technique or missing stress mark is just as damaging as a bad CCQ.' },
];

function LiveDraft() {
  const [laType, setLaType] = useState<LaType>("Grammar");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const fields = laType === "Vocabulary" ? VOCAB_FIELDS : laType === "Functional" ? FUNCTIONAL_FIELDS : GRAMMAR_FIELDS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-xs font-bold text-ink">Live draft — your next TP point, on the real sheet</p>
        <div className="flex items-center gap-0.5 rounded-[7px] border border-border bg-accent p-0.5">
          {LA_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLaType(t)}
              className={`h-[26px] rounded-[5px] px-2.5 text-[11px] font-semibold ${laType === t ? "bg-primary text-white" : "text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-[6px] border border-border bg-card p-4">
        <div className="overflow-hidden rounded-[6px] border border-border">
          {fields.map((f, i) => {
            const key = `${laType}:${i}`;
            return (
              <div key={key} className="grid grid-cols-[190px_1fr] border-b border-border-faint last:border-b-0">
                <div className="flex flex-col gap-0.5 bg-accent px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">{f.label}</p>
                  {f.hint ? <p className="text-[10px] italic leading-snug text-muted">{f.hint}</p> : null}
                </div>
                <div className="px-2.5 py-1.5">
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={draft[key] || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    className="w-full border-none bg-transparent px-0.5 py-1 text-[11px] leading-relaxed text-ink outline-none placeholder:text-muted"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted">
          Type directly into the fields above. This sheet doesn&apos;t save into your real lesson plan — it&apos;s
          practice, on your own next TP point, before you fill in the actual one.
        </p>
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
          <p className="font-serif text-lg font-semibold text-ink">Example — a completed grammar analysis</p>
          <div className="overflow-hidden rounded-[6px] border border-border">
            {EXAMPLE_ROWS.map((r) => (
              <div key={r.label} className="grid grid-cols-[190px_1fr] border-b border-border-faint last:border-b-0">
                <p className="bg-accent px-3 py-2 text-[11px] font-semibold text-ink">{r.label}</p>
                <p className="px-3 py-2 text-[11px] leading-relaxed text-muted">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LanguageAnalysisSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · day five, input 1 · 45 minutes"
      title="Language analysis, start to finish, on the real sheet."
      intro="Warm up on why analysis exists, clear the jargon, then draft the analysis for your own next TP point on the real form — the one that feeds straight into your lesson plan."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–8", spine: "var(--color-muted)", title: "Why analyse it first?" },
        { time: "8–15", spine: "var(--color-muted)", title: "Jargon match" },
        { time: "15–18", spine: "var(--color-primary)", title: "Choose grammar or vocab" },
        { time: "18–38", spine: "var(--color-primary)", title: "Live draft, own TP point" },
        { time: "38–45", spine: "var(--color-destructive)", title: "Trainer notes + questions" },
      ]}
    >
      <RunningThisSession>
        Open with the two discussion cards — elicit before revealing. Move fast through the jargon match; the real
        work is the live draft in the last twenty minutes, on each trainee&apos;s own point, not a shared example.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: has anyone ever been asked a grammar question mid-lesson they couldn&apos;t answer?
            What did you do?
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">Why analyse it first?</p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {DISCUSS.map((d) => (
            <RevealCard key={d.question} variant="hero" question={d.question} answer={d.answer} />
          ))}
        </div>
      </div>

      <MatchTermsExercise terms={TERMS} />

      <LiveDraft />

      <AnswerKey terms={TERMS.map((t) => ({ term: t.term, def: t.definition }))} details={[]} />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
  );
}

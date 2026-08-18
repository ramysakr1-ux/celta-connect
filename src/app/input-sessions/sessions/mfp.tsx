"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";

const PILLARS = [
  { label: "Meaning", color: "var(--color-primary)", text: "What the item means, checked with CCQs — not the definition, the concept." },
  { label: "Form", color: "var(--color-status-on-track-text)", text: "How it's built and how it changes — spelling, word order, morphology." },
  { label: "Pronunciation", color: "var(--color-destructive)", text: "How it sounds — stress, individual sounds, weak forms, connected speech." },
  { label: "Appropriacy", color: "var(--color-gold)", text: "When it's the right choice — register, formality, who says it to whom." },
];

const CCQ_ITEMS = [
  { item: 'Target: "I wish I had studied harder."', trap: "Trap: students often think this describes the present, not a regret about the past.", model: 'Model CCQ: "Did I study hard? Can I change that now? Am I happy about it?" — three questions, each isolating one part of the concept.' },
  { item: 'Target: "She might be at work."', trap: 'Trap: confusing possibility with certainty, or with permission (a different use of "might").', model: 'Model CCQ: "Do I know for sure where she is? Is this a guess or a fact? Could she be somewhere else?"' },
  { item: 'Target: "By the time I arrived, the meeting had started."', trap: "Trap: students often can't sequence which event happened first.", model: 'Model CCQ: "Which happened first, my arriving or the meeting starting? Was the meeting still starting when I got there, or already underway?"' },
];

const FORM_ITEMS = [
  { pieces: ["She", "hasn't", "finished", "her", "homework", "yet"], trap: 1, feedback: 'The contraction "hasn\'t" hides two pieces students often separate incorrectly when writing: has + not.' },
  { pieces: ["If", "I", "had", "known,", "I'd", "have", "called"], trap: 4, feedback: '"I\'d" is ambiguous in writing — students need to work out from context whether it\'s "I had" or "I would."' },
  { pieces: ["He", "suggested", "that", "she", "see", "a", "doctor"], trap: 4, feedback: 'The bare infinitive "see" (not "sees" or "to see") after "suggested that" is the subjunctive — an irregular pattern students misform constantly.' },
];

const MF_OPTIONS = ["Meaning", "Form", "Pronunciation", "Appropriacy"];
const MF_ITEMS = [
  { example: "I ___ (play) basketball in high school.", note: "Gap-fill", answer: "Form" },
  { example: "Mark the stressed syllable: com-FORT-able", note: "Syllable stress task", answer: "Pronunciation" },
  { example: "Does she still play now, or is that finished?", note: "CCQ against a timeline", answer: "Meaning" },
  { example: '"Could you possibly...?" vs. "Gimme..." — which fits a job interview?', note: "Register choice task", answer: "Appropriacy" },
  { example: "I used playing basketball every day.", note: "Spot the mistake", answer: "Form" },
  { example: 'Listen: "saɪdə" — what two words is the speaker actually saying?', note: "Weak-form / connected-speech dictation", answer: "Pronunciation" },
];

const WEAK_FORM_ITEMS = [
  { written: "I want to go", options: ["/aɪ ˈwɒnt tuː gəʊ/", "/aɪ ˈwɒnə gəʊ/", "/aɪ wɒnt tə gəʊ/"], answer: 1 },
  { written: "What are you doing?", options: ["/wɒt ɑː juː ˈduːɪŋ/", "/ˈwɒtʃə ˈduːɪŋ/", "/wɒt ɑː jʊ duːɪŋ/"], answer: 1 },
  { written: "Going to be late", options: ["/ˈgəʊɪŋ tuː biː leɪt/", "/ˈgɒnə biː leɪt/", "/gəʊɪŋ tə biː leɪt/"], answer: 1 },
  { written: "Give me a hand", options: ["/gɪv miː ə hænd/", "/ˈgɪmiː ə hænd/", "/gɪv mə hænd/"], answer: 1 },
  { written: "She has to leave", options: ["/ʃiː hæz tuː liːv/", "/ʃiː ˈhæstə liːv/", "/ʃiː həz tə liːv/"], answer: 1 },
];

const STRESS_ITEMS = [
  { words: ["I", "don't", "want", "the", "red", "one"], stressed: 2, note: 'Neutral answer to "which one?" — the new information is stressed.' },
  { words: ["I", "don't", "want", "the", "red", "one"], stressed: 4, note: "Contrast — implies someone else does, or a different colour was offered." },
  { words: ["She's", "coming", "on", "Friday", "not", "Monday"], stressed: 5, note: "Correcting a wrong assumption — the corrected word takes the stress." },
];

const APPROPRIACY_ITEMS = [
  { phrase: "Could you possibly pass the salt?", options: ["A stranger at a formal dinner", "Your best friend", "A small child"], answer: 0 },
  { phrase: "Gimme a sec", options: ["Your boss in an email", "A close friend, in person", "A job interviewer"], answer: 1 },
  { phrase: "I would be grateful if you could confirm receipt.", options: ["A text to your sister", "A formal business email", "A spoken request to a flatmate"], answer: 1 },
];

const FLAWS = [
  { title: "Plan A — present perfect for experience", plan: "The teacher presents the form on the board (subject + have/has + past participle), drills the sentence chorally twice, then moves straight to a gap-fill.", fix: "Missing meaning. No CCQs check whether students understand this describes an experience up to now, with no specific time given — students could produce perfect grammatical form while completely misunderstanding when to use it." },
  { title: "Plan B — third conditional", plan: 'The teacher asks two CCQs against a timeline ("Did this really happen? Can we change the past?"), then hands out a gap-fill on the form, and moves to freer practice.', fix: "Missing pronunciation. The weak, contracted \"'d have\" (as in \"I'd have gone\") is never modelled or drilled — students will likely produce three separate, over-stressed words instead of the natural contracted form." },
  { title: 'Plan C — polite requests ("Could you possibly...?")', plan: "The teacher clarifies meaning with CCQs, drills the sentence stress and intonation carefully, then moves to controlled practice.", fix: "Missing appropriacy. Students never discuss when this level of formality is needed versus when it would sound strange — without that, they may use it with a close friend or skip it entirely with a stranger." },
];

const EXAMPLE_ROWS = [
  { label: "Meaning", color: "var(--color-primary)", text: 'CCQs against a timeline: "Did I do this once, or many times? Do I do it now?"' },
  { label: "Form", color: "var(--color-status-on-track-text)", text: "Board: subject + used to + base verb. Highlight it never changes for person or number." },
  { label: "Pronunciation", color: "var(--color-destructive)", text: "Drill the weak, run-together sound: /ˈjuːstə/, not /juːzd tuː/. Mark the schwa." },
];

const NOTES = [
  { label: "Not every item needs all three drilled equally", text: "A TTT lesson only teaches the gap the test revealed — flag that MFP is a checklist to consider, not three things to always spend equal time on." },
  { label: "Sentence stress carries meaning", text: 'If trainees mark the "wrong" word, ask what it would mean if THAT word carried the stress — stress is a meaning choice, not decoration.' },
  { label: "Weak forms are for listening as much as speaking", text: 'Students who can\'t recognise "gonna," "wanna," or a weak "to" /tə/ struggle with listening far more than with grammar.' },
  { label: "Appropriacy is easy to forget entirely", text: "It rarely gets a CCQ or a drill of its own — usually just a one-line comment. Push trainees to build a real, quick check for it, the same as the other three." },
];

function WriteCcq() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Write a CCQ — meaning</p>
      <p className="text-[11.5px] text-muted">For each target item, write one CCQ that isolates the tricky part of the meaning. Compare with the model once you&apos;ve tried.</p>
      {CCQ_ITEMS.map((c, i) => (
        <div key={c.item} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">{c.item}</p>
          <p className="text-[11.5px] text-muted">{c.trap}</p>
          <button
            type="button"
            data-print-hide
            onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
            className="self-start flex h-7 items-center rounded-full border border-primary/40 bg-primary/10 px-3 text-[11px] font-semibold text-primary"
          >
            {open[i] ? "Hide model CCQ" : "Compare with a model CCQ"}
          </button>
          {open[i] ? (
            <div className="rounded-[4px] border-l-[3px] border-primary bg-primary/5 px-3.5 py-2.5">
              <p className="text-xs leading-relaxed text-ink">{c.model}</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function AnalyseForm() {
  const [picks, setPicks] = useState<Record<number, number>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Analyse the form</p>
      <p className="text-[11.5px] text-muted">Click the piece of each pattern that&apos;s most likely to trip students up.</p>
      {FORM_ITEMS.map((fm, fi) => {
        const picked = picks[fi];
        const answered = picked !== undefined;
        return (
          <div key={fm.pieces.join("")} className="flex flex-wrap items-center gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
            <div className="flex min-w-[200px] flex-1 flex-wrap gap-1 font-serif text-sm">
              {fm.pieces.map((piece, pi) => {
                const isPicked = pi === picked;
                const isTrap = pi === fm.trap;
                let cls = "text-ink bg-transparent";
                if (answered && isPicked) cls = pi === fm.trap ? "text-status-on-track-text bg-status-on-track-bg" : "text-destructive bg-destructive/10";
                else if (answered && isTrap) cls = "text-status-on-track-text bg-status-on-track-bg";
                return (
                  <button
                    key={pi}
                    type="button"
                    onClick={() => {
                      if (!answered) setPicks((p) => ({ ...p, [fi]: pi }));
                    }}
                    className={`rounded-[5px] px-1.5 py-0.5 font-semibold ${cls}`}
                  >
                    {piece}
                  </button>
                );
              })}
            </div>
            {answered ? <p className="max-w-[260px] text-[11.5px] text-muted">{fm.feedback}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function QuickFire() {
  const [picks, setPicks] = useState<Record<number, string>>({});
  const correctCount = MF_ITEMS.filter((it, i) => picks[i] === it.answer).length;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Meaning, form, pron, or appropriacy? Quick fire</p>
        <p className="text-[11.5px] text-muted">{`${correctCount} of ${MF_ITEMS.length} correct`}</p>
      </div>
      <p className="text-[11.5px] text-muted">For each task type, click which of the four it&apos;s checking.</p>
      {MF_ITEMS.map((it, i) => {
        const picked = picks[i];
        return (
          <div key={it.example} className="flex flex-wrap items-center justify-between gap-3.5 rounded-[6px] border border-border bg-card px-3.5 py-2.5">
            <div className="min-w-[220px] flex-1">
              <p className="text-[12.5px] font-semibold text-ink">&quot;{it.example}&quot;</p>
              <p className="mt-0.5 text-[11px] italic text-muted">{it.note}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MF_OPTIONS.map((opt) => {
                const isCorrectPick = picked === opt && opt === it.answer;
                const isWrongPick = picked === opt && opt !== it.answer;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPicks((p) => ({ ...p, [i]: opt }))}
                    className={`rounded-full border-[1.5px] px-2.5 py-1.5 text-[11px] font-semibold ${
                      isCorrectPick
                        ? "border-status-on-track-text bg-status-on-track-bg text-status-on-track-text"
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
          </div>
        );
      })}
    </div>
  );
}

function WeakForms() {
  const [picks, setPicks] = useState<Record<number, number>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Transcribe the weak forms</p>
      <p className="text-[11.5px] text-muted">Listen for how each phrase is actually said in fast speech, not how it&apos;s spelled. Click your guess, then check.</p>
      {WEAK_FORM_ITEMS.map((w, i) => {
        const picked = picks[i];
        return (
          <div key={w.written} className="flex flex-wrap items-center justify-between gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
            <p className="min-w-[160px] flex-1 font-serif text-sm font-semibold text-ink">&quot;{w.written}&quot;</p>
            <div className="flex flex-wrap gap-1.5">
              {w.options.map((opt, oi) => {
                const isCorrectPick = picked === oi && oi === w.answer;
                const isWrongPick = picked === oi && oi !== w.answer;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPicks((p) => ({ ...p, [i]: oi }))}
                    className={`rounded-full border-[1.5px] px-2.5 py-1.5 text-[11.5px] font-semibold ${
                      isCorrectPick
                        ? "border-status-on-track-text bg-status-on-track-bg text-status-on-track-text"
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
          </div>
        );
      })}
    </div>
  );
}

function MarkStress() {
  const [picks, setPicks] = useState<Record<number, number>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Mark the sentence — stress and weak forms</p>
      <p className="text-[11.5px] text-muted">Click the word you think carries the main sentence stress in each example.</p>
      {STRESS_ITEMS.map((item, si) => {
        const picked = picks[si];
        const answered = picked !== undefined;
        return (
          <div key={si} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
            <div className="flex flex-wrap gap-1.5 font-serif text-[15px]">
              {item.words.map((w, wi) => {
                const isPicked = wi === picked;
                const isCorrect = wi === item.stressed;
                let cls = "text-ink bg-transparent font-normal";
                if (answered && isPicked) cls = isCorrect ? "text-status-on-track-text bg-status-on-track-bg font-bold" : "text-destructive bg-destructive/10 font-bold";
                else if (answered && isCorrect) cls = "text-status-on-track-text bg-status-on-track-bg font-bold";
                return (
                  <button
                    key={wi}
                    type="button"
                    onClick={() => {
                      if (!answered) setPicks((p) => ({ ...p, [si]: wi }));
                    }}
                    className={`rounded-[4px] px-1.5 py-0.5 ${cls}`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
            {answered ? <p className="text-[11.5px] leading-relaxed text-muted">{item.note}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function Appropriacy() {
  const [picks, setPicks] = useState<Record<number, number>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Appropriacy — which register?</p>
      <p className="text-[11.5px] text-muted">Same meaning, different register. Click who you&apos;d actually say each one to.</p>
      {APPROPRIACY_ITEMS.map((ap, ai) => {
        const picked = picks[ai];
        return (
          <div key={ap.phrase} className="flex flex-wrap items-center justify-between gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
            <p className="min-w-[200px] flex-1 font-serif text-sm font-semibold text-ink">&quot;{ap.phrase}&quot;</p>
            <div className="flex flex-wrap gap-1.5">
              {ap.options.map((opt, oi) => {
                const isCorrectPick = picked === oi && oi === ap.answer;
                const isWrongPick = picked === oi && oi !== ap.answer;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPicks((p) => ({ ...p, [ai]: oi }))}
                    className={`rounded-full border-[1.5px] px-2.5 py-1.5 text-[11px] font-semibold ${
                      isCorrectPick
                        ? "border-status-on-track-text bg-status-on-track-bg text-status-on-track-text"
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
          </div>
        );
      })}
    </div>
  );
}

function SpotTheFlaw() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Spot the flaw — MFPA done badly</p>
      <p className="text-[11.5px] text-muted">Each mini-plan skips part of MFP. Click to reveal what&apos;s missing.</p>
      {FLAWS.map((f, i) => (
        <div key={f.title} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">{f.title}</p>
          <p className="text-xs leading-relaxed text-ink">{f.plan}</p>
          <button
            type="button"
            data-print-hide
            onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
            className="self-start flex h-7 items-center rounded-full border border-destructive/40 bg-destructive/10 px-3 text-[11px] font-semibold text-destructive"
          >
            {open[i] ? "Hide the fix" : "What's missing?"}
          </button>
          {open[i] ? (
            <div className="rounded-[4px] border-l-[3px] border-status-on-track-text bg-status-on-track-bg px-3.5 py-2.5">
              <p className="text-xs leading-relaxed text-ink">{f.fix}</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MfpAnswerKey() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-print-hide
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-ink"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="M11 12 20 3" />
          <path d="M16 8l2 2" />
          <path d="M13 11l2 2" />
        </svg>
        Reveal answer key — save or print to keep
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3.5 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Answer key — handout, to keep</p>
        <div className="flex gap-2" data-print-hide>
          <button type="button" onClick={() => setOpen(false)} className="h-7 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink">
            Hide
          </button>
          <button type="button" onClick={() => window.print()} className="flex h-7 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink">
            Print
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
        <p className="font-serif text-[15px] font-semibold text-ink">Meaning, form or pronunciation?</p>
        {MF_ITEMS.map((row) => (
          <div key={row.example} className="grid grid-cols-[1fr_130px] gap-2.5 border-b border-border-faint py-1">
            <p className="text-[11.5px] text-ink">{row.example}</p>
            <p className="text-[11px] font-semibold text-muted">{row.answer}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
        <p className="font-serif text-[15px] font-semibold text-ink">Model CCQs</p>
        {CCQ_ITEMS.map((row) => (
          <div key={row.item} className="flex flex-col gap-0.5 border-b border-border-faint py-1">
            <p className="text-[11.5px] text-ink">{row.item}</p>
            <p className="text-[11px] italic text-muted">{row.model}</p>
          </div>
        ))}
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
        <div className="flex flex-col gap-2.5">
          <p className="font-serif text-lg font-semibold text-ink">Example — clarifying &quot;used to,&quot; fully MFP&apos;d</p>
          <div className="overflow-hidden rounded-[6px] border border-border">
            <div className="grid grid-cols-[110px_1fr] bg-accent px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
              <p>Focus</p>
              <p>What the teacher does</p>
            </div>
            {EXAMPLE_ROWS.map((r) => (
              <div key={r.label} className="grid grid-cols-[110px_1fr] gap-2 border-b border-border-faint px-3 py-2 last:border-b-0">
                <p className="text-[11px] font-bold" style={{ color: r.color }}>{r.label}</p>
                <p className="text-[11.5px] leading-relaxed text-muted">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MfpSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · language awareness"
      title="MFPA — meaning, form, pronunciation, appropriacy."
      intro="Every target item needs all four covered before it's ready to teach. This session gives each real weight — writing CCQs that isolate meaning, analysing form precisely, not skipping pronunciation, and checking when a form is actually the right choice."
      agenda={[
        { time: "0–2", spine: "var(--color-gold)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-primary)", title: "Meaning, form, pronunciation defined" },
        { time: "5–11", spine: "var(--color-primary)", title: "Write a CCQ" },
        { time: "11–16", spine: "var(--color-status-on-track-text)", title: "Analyse the form" },
        { time: "16–22", spine: "var(--color-destructive)", title: "Transcribe the weak forms" },
        { time: "22–28", spine: "var(--color-destructive)", title: "Mark the stress" },
        { time: "28–33", spine: "var(--color-gold)", title: "Which register?" },
        { time: "33–39", spine: "var(--color-primary)", title: "Meaning, form, pron, or appropriacy?" },
        { time: "39–45", spine: "var(--color-gold)", title: "Spot the flaw + trainer notes" },
      ]}
    >
      <RunningThisSession>
        Give meaning and form the same rigour you&apos;d give pronunciation — a vague CCQ is as much a gap as an
        undrilled weak form. Model pronunciation features yourself before naming them.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: has anyone taught a grammar point perfectly, then watched students say it
            unintelligibly out loud? What went missing?
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">The three, in thirty seconds each</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.label} className="rounded-[8px] border border-t-[3px] bg-card p-3.5" style={{ borderTopColor: p.color, borderColor: "var(--color-border)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: p.color }}>{p.label}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink">{p.text}</p>
            </div>
          ))}
        </div>
      </div>

      <WriteCcq />

      <AnalyseForm />

      <QuickFire />

      <WeakForms />

      <MarkStress />

      <Appropriacy />

      <SpotTheFlaw />

      <MfpAnswerKey />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
  );
}

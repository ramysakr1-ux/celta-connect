"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession } from "@/components/input-sessions/trainer-notes";

const ABBR = [
  { term: "OHP", def: "Overhead projector" },
  { term: "H/O", def: "Handout" },
  { term: "SS", def: "Student(s)" },
  { term: "T", def: "Teacher" },
  { term: "P/W", def: "Pair work" },
  { term: "G/W", def: "Group work" },
  { term: "CB/SB", def: "Coursebook / student's book" },
  { term: "W/B", def: "Whiteboard / workbook" },
  { term: "H/W", def: "Homework" },
  { term: "TTT", def: "Teacher talking time" },
  { term: "STT", def: "Student talking time" },
  { term: "S / L / R / W", def: "Speaking / listening / reading / writing" },
  { term: "W/C", def: "Whole class" },
  { term: "O/C", def: "Open class" },
  { term: "F/B", def: "Feedback" },
  { term: "Realia", def: "Using the real thing, e.g. the real table or chair" },
  { term: "ICQ", def: "Instruction concept question" },
  { term: "CCQ", def: "Concept checking question" },
  { term: "M/F/P", def: "Meaning, form, pronunciation" },
  { term: "TL", def: "Target language" },
];

const TERMS = [
  { term: "Eliciting", def: "Asking Ss questions to draw information out of them and keep them involved." },
  { term: "Nominating", def: "The T asks an individual Ss to answer, rather than the whole class." },
  { term: "Modelling", def: "The T says a word or sentence a few times so Ss hear the correct pronunciation before repeating it." },
  { term: "Choral drilling", def: "The T asks the whole class to repeat a word or sentence together." },
  { term: "Open pairs", def: "Ss talk to each other across the room as a demo, usually for question and answer." },
  { term: "Closed pairs", def: "Ss practise language sitting together." },
  { term: "Monitoring", def: "The T listens to Ss talking during pair or group work." },
  { term: "Target language", def: "The language the T is focusing on in a lesson." },
  { term: "A mingling activity", def: "Ss practise while walking around the room." },
  { term: "Functional language", def: "What we do with language — requesting, advising, suggesting, and so on." },
  { term: "Language grading", def: "The T simplifies their own language so Ss can understand." },
  { term: "Skills work", def: "Practising or developing one or more of the four skills." },
  { term: "Student-centred activity", def: "An activity where Ss do most of the work, usually a lot of pair or group work." },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const BATCHES = { abbr: chunk(ABBR, 6), terms: chunk(TERMS, 5) };

const QUESTION_CARDS = [
  {
    question: "Why do we need a lesson plan at all?",
    answers: [
      "To know your lesson aims",
      "To keep the timing honest",
      "To know the stages of the lesson you're teaching",
      "To anticipate problems and solutions",
      "To look prepared",
      "Because on the CELTA course, you have to 🙂",
    ],
  },
  {
    question: "Who are you actually writing it for?",
    answers: [
      "On the course, you're writing it for your tutor and for the Cambridge assessor.",
      "Outside the course, you're writing it for whoever covers your class if you can't make it in.",
    ],
  },
];

const AFTER_CARDS = [
  { question: "What do you do after writing your plan and teaching the lesson?", answer: "Self-evaluation", note: "Already a step in Connect — written before you read your tutor's feedback." },
  { question: "What do you do while observing your classmates teach?", answer: "Peer observation", note: "Already a step in Connect — notes taken during their TP, same portfolio." },
];

const EXAMPLE_ROWS = [
  { stage: "LEAD IN", interaction: "T-Ss", time: "3′", text: 'T shows two photos of phones and asks "Which is more expensive?" to set up comparatives.' },
  { stage: "PRESENTATION", interaction: "T-Ss, W/B", time: "10′", text: "T models target sentences, checks meaning with CCQs, drills, boards form." },
  { stage: "FREER PRACTICE", interaction: "P/W", time: "8′", text: "Ss compare their hometown and this city in open pairs, T monitors, feedback at the end." },
];

const GROUPS = [
  {
    label: "Group 1 · illustrative only, not this cohort's book or level",
    points: [
      { who: "Candidates A / D", aim: "Function", title: "Making and responding to invitations", materials: "Sample coursebook · Unit 2B, ex. 1–5 + audio 2.2" },
      { who: "Candidates B / E", aim: "Grammar", title: "Comparative adjectives", materials: "Sample coursebook · Unit 2A, ex. 2–6" },
      { who: "Candidates C / F", aim: "Productive", title: "Speaking: describing a place you know well", materials: "Sample coursebook · Unit 2C, ex. 1–3" },
    ],
  },
  {
    label: "Group 2 · illustrative only, not this cohort's book or level",
    points: [
      { who: "Candidates A / D", aim: "Lexis", title: "Vocabulary: clothes and shopping", materials: "Sample coursebook · Unit 2B, ex. 1–4" },
      { who: "Candidates B / E", aim: "Grammar", title: "Present continuous for future arrangements", materials: "Sample coursebook · Unit 2A, ex. 2–5" },
      { who: "Candidates C / F", aim: "Receptive", title: "Listening: booking a hotel room", materials: "Sample coursebook · Unit 2C, audio 2.3 + ex. 1–3" },
    ],
  },
];

const AIM_FIELDS = [
  { label: "Main Aims", hint: "What the learners will be able to do by the end.", h: "48px", prompt: "• By the end of the lesson, Ss will be better able to…" },
  { label: "Subsidiary Aims", hint: "What else the lesson develops along the way.", h: "40px", prompt: "• By the end of the lesson, Ss will have practised…" },
  { label: "Personal Aims", hint: "Take these from the action points in your last feedback.", h: "40px", prompt: "• Think classroom management — what do you want to work on?" },
  { label: "Class Profile", hint: "Who you are teaching — two or three lines is enough.", h: "48px", prompt: "Number, level range, ages, anything that shapes today's lesson." },
];

const STAGE_ROWS = [
  { stage: "LEAD IN", prompt: "One line: how you open the lesson." },
  { stage: "PRESENTATION", prompt: "One line: how meaning and form get clarified." },
  { stage: "FREER PRACTICE", prompt: "One line: what learners do with it." },
];

const TRAINER_NOTES = [
  { title: "The point is real, but this draft isn't saved", text: "Starting from the point they will actually teach makes the practice real — but this sheet doesn't carry into their submitted plan. They'll re-enter it on the real form." },
  { title: "Language analysis is deliberately absent", text: "TP2's point supplies the target language already. This session is about aims, problems and procedure — the parts a candidate builds themselves regardless of framework." },
  { title: "The draft isn't the submission", text: "Saved, not submitted. Tomorrow's supervised lesson planning slot is where it gets finished — today's forty-five minutes just removes the blank page." },
];

function QuestionCard({ question, answers }: { question: string; answers: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`flex min-h-[168px] flex-col gap-3 rounded-[10px] border border-t-[3px] p-5 text-left transition-colors ${
        open ? "border-primary/30 border-t-primary bg-primary/5" : "border-border border-t-primary bg-card"
      }`}
    >
      {open ? (
        <>
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <span className="size-1.5 flex-none rounded-full bg-primary" />
            <p className="font-serif text-sm font-semibold text-ink">{question}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {answers.map((a) => (
              <div key={a} className="flex items-start gap-2">
                <span className="mt-[7px] size-1 flex-none rounded-full bg-primary" />
                <p className="text-[12.5px] leading-relaxed text-ink">{a}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-1 items-center justify-center px-1 py-1.5 text-center">
            <p className="font-serif text-lg font-semibold leading-tight text-ink">{question}</p>
          </div>
          <p className="text-center text-[10.5px] font-semibold text-primary">Click to reveal ▾</p>
        </>
      )}
    </button>
  );
}

function AfterCard({ question, answer, note }: { question: string; answer: string; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`flex min-h-[150px] flex-col gap-3 rounded-[10px] border border-t-[3px] p-5 text-left transition-colors ${
        open ? "border-muted/30 border-t-muted bg-muted/5" : "border-border border-t-muted bg-card"
      }`}
    >
      {open ? (
        <>
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <span className="size-1.5 flex-none rounded-full bg-muted" />
            <p className="font-serif text-sm font-semibold text-ink">{question}</p>
          </div>
          <p className="font-serif text-xl font-semibold text-muted">{answer}</p>
          <p className="text-[11.5px] leading-relaxed text-muted">{note}</p>
        </>
      ) : (
        <>
          <div className="flex flex-1 items-center justify-center px-1 py-1.5 text-center">
            <p className="font-serif text-lg font-semibold leading-tight text-ink">{question}</p>
          </div>
          <p className="text-center text-[10.5px] font-semibold text-muted">Click to reveal ▾</p>
        </>
      )}
    </button>
  );
}

function JargonMatch() {
  const [cat, setCat] = useState<"abbr" | "terms">("abbr");
  const [batch, setBatch] = useState(0);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [shake, setShake] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);

  const batches = BATCHES[cat];
  const pairs = batches[batch];
  const total = cat === "abbr" ? ABBR.length : TERMS.length;
  const matchedCount = [...matched].filter((k) => k.startsWith(cat + ":")).length;

  function key(c: string, b: number, id: number) {
    return `${c}:${b}:${id}`;
  }
  function tryMatch(l: number | null, r: number | null) {
    if (l === null || r === null) return;
    if (l === r) {
      setMatched((m) => new Set(m).add(key(cat, batch, l)));
      setSelL(null);
      setSelR(null);
    } else {
      setShake([l, r]);
      setTimeout(() => {
        setSelL(null);
        setSelR(null);
        setShake([]);
      }, 400);
    }
  }
  function switchCat(c: "abbr" | "terms") {
    setCat(c);
    setBatch(0);
    setSelL(null);
    setSelR(null);
  }

  // right-column order is a plain reverse of the batch, not a random
  // shuffle -- deterministic, so server and client render the same order
  const rightOrderForBatch = pairs.map((_, i) => i).reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="font-serif text-lg font-semibold text-ink">Now, the jargon</p>
        <p className="text-[12.5px] text-muted">A plan is only clear to someone else if it uses shared terms correctly. Click a term, then its meaning.</p>
      </div>
      <div className="flex items-center gap-2">
        {(["abbr", "terms"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => switchCat(c)}
            className={`h-[34px] rounded-[7px] border px-3.5 text-[12.5px] font-semibold ${
              cat === c ? "border-primary bg-primary text-white" : "border-border bg-transparent text-muted"
            }`}
          >
            {c === "abbr" ? `Abbreviations (${ABBR.length})` : `Terminology (${TERMS.length})`}
          </button>
        ))}
        <div className="flex-1" />
        <p className="text-[11.5px] text-muted">{`${matchedCount} of ${total} matched`}</p>
      </div>
      <div className="flex gap-4 rounded-[8px] border border-border bg-card p-5">
        <div className="flex flex-1 flex-col gap-2">
          {pairs.map((p, i) => {
            const isMatched = matched.has(key(cat, batch, i));
            const isSel = selL === i;
            const isShake = shake.includes(i);
            return (
              <button
                key={p.term}
                type="button"
                onClick={() => {
                  if (isMatched) return;
                  setSelL(i);
                  tryMatch(i, selR);
                }}
                className={`flex min-h-[42px] items-center rounded-[6px] border-[1.5px] px-3.5 font-serif text-sm font-semibold ${
                  isMatched
                    ? "border-primary bg-primary/10 text-primary cursor-default"
                    : isSel
                      ? "border-primary bg-primary/10 text-ink"
                      : isShake
                        ? "border-destructive bg-card text-ink"
                        : "border-border bg-card text-ink"
                }`}
              >
                {p.term}
              </button>
            );
          })}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {rightOrderForBatch.map((idx) => {
            const isMatched = matched.has(key(cat, batch, idx));
            const isSel = selR === idx;
            const isShake = shake.includes(idx);
            return (
              <button
                key={pairs[idx].term}
                type="button"
                onClick={() => {
                  if (isMatched) return;
                  setSelR(idx);
                  tryMatch(selL, idx);
                }}
                className={`flex min-h-[42px] items-center rounded-[6px] border-[1.5px] px-3.5 text-left text-xs leading-snug ${
                  isMatched
                    ? "border-primary bg-primary/10 text-primary cursor-default"
                    : isSel
                      ? "border-primary bg-primary/10 text-ink"
                      : isShake
                        ? "border-destructive bg-card text-ink"
                        : "border-border bg-card text-ink"
                }`}
              >
                {pairs[idx].def}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3.5">
        <button
          type="button"
          onClick={() => setBatch((b) => Math.max(0, b - 1))}
          className="flex h-[30px] items-center rounded-[6px] border border-border px-3.5 text-xs font-semibold text-ink"
        >
          ← Previous
        </button>
        <p className="text-[11.5px] text-muted">{`Batch ${batch + 1} of ${batches.length}`}</p>
        <button
          type="button"
          onClick={() => setBatch((b) => Math.min(batches.length - 1, b + 1))}
          className="flex h-[30px] items-center rounded-[6px] bg-primary px-3.5 text-xs font-semibold text-white"
        >
          Next →
        </button>
      </div>

      {!revealed ? (
        <button
          type="button"
          data-print-hide
          onClick={() => setRevealed(true)}
          className="self-start mt-1 flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-muted/10 px-4 text-xs font-semibold text-muted"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="M11 12 20 3" />
            <path d="M16 8l2 2" />
            <path d="M13 11l2 2" />
          </svg>
          Reveal answer key — save or print to keep
        </button>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">All matched — handout · answer key, to keep</p>
            <div className="flex gap-2" data-print-hide>
              <button type="button" onClick={() => setRevealed(false)} className="h-7 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink">
                Hide
              </button>
              <button type="button" onClick={() => window.print()} className="flex h-7 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink">
                Print
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { title: "Abbreviations", rows: ABBR },
              { title: "Terminology", rows: TERMS },
            ].map((h) => (
              <div key={h.title} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
                <p className="font-serif text-[15px] font-semibold text-ink">{h.title}</p>
                {h.rows.map((row) => (
                  <div key={row.term} className="grid grid-cols-[96px_1fr] gap-2.5 border-b border-border-faint py-1">
                    <p className="font-serif text-xs font-semibold text-ink">{row.term}</p>
                    <p className="text-[11px] leading-snug text-muted">{row.def}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-destructive/25 bg-destructive/5 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-destructive">
              <span className="size-1.5 rounded-full bg-current" />
              Trainer only — trainer notes
            </p>
            <p className="text-[12.5px] leading-relaxed text-ink">
              Don&apos;t let anyone get stuck rewriting the jargon match by hand — the point is speed and shared
              vocabulary, not memorisation. The real work is the last thirty-five minutes; keep the room moving there.
            </p>
          </div>
        </div>
      )}
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
        <div className="flex flex-col gap-2">
          <p className="font-serif text-lg font-semibold text-ink">Example — a completed procedure section</p>
          <div className="overflow-hidden rounded-[6px] border border-border">
            <div className="grid grid-cols-[130px_90px_55px_1fr] bg-accent px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
              <p>Stage</p>
              <p>Interaction</p>
              <p>Time</p>
              <p>Procedure</p>
            </div>
            {EXAMPLE_ROWS.map((r) => (
              <div key={r.stage} className="grid grid-cols-[130px_90px_55px_1fr] gap-2 border-b border-border-faint px-3 py-2 last:border-b-0">
                <p className="text-[11px] font-bold text-ink">{r.stage}</p>
                <p className="text-[11px] text-muted">{r.interaction}</p>
                <p className="text-[11px] text-muted">{r.time}</p>
                <p className="text-[11.5px] leading-relaxed text-muted">{r.text}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted">This is one stage written in full — this is the standard your one modelled stage should meet by minute 40.</p>
        </div>
      ) : null}
    </div>
  );
}

function LessonPlanDraft() {
  const [aims, setAims] = useState<Record<number, string>>({});
  const [probs, setProbs] = useState<Record<string, string>>({});
  const [stages, setStages] = useState<Record<string, string>>({});

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3.5 rounded-[6px] border border-border bg-card p-4">
          <p className="text-xs font-bold text-ink">Front page — draft it live, on the real document</p>
          {AIM_FIELDS.map((f, i) => (
            <div key={f.label} className="flex flex-col gap-1">
              <p className="text-xs text-muted">{f.label}</p>
              <p className="text-[11px] italic leading-snug text-muted">{f.hint}</p>
              <textarea
                placeholder={f.prompt}
                value={aims[i] || ""}
                onChange={(e) => setAims((a) => ({ ...a, [i]: e.target.value }))}
                style={{ minHeight: f.h }}
                className="box-border resize-y rounded-[6px] border border-border bg-card px-2.5 py-2 text-[11.5px] leading-relaxed text-ink outline-none placeholder:text-muted"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 rounded-[6px] border border-border bg-card p-4">
          <p className="text-xs font-bold text-ink">Anticipated Problems &amp; Solutions</p>
          <p className="text-[11px] italic leading-snug text-muted">Think classroom management, not language — that&apos;s tomorrow&apos;s session.</p>
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-1.5 border-b border-dashed border-border-faint pb-2.5 last:border-b-0">
              <input
                type="text"
                placeholder="A problem with the materials or task."
                value={probs[`${i}:p`] || ""}
                onChange={(e) => setProbs((p) => ({ ...p, [`${i}:p`]: e.target.value }))}
                className="box-border rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-[11px] text-ink outline-none placeholder:text-muted"
              />
              <input
                type="text"
                placeholder="What you will do about it."
                value={probs[`${i}:s`] || ""}
                onChange={(e) => setProbs((p) => ({ ...p, [`${i}:s`]: e.target.value }))}
                className="ml-3.5 box-border rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-[11px] text-ink outline-none placeholder:text-muted"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-[6px] border border-border bg-card p-4">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="font-serif text-base font-semibold text-ink">Procedure — stages come from your framework</p>
            <p className="text-[11px] italic text-muted">TP2 is Full script: stage names are set, you write timing and instructions.</p>
          </div>
          <div className="flex h-8 w-[180px] flex-none items-center justify-between rounded-[6px] border border-border bg-accent px-2.5 text-xs text-ink">
            <span>Full script</span>
            <span className="text-[9px] text-muted">▾</span>
          </div>
        </div>
        <div className="overflow-hidden rounded-[6px] border border-border">
          <div className="grid grid-cols-[168px_92px_62px_1fr] bg-accent px-2.5 py-2">
            {["Stage", "Interaction", "Time", "Procedure"].map((h) => (
              <p key={h} className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">{h}</p>
            ))}
          </div>
          {STAGE_ROWS.map((r, i) => (
            <div key={r.stage} className="grid grid-cols-[168px_92px_62px_1fr] items-start gap-2 border-b border-border-faint p-2.5 last:border-b-0">
              <div className="rounded-[5px] border border-border bg-accent px-2 py-1.5 text-[11px] font-semibold text-ink">{r.stage}</div>
              <input
                type="text"
                placeholder="interaction"
                value={stages[`${i}:i`] || ""}
                onChange={(e) => setStages((s) => ({ ...s, [`${i}:i`]: e.target.value }))}
                className="box-border w-full rounded-[5px] border border-border bg-card px-2 py-1.5 text-[11px] text-ink outline-none placeholder:text-muted"
              />
              <input
                type="text"
                placeholder="min"
                value={stages[`${i}:t`] || ""}
                onChange={(e) => setStages((s) => ({ ...s, [`${i}:t`]: e.target.value }))}
                className="box-border w-full rounded-[5px] border border-border bg-card px-2 py-1.5 text-center text-[11px] text-ink outline-none placeholder:text-muted"
              />
              <textarea
                placeholder={r.prompt}
                value={stages[`${i}:p`] || ""}
                onChange={(e) => setStages((s) => ({ ...s, [`${i}:p`]: e.target.value }))}
                className="box-border w-full min-h-[32px] resize-y rounded-[5px] border border-border bg-card px-2 py-1.5 text-[11px] leading-relaxed text-ink outline-none placeholder:text-muted"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted">By minute 40 every trainee has stage names in, timings estimated, and one stage&apos;s procedure written in full as a model for the rest.</p>
      </div>
    </div>
  );
}

export default function LessonPlanningSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · day two, input 1 · 45 minutes"
      title="Lesson planning, start to finish, in one input session."
      intro="Warm up on why a plan exists and who reads it, clear the jargon, then draft the real thing on the real TP2 point. Everything a trainee needs for this session lives on this one page."
      agenda={[
        { time: "0–5", spine: "var(--color-muted)", title: "Warm-up: why plan?" },
        { time: "5–10", spine: "var(--color-muted)", title: "Jargon match" },
        { time: "10–15", spine: "var(--color-primary)", title: "Your TP2 point" },
        { time: "15–20", spine: "var(--color-primary)", title: "Aims" },
        { time: "20–27", spine: "var(--color-destructive)", title: "Problems & solutions" },
        { time: "27–40", spine: "var(--color-primary)", title: "Procedure" },
        { time: "40–45", spine: "var(--color-primary)", title: "Wrap-up: save and next steps" },
      ]}
    >
      <RunningThisSession>
        Open with the two discussion cards — elicit from the room before clicking to reveal. Move fast through the
        jargon match; the answer key unlocks once every item is matched. The remaining thirty-five minutes is real
        drafting on each trainee&apos;s own TP2 point, not a worksheet about one.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: has anyone here ever taught, or tried to teach, without writing anything down first?
            How did it go?
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">Open with these two questions</p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {QUESTION_CARDS.map((q) => (
            <QuestionCard key={q.question} question={q.question} answers={q.answers} />
          ))}
        </div>
      </div>

      <JargonMatch />

      <StagingExample />

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">TP2 · three points per teaching group, however many groups the cohort needs</p>
        <p className="max-w-[1000px] text-[11.5px] leading-relaxed text-muted">
          A shared input session, not a per-group one. Each group runs ABC on Thursday and DEF on Friday from its own
          three points, at its own level and coursebook. The cards below are stand-ins to show the shape only — every
          trainee opens their own real point.
        </p>
        {GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold text-muted">{g.label}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {g.points.map((p) => (
                <div key={p.title} className="flex flex-col gap-2.5 rounded-[6px] border border-border bg-card p-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                      {p.who} · {p.aim}
                    </p>
                  </div>
                  <p className="font-serif text-base font-semibold leading-tight text-ink">{p.title}</p>
                  <p className="text-xs leading-relaxed text-muted">{p.materials}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <LessonPlanDraft />

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="font-serif text-lg font-semibold text-ink">What comes after</p>
          <p className="text-[12.5px] text-muted">Two more questions before they leave — elicit first, then reveal.</p>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {AFTER_CARDS.map((c) => (
            <AfterCard key={c.question} question={c.question} answer={c.answer} note={c.note} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-[8px] border border-destructive/25 bg-destructive/5 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-destructive">
          <span className="size-1.5 rounded-full bg-current" />
          Trainer only
        </p>
        {TRAINER_NOTES.map((n) => (
          <div key={n.title} className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-ink">{n.title}</p>
            <p className="text-xs leading-relaxed text-ink">{n.text}</p>
          </div>
        ))}
      </div>
    </SessionShell>
  );
}

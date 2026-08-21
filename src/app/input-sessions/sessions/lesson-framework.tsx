"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";

const SHAPES = [
  { name: "PPP", spine: "var(--color-primary)", stages: "Lead-in → Present (meaning, form, pronunciation) → Practice (accuracy) → Production (fluency) → Error correction" },
  { name: "Test-Teach-Test", spine: "var(--color-muted)", stages: "Lead-in → First test (diagnostic) → Teach (clarify gaps) → Second test → Feedback" },
  { name: "Text-Based", spine: "var(--color-primary)", stages: "Lead-in → Reading/listening task → Highlight target language → Clarify → Practice → Feedback" },
  { name: "Language Practice", spine: "var(--color-muted)", stages: "Lead-in (optional) → Set up → Controlled practice → Freer practice → Feedback" },
  { name: "Receptive Skills", spine: "var(--color-destructive)", stages: "Lead-in → (Prediction) → Pre-teach vocab → Gist → Detail → Specific info → Post-task response" },
  { name: "Productive Skills", spine: "oklch(48% 0.11 300)", stages: "Lead-in → Preparing to write/speak → Useful language (optional) → Task → Feedback" },
];

const ZONE_NAMES = ["PPP", "TTT", "Text-Based", "Language Practice", "Receptive Skills", "Productive Skills"];
const STAGES = [
  { text: "Present: clarify meaning, form, pronunciation", zone: "PPP" },
  { text: "First test — diagnostic", zone: "TTT" },
  { text: "Highlight target language in the text", zone: "Text-Based" },
  { text: "Set up a controlled practice activity", zone: "Language Practice" },
  { text: "Prediction task", zone: "Receptive Skills" },
  { text: "Useful language (optional support)", zone: "Productive Skills" },
];

const SEQ_FRAMEWORKS: Record<string, string[]> = {
  PPP: ["Lead-in", "Present: clarify and focus on TL", "Practice", "Production", "Error correction"],
  TTT: ["Lead-in", "First test (diagnostic)", "Teach (clarifying)", "Second test", "Feedback"],
  "Receptive Skills": ["Lead-in", "(Prediction task)", "Pre-teach vocabulary", "Gist task", "Detail task", "Post-task response"],
  "Language Practice": ["Lead-in (optional)", "Set up", "Controlled practice", "Freer practice", "Feedback"],
};

const PACING_STAGES = ["Lead-in & Text Reading (Gist/Detail)", "Clarification (MFPA)", "Controlled Practice & Feedback"];

const SCENARIOS = [
  { text: "Students do a gap-fill on reported speech with no prior teaching. The teacher notes common errors, then clarifies just those before a second, similar task.", options: ["PPP", "TTT", "Text-Based", "Language Practice"], correct: "TTT" },
  { text: "A short listening about someone's daily routine. The teacher elicits present simple examples from the audio script, then clarifies meaning, form and pronunciation before controlled practice.", options: ["Text-Based", "PPP", "Receptive Skills", "Productive Skills"], correct: "Text-Based" },
  { text: "The teacher presents the third conditional with a timeline and CCQs, drills pronunciation, then moves to a gap-fill followed by a freer personalised speaking task.", options: ["PPP", "TTT", "Language Practice", "Text-Based"], correct: "PPP" },
  { text: "Students skim a news article for gist, read again for detail, then react orally to the content in pairs.", options: ["Receptive Skills", "Productive Skills", "Text-Based", "TTT"], correct: "Receptive Skills" },
];

const NOTES = [
  { label: "This is a map, not a rulebook", text: "Some real lessons blend two shapes — flag that a text-based lesson's language-focus stage can itself run as guided discovery." },
  { label: '"Useful language" isn\'t target language', text: "In Productive Skills lessons, this trips people up constantly — it's optional support for the task, not something to formally present and drill." },
];

function DecisionTree() {
  return (
    <div className="flex flex-col items-center gap-0 rounded-[8px] border border-border bg-card p-5">
      <p className="rounded-[8px] border-[1.5px] border-border bg-accent px-5 py-2.5 text-center font-serif text-base font-semibold text-ink">
        Is the main aim language or skills?
      </p>
      <div className="h-5 w-[1.5px] bg-border" />
      <div className="grid w-full grid-cols-2 gap-10">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary">Language</p>
          <p className="text-center text-xs text-muted">Does the target language arise from a text?</p>
          <div className="flex w-full gap-2">
            <div className="flex-1 rounded-[6px] border border-primary/25 bg-primary/5 p-2 text-center text-[11.5px] font-semibold text-primary">No → PPP / TTT</div>
            <div className="flex-1 rounded-[6px] border border-primary/25 bg-primary/10 p-2 text-center text-[11.5px] font-semibold text-primary">Yes → Text-Based</div>
          </div>
          <div className="w-full rounded-[6px] border border-muted/25 bg-muted/10 p-2 text-center text-[11.5px] font-semibold text-muted">Practice only → Language Practice</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-destructive">Skills</p>
          <p className="text-center text-xs text-muted">Is it listening or reading?</p>
          <div className="flex w-full gap-2">
            <div className="flex-1 rounded-[6px] border border-destructive/25 bg-destructive/5 p-2 text-center text-[11.5px] font-semibold text-destructive">Yes → Receptive Skills</div>
            <div className="flex-1 rounded-[6px] border border-border bg-accent p-2 text-center text-[11.5px] font-semibold text-muted">No → Productive Skills</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardSort() {
  const [selected, setSelected] = useState<number | null>(null);
  const [placed, setPlaced] = useState<Record<number, string>>({});

  function pickCard(i: number) {
    if (placed[i]) return;
    setSelected(i);
  }
  function pickZone(zoneName: string) {
    if (selected === null) return;
    if (STAGES[selected].zone === zoneName) {
      setPlaced((p) => ({ ...p, [selected]: zoneName }));
    }
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Card sort — pin each stage to its shape</p>
        <p className="text-[11.5px] text-muted">{`${Object.keys(placed).length} of ${STAGES.length} pinned`}</p>
      </div>
      <p className="text-[11.5px] text-muted">Click a stage, then the shape you think it belongs to.</p>
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s, i) => {
          const isPlaced = !!placed[i];
          const isSel = selected === i;
          return (
            <button
              key={s.text}
              type="button"
              onClick={() => pickCard(i)}
              disabled={isPlaced}
              className={`rounded-[6px] border-[1.5px] px-3.5 py-2 text-xs font-semibold ${isSel ? "border-primary bg-primary/10 text-ink" : "border-border bg-card text-ink"} ${isPlaced ? "opacity-25" : ""}`}
            >
              {s.text}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ZONE_NAMES.map((name) => {
          const filledIdx = Object.keys(placed).find((k) => placed[Number(k)] === name);
          const filled = filledIdx !== undefined;
          return (
            <button
              key={name}
              type="button"
              onClick={() => pickZone(name)}
              className={`flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded-[8px] border-[1.5px] border-dashed p-2.5 ${
                filled ? "border-primary bg-primary/10" : "border-border bg-accent"
              }`}
            >
              <p className="font-serif text-[12.5px] font-semibold text-ink">{name}</p>
              {filled ? <p className="text-center text-[10.5px] font-semibold text-primary">{STAGES[Number(filledIdx)].text}</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BuildSequence() {
  const [seqFw, setSeqFw] = useState("PPP");
  const [built, setBuilt] = useState<string[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());

  const correct = SEQ_FRAMEWORKS[seqFw];
  const done = built.length === correct.length;
  const allCorrect = done && built.every((s, i) => s === correct[i]);

  function switchFw(fw: string) {
    setSeqFw(fw);
    setBuilt([]);
    setUsed(new Set());
  }
  function pickChip(stage: string) {
    if (used.has(stage)) return;
    setBuilt((b) => [...b, stage]);
    setUsed((u) => new Set(u).add(stage));
  }
  function removeSlot(idx: number) {
    const stage = built[idx];
    setBuilt((b) => b.filter((_, i) => i !== idx));
    setUsed((u) => {
      const next = new Set(u);
      next.delete(stage);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Build the sequence — pick a shape</p>
        <p className="text-[11.5px] text-muted">
          {done ? (allCorrect ? "Correct order!" : "Not quite — click a slot to remove it and retry") : `${built.length} of ${correct.length} placed`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.keys(SEQ_FRAMEWORKS).map((fw) => (
          <button
            key={fw}
            type="button"
            onClick={() => switchFw(fw)}
            className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[11.5px] font-semibold ${
              fw === seqFw ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-ink"
            }`}
          >
            {fw}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {correct.map((stage) => (
          <button
            key={stage}
            type="button"
            disabled={used.has(stage)}
            onClick={() => pickChip(stage)}
            className={`rounded-[6px] border-[1.5px] border-border bg-card px-3 py-1.5 text-[11.5px] font-semibold text-ink ${used.has(stage) ? "opacity-25" : ""}`}
          >
            {stage}
          </button>
        ))}
      </div>
      <div className="flex min-h-[40px] flex-col gap-1.5">
        {built.map((stage, i) => {
          const isCorrect = done && stage === correct[i];
          const bad = done && !isCorrect;
          return (
            <button
              key={i}
              type="button"
              onClick={() => removeSlot(i)}
              className={`flex items-center gap-2.5 rounded-[6px] border-[1.5px] px-3 py-2 text-left ${
                bad ? "border-destructive bg-destructive/10" : isCorrect ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span
                className={`flex size-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold ${
                  bad ? "bg-destructive text-white" : isCorrect ? "bg-primary text-white" : "bg-accent text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="text-[11.5px] font-semibold text-ink">{stage}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NameThatFramework() {
  const [solved, setSolved] = useState<Record<number, boolean>>({});
  const count = Object.keys(solved).length;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Name that framework</p>
        <p className="text-[11.5px] text-muted">{`${count} of ${SCENARIOS.length} correct`}</p>
      </div>
      {SCENARIOS.map((s, si) => (
        <div key={s.text} className="flex flex-col gap-2.5 rounded-[8px] border border-border bg-card p-4">
          <p className="text-[12.5px] leading-relaxed text-ink">{s.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {s.options.map((opt) => {
              const show = solved[si] && opt === s.correct;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (opt === s.correct) setSolved((sv) => ({ ...sv, [si]: true }));
                  }}
                  className={`rounded-full border-[1.5px] px-2.5 py-1 text-[11.5px] font-semibold ${
                    show ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-ink"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StageTimer() {
  const [pacing, setPacing] = useState([0, 0, 0]);
  const [revealed, setRevealed] = useState(false);
  const total = pacing.reduce((a, b) => a + b, 0);
  const totalCls = total === 45 ? "bg-primary/10 text-primary" : total > 45 ? "bg-destructive/10 text-destructive" : "bg-accent text-ink";

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-bold text-ink">Stage timer — pacing challenge</p>
      <p className="text-xs leading-relaxed text-muted">
        You have 45 minutes for a Text-Based lesson. Budget the minutes across the three stages below — the total
        should land close to 45.
      </p>
      {PACING_STAGES.map((name, i) => (
        <div key={name} className="flex items-center justify-between gap-3.5 rounded-[6px] border border-border bg-card px-3.5 py-2.5">
          <p className="text-xs font-semibold text-ink">{name}</p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={45}
              value={pacing[i] || ""}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 0;
                setPacing((p) => {
                  const next = [...p];
                  next[i] = v;
                  return next;
                });
              }}
              className="w-14 rounded-[5px] border-[1.5px] border-border px-1.5 py-1 text-center text-xs text-ink outline-none"
            />
            <p className="text-[11.5px] text-muted">min</p>
          </div>
        </div>
      ))}
      <p className={`rounded-[6px] px-4 py-2.5 text-center font-serif text-[15px] ${totalCls}`}>Total: {total} / 45 min</p>
      <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
        <p className="text-[12.5px] font-semibold text-ink">
          If your Lead-in &amp; Text Reading stage runs 5 minutes over, which stage do you trim without destroying the
          lesson aim?
        </p>
        <button
          type="button"
          data-print-hide
          onClick={() => setRevealed((r) => !r)}
          className="self-start flex h-[30px] items-center rounded-full border border-primary/40 bg-primary/10 px-3.5 text-[11.5px] font-semibold text-primary"
        >
          Reveal the answer
        </button>
        {revealed ? (
          <div className="rounded-[4px] border-l-[3px] border-primary bg-primary/10 px-3.5 py-2.5">
            <p className="text-xs leading-relaxed text-ink">
              Trim <strong className="font-semibold">Controlled Practice &amp; Feedback</strong>, not Clarification.
              Clarification (meaning, form, pronunciation) is where the actual learning happens — cutting it short
              undermines the lesson aim. Practice can run one activity instead of two, or feedback can be briefer,
              without losing the core teaching point.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LessonFrameworkSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · loop input"
      title="Lesson framework — finding your shape."
      intro="A map of the six lesson shapes trainees will meet across the course, and the one question that decides between them: is the main aim language or skills?"
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–7", spine: "var(--color-primary)", title: "The decision tree" },
        { time: "7–12", spine: "var(--color-primary)", title: "The six shapes" },
        { time: "12–22", spine: "var(--color-primary)", title: "Card sort" },
        { time: "22–30", spine: "var(--color-primary)", title: "Build the sequence" },
        { time: "30–38", spine: "var(--color-destructive)", title: "Name that framework" },
        { time: "38–43", spine: "var(--color-muted)", title: "Stage timer" },
        { time: "43–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        This is deliberately an overview, not a deep dive — each shape gets its own full loop input elsewhere. Treat
        this as the map trainees return to before choosing a framework for their own TP.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: when you plan a lesson, what&apos;s the first decision you make — the language point,
            the skill, or the activity?
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">The one question that decides your shape</p>
        <DecisionTree />
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">The six shapes, stage by stage</p>
          <p className="text-[11.5px] text-muted">Study these for a couple of minutes before the card sort below — you&apos;ll need them.</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {SHAPES.map((sh) => (
            <div key={sh.name} className="rounded-[8px] border border-t-[3px] bg-card p-3" style={{ borderTopColor: sh.spine, borderColor: "var(--color-border)" }}>
              <p className="font-serif text-[13.5px] font-semibold text-ink">{sh.name}</p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">{sh.stages}</p>
            </div>
          ))}
        </div>
      </div>

      <CardSort />

      <BuildSequence />

      <NameThatFramework />

      <StageTimer />

      <TrainerNotes notes={NOTES} />
    </SessionShell>
  );
}

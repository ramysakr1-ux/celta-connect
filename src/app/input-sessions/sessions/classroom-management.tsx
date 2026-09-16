"use client";

import { useEffect, useRef, useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { GOLD, MUTED, TEAL } from "@/components/input-sessions/tokens";

// design_handoff_input_sessions_2 §4 -- "Classroom Management Input Session",
// the last of the five finished-but-never-ported designs. It has TWO slots on
// day one ("Classroom management" and "Classroom management / Zoom"), so both
// cards were dead.
//
// "Classroom management is decisions made in real time, under a clock, with
// five things happening at once. The activities below put trainees in that
// position directly -- nothing here is a worksheet." Which is why the two
// centrepieces are live: a 60-second monitoring simulation where five pairs
// change state while you decide who to go to, and an instruction checker that
// reads what a trainee actually wrote.
//
// Correction is deliberately absent -- it has a session of its own
// (error-correction).

const SIM_SECONDS = 60;

type PairStatus = "fine" | "stuck" | "finished" | "offtask" | "dispute";

const PAIRS: { key: string; label: string; changeAt: number | null; status: PairStatus; statusText: string }[] = [
  { key: "A", label: "Pair A", changeAt: 20, status: "stuck", statusText: "Confused, hand half-raised" },
  { key: "B", label: "Pair B", changeAt: 50, status: "finished", statusText: "Finished, sitting back" },
  { key: "C", label: "Pair C", changeAt: 5, status: "offtask", statusText: "Chatting in L1, off task" },
  { key: "D", label: "Pair D", changeAt: 35, status: "dispute", statusText: "Raised voices, disagreement" },
  // Never changes. The trap: checking in here is the commonest new-teacher
  // habit -- over-monitoring the pair that is already fine.
  { key: "E", label: "Pair E", changeAt: null, status: "fine", statusText: "Working fine" },
];

const RESPONSES: Record<PairStatus, { label: string; good: boolean; why: string }[]> = {
  stuck: [
    { label: "Give them the answer directly.", good: false, why: "Fixes this instance but teaches them to wait for you instead of trying." },
    { label: "Ask a couple of the CCQs again, more slowly.", good: true, why: "Checks understanding without just handing over the answer." },
    { label: "Tell them to keep going, you’ll come back.", good: false, why: "Leaves them stuck-and-unsupported — they may disengage before you’re back." },
  ],
  finished: [
    { label: "Let them sit until time’s up.", good: false, why: "Wastes their time and often turns into chat that pulls others off task." },
    { label: "Give a quick extension — compare with another early pair.", good: true, why: "Keeps them engaged without cutting the main task short for everyone else." },
    { label: "End the activity for the whole class now.", good: false, why: "Cuts the activity short for pairs who still need the time." },
  ],
  offtask: [
    { label: "Call out across the room to use English.", good: false, why: "Public and vague — doesn’t address this pair directly, can embarrass them." },
    { label: "Go over, gesture at the task, ask a quick question in English.", good: true, why: "Direct and low-key — re-engages them without a public callout." },
    { label: "Ignore it, it’s probably not important.", good: false, why: "Off-task chat rarely resolves on its own and tends to spread." },
  ],
  dispute: [
    { label: "Separate them immediately.", good: false, why: "Often unnecessary and can escalate rather than defuse it." },
    { label: "Go over, lower your own voice, ask what they disagree about.", good: true, why: "Models the calm you want and treats it as content, not just noise." },
    { label: "Raise your voice to be heard over them.", good: false, why: "Matches their energy instead of defusing it." },
  ],
  fine: [
    { label: "Stop them and ask if they have a problem.", good: false, why: "Interrupts a pair that’s working well and can make them doubt themselves for no reason." },
    { label: "Smile, nod, move on without stopping them.", good: true, why: "Acknowledges them without breaking their flow — they don’t need input right now." },
    { label: "Sit down and start explaining anyway.", good: false, why: "Unneeded input eats time you needed for a pair that actually has a problem." },
  ],
};

const VARIABLES: { label: string; prompt?: string; tag?: string }[] = [
  {
    label: "Seating and the teacher’s position in the class",
    prompt:
      "Where you stand changes who you’re actually teaching. Online, what replaces “position” — camera framing, gallery view, pinned video?",
  },
  { label: "Eye contact", prompt: "How do you spread eye contact across a whole room without ignoring the edges?" },
  {
    label: "Voice projection",
    prompt:
      "Volume isn’t the only tool — pace, pitch and pausing carry weight too. What’s the risk of using the same volume for instructions as for feedback?",
  },
  {
    label: "Use of aids: whiteboard, audio, pictures, realia, handouts",
    prompt: "Which aid would most change how you’d teach a classroom with no working screen?",
  },
  {
    label: "Names",
    prompt:
      "Online, names are right there on screen — memorising isn’t really the problem. Face-to-face, it is. Either way: how do you get the pronunciation right, and actually use names while you’re teaching, not just at register?",
  },
  { label: "Praise and encouragement", prompt: "What’s the difference between praise that motivates and praise a student tunes out?" },
  { label: "Rapport", prompt: "Rapport isn’t the same as being liked. What builds it faster than friendliness does?" },
  { label: "Correction", tag: "Its own session" },
  {
    label: "Variety of activities",
    prompt: "Variety for its own sake vs. variety that serves the lesson aims — where’s the line?",
  },
  { label: "Monitoring", tag: "Practised below — simulation" },
  { label: "The teacher’s classroom language and instructions", tag: "Practised below — instruction check" },
  { label: "Timing and pace", tag: "Practised below — internal clock" },
];

const STOP_ITEMS: { technique: string; use: string }[] = [
  {
    technique: 'Countdown ("finishing in 10… 9…")',
    use: "Good for tasks naturally winding down — a clear, low-drama endpoint without cutting anyone off mid-sentence.",
  },
  {
    technique: "Hands up / raised hand signal",
    use: "Fast and silent — best for noisy group work when your voice won’t carry, or online when unmuting everyone is chaos.",
  },
  {
    technique: "Music (start/stop cue)",
    use: "Works well with younger learners or energisers — the room self-polices when the music stops.",
  },
  {
    technique: "One-minute warning, then stop",
    use: "Best default for most tasks — lets students finish a thought instead of stopping abruptly.",
  },
  {
    technique: "Move physically to the front / retake the floor",
    use: "Reclaims attention without raising your voice — effective once rapport is established, less so early on.",
  },
];

const INSTRUCTION_TASKS: { prompt: string; needsICQ: boolean }[] = [
  { prompt: "Pairs interview each other about their weekend.", needsICQ: false },
  { prompt: "Groups of three put these six sentences in order to reconstruct the story.", needsICQ: false },
  { prompt: "Individually, correct the error in each of these five sentences, then compare in pairs.", needsICQ: true },
  {
    prompt: "In groups, decide which of three job candidates you would hire and prepare to justify your choice.",
    needsICQ: true,
  },
];

const RED = "oklch(45% 0.15 27)";

export default function ClassroomManagementSession() {
  return (
    <SessionShell
      slug="classroom-management"
      title="Classroom management — think on your feet"
      intro="Classroom management is decisions made in real time, under a clock, with five things happening at once. The activities below put trainees in that position directly — nothing here is a worksheet. Correction gets its own dedicated session."
      agenda={[
        { time: "0–4", title: "Lead-in", spine: GOLD },
        { time: "4–19", title: "What CM entails", spine: GOLD },
        { time: "19–34", title: "Monitoring", spine: TEAL },
        { time: "34–54", title: "Instructions", spine: RED },
        { time: "54–56", title: "Internal clock", spine: MUTED },
        { time: "56–60", title: "Wrap-up", spine: GOLD },
      ]}
    >
      <RunningThisSession>
        One shared screen for trainer and trainees — project it, or have trainees open it on their own devices for the
        individual activities. The real discussion is the live “what do you say?” choices, not a wrap-up after the fact.
      </RunningThisSession>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">Lead-in · 4 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          What do you think classroom management entails? Four minutes to brainstorm as many things as you can in your
          group before moving on.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">What classroom management entails · 15 minutes</h2>
          <p className="text-label text-muted">
            The fuller list. Compare it with what your group brainstormed — click each for a discussion prompt. Four are
            tagged: one has its own session, three you practise below.
          </p>
        </div>
        <ol className="flex flex-col gap-2">
          {VARIABLES.map((v, i) => (
            <li key={v.label}>
              {v.prompt ? (
                <RevealCard question={`${String(i + 1).padStart(2, "0")} · ${v.label}`} answer={v.prompt} />
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-dashed border-border bg-accent/30 px-4 py-3">
                  <span className="text-label text-ink">
                    {String(i + 1).padStart(2, "0")} · {v.label}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold text-primary">
                    {v.tag}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <MonitoringSimulation />

      <InstructionPractice />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Stopping an activity</h2>
          <p className="text-label text-muted">Five ways to take the room back. Click each for when it is the right one.</p>
        </div>
        <div className="flex flex-col gap-2">
          {STOP_ITEMS.map((s) => (
            <RevealCard key={s.technique} question={s.technique} answer={s.use} />
          ))}
        </div>
      </section>

      <InternalClock />

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">Wrap-up · 4 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          One thing from the monitoring simulation you will do differently, and one instruction you will write down in
          full before your next TP rather than improvising it in the room.
        </p>
      </section>

      <TrainerNotes
        notes={[
          {
            label: "Running “What classroom management entails” · 15 minutes",
            text: "Give trainees a few minutes to go through the list themselves and click into the ones they're curious about, then a quick whole-group round to clarify what the task itself is asking for.",
          },
          {
            label: "Correction is deliberately absent from this list",
            text: "It's on the source handout, but it gets a full session of its own — naming it and moving on stops this turning into a correction discussion.",
          },
          {
            label: "Monitoring: Pair E is the trap",
            text: "It never changes status. Trainees who check in on it anyway are showing the most common new-teacher habit: over-monitoring the pair that's already fine because it's easiest, while a real problem elsewhere waits.",
          },
          {
            label: "Monitoring: there is no single correct order",
            text: 'The debrief should surface reasoning, not a scored right answer — but off-task behaviour and disputes usually cannot wait as long as "finished early", which just needs an extension task.',
          },
          {
            label: "Monitoring is deliberately face-to-face — use the contrast",
            text: "In the room you can see all five pairs at once and choose where to go. In breakout rooms you cannot — you see nothing until you join one. Online monitoring means rotating through rooms on a timer, watching the chat, or asking pairs to ping you, because you have lost the ambient awareness this simulation assumes. That contrast is the second slot.",
          },
          {
            label: "Instructions: walk the room, don't just watch the marks",
            text: "For anyone whose instruction flags, ask them to read it back and say, in their own words, why — what was missing or unclear. The check is a prompt for that conversation, not a grade.",
          },
        ]}
      />
    </SessionShell>
  );
}

// ---------------------------------------------------------------------------

function MonitoringSimulation() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [openPair, setOpenPair] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setElapsed((e) => {
        if (e + 0.2 >= SIM_SECONDS) {
          if (timer.current) clearInterval(timer.current);
          setRunning(false);
          return SIM_SECONDS;
        }
        return e + 0.2;
      });
    }, 200);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  const done = elapsed >= SIM_SECONDS;
  const remaining = Math.max(0, SIM_SECONDS - Math.floor(elapsed));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">Monitoring · 15 minutes</h2>
          <p className="text-label text-muted">
            Sixty seconds of a pairwork task. Pairs change as it runs — go to one and choose what you actually say. You
            will not get to all of them, which is the point.
          </p>
        </div>
        <span className="font-serif text-h1 font-semibold tabular-nums" style={{ color: running ? RED : undefined }}>
          0:{String(remaining).padStart(2, "0")}
        </span>
      </div>

      {!running && elapsed === 0 ? (
        <button
          type="button"
          onClick={() => setRunning(true)}
          className="self-start rounded-full bg-primary px-4 py-2 text-label font-semibold text-primary-foreground"
        >
          Start the task
        </button>
      ) : null}

      <div className="flex flex-col gap-2">
        {PAIRS.map((p) => {
          const changed = elapsed > 0 && (p.changeAt === null ? false : elapsed >= p.changeAt);
          const status: PairStatus = p.changeAt === null ? "fine" : changed ? p.status : "fine";
          const label = elapsed === 0 ? "On task" : status === "fine" ? "Working fine" : p.statusText;
          const urgent = status === "offtask" || status === "dispute";
          const pick = chosen[p.key];
          const options = RESPONSES[status];
          return (
            <div
              key={p.key}
              className={`flex flex-col gap-2 rounded-[8px] border px-4 py-3 ${
                pick !== undefined
                  ? options[pick]?.good
                    ? "border-primary/40 bg-primary/5"
                    : "border-destructive/40 bg-destructive/5"
                  : urgent
                    ? "border-destructive/40 bg-card"
                    : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-meta font-semibold text-ink">{p.label}</span>
                <span
                  className="text-label font-semibold"
                  style={{
                    color: status === "fine" ? MUTED : status === "stuck" ? GOLD : status === "finished" ? TEAL : RED,
                  }}
                >
                  {label}
                </span>
              </div>
              {pick === undefined ? (
                openPair === p.key ? (
                  <div className="flex flex-col gap-1.5">
                    {options.map((o, i) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => setChosen((c) => ({ ...c, [p.key]: i }))}
                        className="rounded-[6px] border border-border px-3 py-1.5 text-left text-label text-ink hover:border-primary"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenPair(p.key)}
                    className="self-start text-label font-semibold text-primary"
                  >
                    Go over to them ▾
                  </button>
                )
              ) : (
                <p className={`text-label leading-relaxed ${options[pick].good ? "text-primary" : "text-destructive"}`}>
                  {options[pick].good ? "✓ " : "✗ "}
                  {options[pick].why}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {done ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-dashed border-border bg-accent/30 px-4 py-3">
          <p className="text-meta text-ink">
            Time. Which pairs did you reach, in which order, and which one never actually needed you?
          </p>
          <button
            type="button"
            onClick={() => {
              setElapsed(0);
              setChosen({});
              setOpenPair(null);
            }}
            className="rounded-full border border-border px-3 py-1 text-label font-semibold text-ink"
          >
            Run it again
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------

const HEDGES = /\b(maybe|sort of|kind of|if you could|whenever|might|just)\b/i;
const POLITE_OPENER = /^\s*(if you don'?t mind|i(?:'d| would)? (?:like|want) you to|could you|would you mind|do you think you could|would it be possible|can you|please)\b/i;
const TASK_VERB = /\b(interview|ask|write|discuss|complete|decide|match|order|correct|read|listen|underline|circle|tell|put)\b/i;
const GROUPING = /\b(pairs?|groups?|individually|alone|everyone|whole class|threes)\b/i;
const BAD_ICQ = /\b(do you understand|is that clear|understand\?|clear\?)\b/i;

/** The four things a usable instruction has, and the two it must not have. */
function checkInstruction(text: string, needsICQ: boolean) {
  const t = text.trim();
  if (!t) return null;
  return [
    { ok: TASK_VERB.test(t), label: "Says what to DO", hint: "Name the action: interview, order, decide, correct." },
    { ok: GROUPING.test(t), label: "Says who with", hint: "Pairs, threes, groups, individually — say it before the task, not after." },
    { ok: !HEDGES.test(t), label: "No hedging", hint: "“Maybe”, “sort of”, “just”, “if you could” — all of it goes." },
    {
      ok: !POLITE_OPENER.test(t),
      label: "An instruction, not a request",
      hint: "“Could you…?” invites a yes or no. Say “Work in pairs.”",
    },
    {
      ok: !needsICQ || (/\?/.test(t) && !BAD_ICQ.test(t)),
      label: needsICQ ? "Has a real ICQ" : "No false check",
      hint: needsICQ
        ? "This task needs a check question — and “Do you understand?” is not one. Ask something only someone who understood can answer."
        : "“Do you understand?” checks nothing; leave it out.",
    },
  ];
}

function InstructionPractice() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const task = INSTRUCTION_TASKS[index];
  const results = checkInstruction(text, task.needsICQ);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-h3 font-semibold text-ink">Instructions · 20 minutes</h2>
        <p className="text-label text-muted">
          Write the instruction you would actually say, word for word. Then say it out loud to your partner, who does only
          what you literally asked for.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {INSTRUCTION_TASKS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setIndex(i);
              setText("");
            }}
            className={`rounded-full px-3 py-1 text-label font-semibold ${
              i === index ? "bg-primary text-primary-foreground" : "border border-border text-muted"
            }`}
          >
            Task {i + 1}
          </button>
        ))}
      </div>

      <p className="rounded-[6px] border border-dashed border-border bg-accent/30 px-3 py-2 text-meta text-ink">
        <strong className="font-semibold">The task:</strong> {task.prompt}
      </p>

      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="“Work in pairs. Ask your partner about their weekend…”"
        className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-meta leading-relaxed text-ink outline-none focus:border-primary"
      />

      {results ? (
        <ul className="flex flex-col gap-1.5">
          {results.map((r) => (
            <li
              key={r.label}
              className={`flex items-start gap-2.5 rounded-[6px] border px-3 py-2 ${
                r.ok ? "border-primary/30 bg-primary/5" : "border-status-warning-text/40 bg-status-warning-bg"
              }`}
            >
              <span className={`flex-none text-label font-bold ${r.ok ? "text-primary" : "text-status-warning-text"}`}>
                {r.ok ? "✓" : "!"}
              </span>
              <span className="text-label leading-relaxed text-ink">
                <strong className="font-semibold">{r.label}</strong>
                {r.ok ? "" : ` — ${r.hint}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-label italic text-muted">The check appears as you type. It is a prompt for discussion, not a grade.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function InternalClock() {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [result, setResult] = useState<number | null>(null);
  const started = useRef(0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-h3 font-semibold text-ink">Your internal clock · 2 minutes</h2>
        <p className="text-label text-muted">
          Start it, and stop it when you think exactly one minute has passed. No counting, no watching anything.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (state === "running") {
              setResult((Date.now() - started.current) / 1000);
              setState("done");
            } else {
              started.current = Date.now();
              setResult(null);
              setState("running");
            }
          }}
          className="rounded-full bg-primary px-4 py-2 text-label font-semibold text-primary-foreground"
        >
          {state === "running" ? "Stop — that’s a minute" : state === "done" ? "Try again" : "Start"}
        </button>
        {result !== null ? (
          <p className="text-meta text-ink">
            <strong className="font-semibold tabular-nums">{result.toFixed(1)}s.</strong>{" "}
            {result < 45
              ? "Short — under pressure a minute feels much longer than it is, which is why tasks get cut before learners are ready."
              : result > 75
                ? "Long — easy to do when you are absorbed, and it is how a five-minute task quietly becomes twelve."
                : "Close. Most people are not — which is why you say the time out loud and set a timer rather than trusting the feeling."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

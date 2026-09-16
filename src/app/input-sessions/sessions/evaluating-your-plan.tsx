"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";

// Written 13 Sep 2026, not ported -- there was no design for it.
//
// Criterion 4n: "reflecting on and evaluating their plans in light of the
// learning process and suggesting improvements for future plans." Cambridge's
// guidance is two bullets and both are about the PLAN:
//
//   discuss and note the strengths and weaknesses of your lesson plan after
//   your lesson
//   address weak areas in the planning of future TP lessons
//
// That is the whole session, because it is the thing trainees conflate.
// Asked to evaluate their plan they evaluate their nerves -- which is 5m,
// a different criterion, already covered. 4n asks whether the DOCUMENT was
// any good, and what changes in the next one.
//
// Every candidate writes a self-evaluation after every TP, and nothing on
// the course taught them how. It is assessed eight times.

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const RED = "oklch(45% 0.15 27)";

// Real post-TP sentences. Some are plainly one or the other; two are
// genuinely both, and those are the ones worth the argument.
const SORT: ChoiceScenario[] = [
  {
    text: "“I spent eleven minutes on the lead-in. I’d allowed four.”",
    choices: ["The plan", "The teaching"],
    correctIndex: 0,
    feedback:
      "The plan. Four minutes was never enough for that lead-in — the timing was wrong on paper before anyone stood up. Next plan: three minutes, and the discussion question cut to one.",
  },
  {
    text: "“I was really nervous at the start and my hands were shaking.”",
    choices: ["The plan", "The teaching"],
    correctIndex: 1,
    feedback:
      "The teaching — and it belongs in your self-evaluation, which is criterion 5m. It is real and it matters; it is just not what 4n is asking about.",
  },
  {
    text: "“Nobody could do the gist task. The text was too hard for them.”",
    choices: ["The plan", "The teaching"],
    correctIndex: 0,
    feedback:
      "The plan. Choosing a text above the level is a materials decision made at the desk (4c), and the anticipated-problems section should have caught it. Next plan: check the text against the level before you write the tasks, not after.",
  },
  {
    text: "“My instructions for the second activity confused everyone and I had to start again.”",
    choices: ["The plan", "The teaching"],
    correctIndex: 1,
    feedback:
      "The teaching, mostly — but look at the plan before you accept that. If the procedure column said “set up activity 2” rather than the words you would actually say, the plan let you improvise, and that IS a plan weakness.",
  },
  {
    text: "“The practice stage had no purpose. They just did it and we moved on.”",
    choices: ["The plan", "The teaching"],
    correctIndex: 0,
    feedback:
      "The plan. A stage with no stated aim is a staging failure on paper (4b). If you cannot say in one line what a stage is FOR, it should not be in the plan.",
  },
  {
    text: "“I finished eight minutes early and had nothing left.”",
    choices: ["The plan", "The teaching"],
    correctIndex: 0,
    feedback:
      "The plan — specifically the absence of one. Every plan needs an extension you can drop if you have time and lose if you do not. Next plan: write it in, at the bottom, every time.",
  },
];

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: "1 · Did the aim get achieved — and how do you know?",
    a: "Not “I think it went well”. What did learners produce by the end that they could not produce at the start? If you cannot name the evidence, either the aim was unmeasurable when you wrote it (4a) or you never built a stage that would show it.",
  },
  {
    q: "2 · Did each stage do the job the plan said it would?",
    a: "Go stage by stage down your own procedure. For each one: was it for this, and did it do this? A stage that ran fine but did not serve the aim is still a planning problem — it took time from a stage that would have.",
  },
  {
    q: "3 · What is different in the NEXT plan?",
    a: "The one sentence that makes it 4n rather than a diary. Not “be more confident” — something you will write differently: a timing, a set of instructions in full, an extension task, a CCQ you will script in advance, an anticipated problem you missed.",
  },
];

const REWRITES: { weak: string; why: string; strong: string }[] = [
  {
    weak: "“The lesson went quite well overall but I think I talked too much.”",
    why: "Two judgements, no evidence, nothing about the plan, nothing to change.",
    strong:
      "“The clarification stage ran to nine minutes of the twelve because I explained the form instead of eliciting it — the plan said ‘clarify meaning and form’ with no CCQs written out. Next plan: the CCQs go in the procedure column in full, with the expected answers.”",
  },
  {
    weak: "“The students enjoyed the activity and were engaged.”",
    why: "Engagement is not the aim. This tells a reader nothing about whether the learners could do anything at the end.",
    strong:
      "“By the freer stage six of eight learners were using ‘used to’ unprompted, which was the aim — I could hear it while monitoring. The two who were not had been in the pair that finished the controlled practice first and sat waiting, so the plan needed an extension for early finishers.”",
  },
  {
    weak: "“I ran out of time and didn’t do the last stage.”",
    why: "True, but stops at the symptom. Which stage overran, and what was the plan’s share of it?",
    strong:
      "“I lost the last stage because the reading took fourteen minutes against the eight I had planned — the text was 400 words and I had timed it as if it were 200. Next plan: cut the text or the tasks, and time the reading by actually reading it at learner pace.”",
  },
];

const CARRY: { where: string; what: string }[] = [
  {
    where: "Timing column",
    what: "Every stage that overran by more than two minutes last time gets a new number, not the same one hopefully.",
  },
  {
    where: "Procedure column",
    what: "Anything you improvised and got wrong gets written out in full — instructions, CCQs, the example you will board.",
  },
  {
    where: "Anticipated problems and solutions",
    what: "Whatever actually went wrong that you had not predicted goes in this section of the next plan. This is the single most direct route from one lesson to the next.",
  },
  {
    where: "Materials",
    what: "A text that was too long or too hard is a materials decision. Note the level check you will do before writing tasks.",
  },
  {
    where: "The extension you did not have",
    what: "If you finished early once, every plan from now on ends with something droppable.",
  },
];

export default function EvaluatingYourPlanSession() {
  return (
    <SessionShell
      eyebrow="Input session · 45 minutes · planning · after TP2"
      title="Evaluating your plan — what changes in the next one"
      intro="You write a self-evaluation after every teaching practice, and it is assessed every time. Most of them are about how the teacher felt. This one is about whether the document was any good — which is a different question, a different criterion, and the only one that improves the next lesson."
      agenda={[
        { time: "0–5", title: "Whose fault was it?", spine: GOLD },
        { time: "5–17", title: "The plan, or the teaching?", spine: RED },
        { time: "17–27", title: "Three questions", spine: TEAL },
        { time: "27–37", title: "Rewrite it", spine: TEAL },
        { time: "37–43", title: "Carry it forward", spine: TEAL },
        { time: "43–45", title: "Wrap-up", spine: GOLD },
      ]}
    >
      <RunningThisSession>
        Trainees need their own last plan and their own last self-evaluation open beside this — the rewrite stage is done
        on their own words, not the examples. Do not let the session become a feedback session about their teaching;
        every time it drifts there, ask “and what does the next plan say differently?”
      </RunningThisSession>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg font-semibold text-ink">1 · Whose fault was it? · 5 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          A lesson goes badly. In pairs, two lists: things the <strong>plan</strong> did, and things the{" "}
          <strong>teacher</strong> did. Two minutes, then read a few out.
        </p>
        <p className="text-xs italic text-muted">
          Most lists come back almost entirely teacher. That imbalance is the session.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">2 · The plan, or the teaching? · 12 minutes</h2>
          <p className="text-xs text-muted">
            Six things trainees have actually written after a TP. Which criterion is each one really about — 4n (the
            plan) or 5m (how you taught)? Two of them are genuinely both.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {SORT.map((s) => (
            <ChoiceScenarioCard key={s.text} scenario={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">3 · The three questions · 10 minutes</h2>
          <p className="text-xs text-muted">
            Every plan evaluation answers these, in this order. Anything else is optional; these are not.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {QUESTIONS.map((q) => (
            <RevealCard key={q.q} question={q.q} answer={q.a} />
          ))}
        </div>
      </section>

      <RewriteStage />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">5 · Carry it forward · 6 minutes</h2>
          <p className="text-xs text-muted">
            Cambridge’s second bullet for 4n is “address weak areas in the planning of future TP lessons”. So: which part
            of the next plan does each lesson change?
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {CARRY.map((c) => (
            <RevealCard key={c.where} question={c.where} answer={c.what} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg font-semibold text-ink">Wrap-up · 2 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          Open your next lesson plan now, before you leave. Write one thing into it that came out of your last one — a
          timing, an instruction in full, an anticipated problem, an extension. One line, in the plan, today.
        </p>
      </section>

      <TrainerNotes
        notes={[
          {
            label: "Why this session exists",
            text: "4n is assessed on every self-evaluation a candidate writes -- eight times over the course -- and nothing on the course taught them what it is asking for. They evaluate their nerves, which is 5m, and the plan goes unexamined.",
          },
          {
            label: "1 · The imbalance is the point",
            text: 'Let the "teacher" list run long before you say anything. When you ask what the PLAN did wrong, most rooms go quiet. That silence is worth sitting in for a few seconds.',
          },
          {
            label: "2 · The two that are both",
            text: 'The instructions item and the "nobody could do the gist task" item are the arguments worth having. The test to give them: could you have prevented it at the desk? If yes, some of it belongs to the plan, however badly it also went in the room.',
          },
          {
            label: "3 · Evidence, not feeling",
            text: '"How do you know?" is the question to keep asking. A candidate who cannot say what learners produced by the end either wrote an unmeasurable aim or never built a stage that would show it -- both are planning problems, and both are fixable tonight.',
          },
          {
            label: "4 · Use their own words",
            text: "The three examples are a warm-up. The real task is their own last self-evaluation, open beside this, rewritten. Collect two and read them out -- with permission, and pick ones that improved.",
          },
          {
            label: "5 · Anticipated problems is the route",
            text: "If they take one thing: whatever went wrong that they had not predicted goes into the anticipated-problems section of the next plan. That single habit is most of 4n, and it shows up in the plan a tutor marks.",
          },
          {
            label: "Do not let it become feedback",
            text: 'This is not a TP feedback session and it is not about how anyone taught. Every time it drifts, ask "and what does the next plan say differently?"',
          },
        ]}
      />
    </SessionShell>
  );
}

function RewriteStage() {
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-lg font-semibold text-ink">4 · Rewrite it · 10 minutes</h2>
        <p className="text-xs text-muted">
          Three sentences from real self-evaluations. Rewrite each so it is about the plan, carries evidence, and says
          what changes — then compare with a version that does.
        </p>
      </div>
      {REWRITES.map((r, i) => (
        <div key={r.weak} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="text-meta leading-relaxed text-ink">{r.weak}</p>
          <p className="text-label italic" style={{ color: GOLD }}>
            {r.why}
          </p>
          <textarea
            rows={3}
            value={drafts[i] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
            placeholder="Rewrite it — what the plan did, how you know, and what is different next time."
            className="w-full rounded-[6px] border border-border bg-card px-3 py-2 text-meta leading-relaxed text-ink outline-none focus:border-primary"
          />
          <RevealCard question="Compare with one that works" answer={r.strong} />
        </div>
      ))}
      <p className="text-meta leading-relaxed text-ink">
        Now the real one: open your own last self-evaluation and do the same to it.
      </p>
    </section>
  );
}

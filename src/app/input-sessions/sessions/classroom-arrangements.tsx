"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";

// design_handoff_input_sessions_2 -- "Classroom Arrangements Input Session",
// the second of Classroom management's two day-one slots.
//
// It was folded into classroom-management as an extension when that one was
// ported, which left criterion 5a -- "arranging the classroom appropriately
// for teaching and learning" -- as one of twelve criteria no input session
// on the course taught (criteria map, 13 Sep 2026). Ramy: "give 5a its own
// slot." It has one now, and it is the slot that was already there: day one
// at 16:15, which had been pointing at the Classroom management session.
//
// The Zoom material the old title promised is still here, as the Online
// equivalent section -- breakout rooms ARE the online arrangement question.

const LAYOUTS: { name: string; good: string; breaks: string }[] = [
  {
    name: "Rows / theatre style",
    good: "Lecture-style input, watching a demonstration, exam conditions — anything where the teacher is the sole focus.",
    breaks: "Any pair or group task — half the room can only see the backs of heads, and moving desks mid-lesson costs time.",
  },
  {
    name: "Horseshoe / U-shape",
    good: "Whole-class discussion, eliciting from the board, keeping everyone visible to you and each other.",
    breaks: "Large classes — the shape gets too wide for genuine eye contact with everyone, and pair work still needs a rearrange.",
  },
  {
    name: "Clusters / islands",
    good: "Group work as the default mode, project-style tasks, ongoing pair/group activities without rearranging each time.",
    breaks: "Whole-class input or discussion — students face each other, not you, so attention drifts during teacher-led moments.",
  },
  {
    name: "Open space / no fixed seating",
    good: "Mingling activities, running dictation, physical response tasks — anything needing movement.",
    breaks: "Any task needing sustained writing or a stable surface — students end up hunting for somewhere to put a pen down.",
  },
];

const MATERIALS: { name: string; detail: string }[] = [
  {
    name: "Whiteboard",
    detail:
      "Job: capture language that emerges live — a model sentence, marked stress, a student’s own error. Cost: whatever’s erased is gone, so anything worth keeping needs copying down before you move on.",
  },
  {
    name: "Handout",
    detail:
      "Job: gives every student the same fixed text to work from, at their own pace. Cost: printed once, it can’t adapt mid-lesson the way a whiteboard can.",
  },
  {
    name: "Realia (real objects)",
    detail:
      "Job: concept-checks meaning instantly, no translation needed — holding up an actual umbrella beats defining one. Cost: only works for concrete, portable things.",
  },
  {
    name: "Pictures / flashcards",
    detail:
      "Job: elicits vocabulary or sets a scene without a wall of text. Cost: open to more than one interpretation — worth a quick check that the picture means what you think it means.",
  },
  {
    name: "Audio / video",
    detail:
      "Job: the only aid that brings real pronunciation, pace, and connected speech into the room. Cost: needs working playback checked before the lesson, not during it.",
  },
];

// One lesson, three stages, and the arrangement changes twice. The feedback
// names the right answer and why the other two are wrong, per stage.
const STAGES: (ChoiceScenario & { stage: string })[] = [
  {
    stage: "Stage 1 — Lead-in",
    text: "Whole-class discussion to activate what students already know about the topic.",
    choices: ["Rows", "Horseshoe", "Clusters"],
    correctIndex: 1,
    feedback:
      "A horseshoe keeps you and every student mutually visible — right for a whole-class discussion. Rows keep everyone facing you, not each other; clusters split attention into small groups before you have even set up the topic.",
  },
  {
    stage: "Stage 2 — Pair task",
    text: "Students interview each other using the target language.",
    choices: ["Rows", "Horseshoe", "Clusters"],
    correctIndex: 2,
    feedback:
      "Clusters put pairs naturally facing each other — the easiest fit for this stage. Rows force students to twist around to face a partner; a horseshoe still isn’t built for pair-facing conversation.",
  },
  {
    stage: "Stage 3 — Whole-class feedback",
    text: "Comparing answers and clarifying language as a class.",
    choices: ["Rows", "Horseshoe", "Clusters"],
    correctIndex: 1,
    feedback:
      "Back to a horseshoe (or a quick reset toward it) — feedback is whole-class again, same reasoning as Stage 1. Rows work, but the horseshoe keeps students facing each other too; clusters leave them facing their own group, not the board.",
  },
];

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const RED = "oklch(45% 0.15 27)";

export default function ClassroomArrangementsSession() {
  return (
    <SessionShell
      eyebrow="Input session · 45 minutes · classroom skills · day one, second slot"
      title="Classroom arrangements and material use"
      intro="The room’s shape and what’s on the walls or in trainees’ hands changes what a lesson can do before a single word is spoken. This session is about matching the arrangement to the activity, not defaulting to whatever’s already set up."
      agenda={[
        { time: "0–14", title: "Four layouts", spine: TEAL },
        { time: "14–26", title: "Plan the switch", spine: GOLD },
        { time: "26–38", title: "Materials", spine: TEAL },
        { time: "38–45", title: "Online equivalent", spine: RED },
      ]}
    >
      <RunningThisSession>
        Run it in the room you are actually in — start by asking what the current arrangement is good for, and what it
        would break. The middle stage is the one that matters: a single lesson where the arrangement has to change twice.
      </RunningThisSession>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">Match the layout to the activity · 14 minutes</h2>
          <p className="text-xs text-muted">Click a layout for what it is actually good for, and where it breaks down.</p>
        </div>
        <div className="flex flex-col gap-2">
          {LAYOUTS.map((l) => (
            <RevealCard key={l.name} question={l.name} answer={`Good for: ${l.good}\n\nBreaks down when: ${l.breaks}`} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">Plan the switch — one lesson, three stages · 12 minutes</h2>
          <p className="text-xs text-muted">
            Same lesson throughout. Pick the arrangement for each stage, then check the reasoning — the answer changes
            twice, and that is the point.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {STAGES.map((s) => (
            <div key={s.stage} className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{s.stage}</p>
              <ChoiceScenarioCard scenario={s} />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">Materials — what is the aid actually doing? · 12 minutes</h2>
          <p className="text-xs text-muted">Every material choice has a job, and a cost. Click each for both.</p>
        </div>
        <div className="flex flex-col gap-2">
          {MATERIALS.map((m) => (
            <RevealCard key={m.name} question={m.name} answer={m.detail} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg font-semibold text-ink">Online equivalent · 7 minutes</h2>
        <p className="text-[12.5px] leading-relaxed text-ink">
          Breakout rooms replace physical rearranging — pair, small-group and whole-class “layouts” are just different
          room configurations. The planning question is the same: does this activity need everyone seeing everyone (main
          room, gallery view), or small isolated groups (breakouts)? Screen-share and annotation tools replace the
          whiteboard; a shared doc or the chat replaces the handout on the desk.
        </p>
        <p className="text-[12.5px] leading-relaxed text-ink">
          Run the three stages above again, online: which room configuration for each, and what replaces the board?
        </p>
      </section>

      <TrainerNotes
        notes={[
          {
            label: "Start in the room you are in",
            text: "Before opening anything, ask what the current arrangement is good for and what it would break. Most training rooms are a horseshoe or clusters, so the answer is in front of them.",
          },
          {
            label: "The switch is the session",
            text: "Trainees pick one layout and stay there. The middle stage exists to show that a single 45-minute lesson can need the room to change twice — and that the change has to be planned and timed, not improvised.",
          },
          {
            label: "Cost, not just job",
            text: "On the materials cards, push them on the COST line. Everyone can say what a whiteboard is for; few plan for the fact that what is erased is gone.",
          },
          {
            label: "Online is not a lesser case",
            text: "Breakouts are an arrangement decision made while planning, exactly like desks. If the course is mixed-mode, run the online pass properly rather than as an afterthought.",
          },
          {
            label: "Where this lands in TP",
            text: "5a is assessed on teaching practice from TP1. Ask each trainee to name, before they leave, the arrangement they will use for their first lesson and which stage it will have to change for.",
          },
        ]}
      />
    </SessionShell>
  );
}

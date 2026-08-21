"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";

interface Stage {
  name: string;
  control: string;
  accent: string;
  desc: string;
  example: string;
}

const STAGES: Stage[] = [
  { name: "Controlled practice", control: "One right answer", accent: "var(--color-primary)", desc: "Learners produce the target form with little to no choice in what they say — the answer is fixed, the focus is accuracy.", example: 'Gap-fill: "___ we get pizza tonight?" (Why don\'t) — only one correct completion, everyone produces the identical structure.' },
  { name: "Semi-controlled practice", control: "Structure fixed, content theirs", accent: "var(--color-muted)", desc: "The frame or task is set by the teacher, but learners supply their own real content within it — some genuine choice, some constraint.", example: 'Roleplay cards: "Suggest doing something this weekend to your partner, using \'Why don\'t we...\' or \'How about...\'" — structure is cued, but what they suggest is up to them.' },
  { name: "Free practice", control: "No constraint at all", accent: "var(--color-destructive)", desc: "Learners communicate freely to achieve a real goal — no required structure, no correct answer, language choice entirely their own.", example: "The class has to actually agree, as a group, where to go on a real end-of-course outing — the target language may come up naturally, or it may not; nothing forces it." },
];

const MORE_EXAMPLES: Stage[] = [
  { name: "Controlled", control: "One right answer", accent: "var(--color-primary)", desc: "", example: 'Sentence transformation: "I finish work at six." → "I ___ finish work at six." (\'m going to\') — one correct form, no content choice.' },
  { name: "Semi-controlled", control: "Structure fixed, content theirs", accent: "var(--color-muted)", desc: "", example: 'Diary cards: learners fill in three real plans for next weekend, then tell a partner using "I\'m going to..." — the structure is fixed, the plans are genuinely theirs.' },
  { name: "Free", control: "No constraint at all", accent: "var(--color-destructive)", desc: "", example: 'Groups plan a real class trip together, deciding where, when, and how — "going to" may surface naturally in the planning, or may not; nothing requires it.' },
];

const LOOPS = [
  { name: "Controlled loop", tag: "Same answer for everyone", accent: "var(--color-primary)", task: 'Ten quick prompts, one word each, chorally answered as a class: teacher says a habit that\'s now stopped ("smoke", "live in Paris"), trainees respond in unison "I used to ___." One right answer each time — done in under a minute, moving fast.' },
  { name: "Semi-controlled loop", tag: "Structure fixed, content real", accent: "var(--color-muted)", task: 'In pairs, ask and answer: "What did you use to do as a child that you don\'t do now?" — the frame is fixed, but the actual habit each person names is their own. Swap partners once, repeat with a new person.' },
  { name: "Free loop", tag: "No constraint", accent: "var(--color-destructive)", task: 'Groups of three: "Tell the group one thing about your life five years ago that\'s completely different now." No structure required — "used to" may come up naturally, or a learner might say it a different way entirely. That\'s fine.' },
  { name: "Whole-class free loop", tag: "No constraint, bigger stakes", accent: "var(--color-primary)", task: 'The whole "class" (the trainee group) has to agree on one thing they all used to believe as children that turned out to be false, and vote on the best one. Genuinely free — the goal is the vote, not the grammar.' },
];

const SORT_ITEMS: ChoiceScenario[] = [
  { text: "A worksheet where learners fill in the missing modal verb in ten sentences, each with only one correct answer.", choices: ["Controlled", "Semi-controlled", "Free"], correctIndex: 0, feedback: "Controlled — one right answer per item, no learner choice in content." },
  { text: 'Learners get a roleplay card ("Suggest a restaurant to a friend using the target structure") and act it out in pairs.', choices: ["Controlled", "Semi-controlled", "Free"], correctIndex: 1, feedback: "Semi-controlled — structure is cued by the card, but the actual restaurant/content is theirs." },
  { text: "The class has to genuinely agree where to go for an end-of-course outing, with no language requirement at all.", choices: ["Controlled", "Semi-controlled", "Free"], correctIndex: 2, feedback: "Free — a real decision, real stakes, no structure imposed on how they get there." },
  { text: "Learners walk around asking classmates a fixed set of survey questions and noting down real answers.", choices: ["Controlled", "Semi-controlled", "Free"], correctIndex: 1, feedback: "Semi-controlled — the questions (structure) are fixed, but the answers are genuinely the classmates' own." },
];

const NOTES = [
  { label: "Sort answers", text: "1 = controlled (gap-fill, one right answer), 2 = semi-controlled (roleplay cards, structure cued but content their own), 3 = free (real class outing decision, no language constraint at all), 4 = semi-controlled (a survey — structure fixed, answers genuinely theirs)." },
  { label: "Common trainee mistake", text: 'Labelling anything with pairs/groups as "free practice." Free practice is about the LANGUAGE being unconstrained, not the seating arrangement — a pair activity with a sentence frame is still semi-controlled.' },
  { label: 'If short on time, cut "Design your own" to a quick verbal share', text: "Rather than dropping it — it's the moment trainees actually apply the framework themselves rather than just recognising it." },
  { label: "Loop task: this is the session's real spine, not an add-on", text: 'Same target language ("used to") moving through all three stages back to back, so trainees feel the control gradually loosening in one continuous run rather than three separate demos. Keep each loop genuinely brief (under 4 minutes) — the point is contrast between stages, not depth on any one.' },
  { label: '"Design your own" now uses a different structure', text: '("wish + past simple") from the loop task ("used to") — deliberate, so trainees are applying the controlled/semi-controlled/free framework fresh, not just repeating what they just watched.' },
  { label: 'More worked examples ("going to")', text: "The point is generalisation — some trainees think the framework only fits the first structure they saw. Don't skip this even if time is short; cut a loop instead." },
  { label: '"Spot the mismatch"', text: 'The answer is semi-controlled — the sentence frame ("If I were you, I\'d ___") fixes the structure even though it\'s pairwork. This is the single most common labelling error on written assignments; worth pausing on.' },
  { label: "Whole-class free loop", text: "Added as the fourth loop — it's the one closest to how free practice actually happens in a real lesson (the whole class, not just one pair), so don't cut it under time pressure if you can help it." },
];

function StageCard({ stage }: { stage: Stage }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="flex w-full flex-col gap-2 rounded-[8px] border border-border bg-card px-4 py-3.5 text-left"
      style={{ borderLeft: `4px solid ${stage.accent}` }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-ink">{stage.name}</p>
        <p className="text-[10px] font-semibold" style={{ color: stage.accent }}>{stage.control}</p>
      </div>
      <p className="text-[11.5px] leading-relaxed text-muted">{stage.desc}</p>
      {open ? (
        <div className="flex flex-col gap-1.5 rounded-[6px] bg-accent px-3.5 py-2.5">
          <p className="text-[10.5px] font-bold" style={{ color: stage.accent }}>Worked example</p>
          <p className="text-xs leading-relaxed text-ink">{stage.example}</p>
        </div>
      ) : null}
    </button>
  );
}

function CompactExampleCard({ stage }: { stage: Stage }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="flex w-full flex-col gap-1.5 rounded-[8px] border border-border bg-card px-3.5 py-3 text-left"
      style={{ borderLeft: `4px solid ${stage.accent}` }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] font-bold text-ink">{stage.name}</p>
        <p className="text-[10px] font-semibold" style={{ color: stage.accent }}>{stage.control}</p>
      </div>
      {open ? <p className="text-[11.5px] leading-relaxed text-muted">{stage.example}</p> : null}
    </button>
  );
}

function LoopCard({ loop }: { loop: (typeof LOOPS)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="flex w-full flex-col gap-1.5 rounded-[8px] border border-border bg-card px-4 py-3 text-left"
      style={{ borderLeft: `4px solid ${loop.accent}` }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-bold text-ink">{loop.name}</p>
        <p className="text-[10px] font-semibold" style={{ color: loop.accent }}>{loop.tag}</p>
      </div>
      {open ? <p className="text-[11.5px] leading-relaxed text-muted">{loop.task}</p> : null}
    </button>
  );
}

export default function LanguagePracticeSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · Input session · ~72 minutes · 2 of 2 — pairs with Drilling Techniques"
      title="Language practice — from controlled to free."
      intro="Drilling gets the form right with no real message. This session is about what comes after: three stages of practice activity that gradually hand control from teacher to learner, ending in a loop task that runs all three stages back to back on the same structure."
      agenda={[
        { time: "0–5", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "5–30", spine: "var(--color-primary)", title: "Three stages" },
        { time: "30–38", spine: "var(--color-primary)", title: "More worked examples" },
        { time: "38–46", spine: "var(--color-destructive)", title: "Sort the activity" },
        { time: "46–58", spine: "var(--color-muted)", title: "Loop task, all 3 stages" },
        { time: "58–64", spine: "var(--color-destructive)", title: "Spot the mismatch" },
        { time: "64–69", spine: "var(--color-primary)", title: "Design your own" },
        { time: "69–72", spine: "var(--color-primary)", title: "Wrap-up" },
      ]}
    >
      <RunningThisSession>
        Same target language throughout (offering/suggesting: &quot;Why don&apos;t we...&quot;, &quot;How about...&quot;) so trainees see the
        same structure move through all three stages, not three unrelated activities.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 5 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            A learner can drill &quot;Why don&apos;t we go for coffee?&quot; perfectly. Does that mean they can actually use it — to
            suggest something real, to someone real, when they mean it? That gap is what this session is about.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">The three stages, one target structure each way · 25 minutes</p>
        <p className="text-[11.5px] text-muted">Same language throughout: offering and suggesting. Click each stage to see it worked, then try it yourselves.</p>
        {STAGES.map((s) => (
          <StageCard key={s.name} stage={s} />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-5">
        <p className="text-[13px] font-bold text-ink">Sort the activity by stage · 8 minutes</p>
        <p className="text-[11.5px] text-muted">Each activity below could be run at one of the three stages. Pick which.</p>
        {SORT_ITEMS.map((s) => (
          <ChoiceScenarioCard key={s.text} scenario={s} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">More worked examples, same three stages · 8 minutes</p>
        <p className="text-[11.5px] text-muted">A second target structure (&quot;going to&quot; — future plans), so the framework generalises rather than sticking to one example. Click to reveal.</p>
        {MORE_EXAMPLES.map((m) => (
          <CompactExampleCard key={m.name} stage={m} />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">Loop task — do all three stages back to back · 12 minutes</p>
        <p className="text-[11.5px] text-muted">One target structure (&quot;used to&quot; — past habits), one quick task per stage, three to four minutes each. Click a loop to see it and run it live before moving to the next.</p>
        {LOOPS.map((l) => (
          <LoopCard key={l.name} loop={l} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Spot the mismatch · 6 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            A trainee labels their pairwork activity &quot;free practice&quot; because learners are talking in pairs — but every
            learner must complete the sentence frame &quot;If I were you, I&apos;d ___.&quot; What&apos;s the actual stage, and why does
            &quot;pairs&quot; not decide it?
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Design your own · 5 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            In pairs: take the target language &quot;wish + past simple&quot; (present regrets). Design one activity for each
            stage — controlled, semi-controlled, free — in one minute each. Share one with the room.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Wrap-up · 3 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            A lesson doesn&apos;t need all three stages every time — but if you only ever drill and never free-practice,
            learners can produce a form on command and still never use it when it matters.
          </p>
        </div>
      </div>

      <TrainerNotes notes={NOTES} />
    </SessionShell>
  );
}

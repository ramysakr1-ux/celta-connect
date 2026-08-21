"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Diagnostic test", definition: "An initial task that reveals what students already know and don't know." },
  { term: "Gap", definition: "A specific problem in knowledge that the test stage uncovers." },
  { term: "Remedial teach", definition: "Teaching aimed only at the gaps just found, not the whole point." },
  { term: "Retest", definition: "A second, similar task that checks whether the gap has closed." },
  { term: "MFP", definition: "Meaning, form, pronunciation — the three things the teach stage still has to cover, just only where there's a gap." },
];

const DETAILS = [
  { q: "Teaching happens before any test.", a: "False — the test comes first." },
  { q: "The first test reveals what students already know.", a: "True." },
  { q: "If every student already gets the meaning right, the teach stage still has to cover it again from scratch.", a: "False — teach only the gap, whether that's meaning, form, or pronunciation." },
  { q: "The second test can reuse the first test's task type with new items.", a: "True." },
  { q: "A class might need meaning covered but not pronunciation, or the reverse — TTT doesn't assume it's always all three.", a: "True." },
  { q: "Freer practice comes before the second test.", a: "False — after it." },
];

const CORRECT_ORDER = ["Pre-teach terms", "Predict the staging", "Read the text, check ideas", "Detail check"];
const SHUFFLED = ["Read the text, check ideas", "Pre-teach terms", "Detail check", "Predict the staging"];

const EXAMPLE_ROWS = [
  { stage: "Test 1", time: "8′", text: "Ss match 10 sentence pairs testing present simple vs present continuous uses." },
  { stage: "Check answers", time: "3′", text: "Pairs compare, T notes which items caused problems." },
  { stage: "Teach", time: "12′", text: "T addresses only the uses that caused errors — e.g. temporary states, future arrangements — via example/use matching and a short board explanation." },
  { stage: "Test 2", time: "8′", text: "Same task type, new items, checking whether the gap has closed." },
  { stage: "Freer practice", time: "14′", text: "Ss discuss their own current temporary situations and upcoming plans." },
];

const NOTES = [
  { label: "Cap the teach stage", text: "It's easy to over-run here. Teach only what the test actually revealed, even if there's more you could say about the point." },
  { label: "Only for grammar or lexis", text: "TTT doesn't work for writing or speaking — flag that limit explicitly during the debrief." },
  { label: "A weak first test defeats the framework", text: "If the test doesn't genuinely diagnose gaps, the teach stage has nothing real to target — it's worth stressing this is the stage most likely to be rushed in a real TP." },
];

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
          <p className="font-serif text-lg font-semibold text-ink">Example lesson — uses of the present continuous</p>
          <div className="overflow-hidden rounded-[6px] border border-border">
            <div className="grid grid-cols-[150px_60px_1fr] bg-accent px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
              <p>Stage</p>
              <p>Time</p>
              <p>Procedure</p>
            </div>
            {EXAMPLE_ROWS.map((r) => (
              <div key={r.stage} className="grid grid-cols-[150px_60px_1fr] gap-2 border-b border-border-faint px-3 py-2 last:border-b-0">
                <p className="text-[11px] font-bold text-ink">{r.stage}</p>
                <p className="text-[11px] text-muted">{r.time}</p>
                <p className="text-[11.5px] leading-relaxed text-muted">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TestTeachTestSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · loop input"
      title="Test-Teach-Test — taught the way you'll teach it."
      intro="This session is staged exactly like the lesson framework it teaches. Do the tasks first — naming what happened is what the debrief is for."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-muted)", title: "What is TTT?" },
        { time: "5–10", spine: "var(--color-muted)", title: "Match the terms" },
        { time: "10–13", spine: "var(--color-muted)", title: "Predict the staging" },
        { time: "13–23", spine: "var(--color-muted)", title: "Read the text, check ideas" },
        { time: "23–33", spine: "var(--color-muted)", title: "Detail questions" },
        { time: "33–43", spine: "var(--color-primary)", title: "Debrief: order the stages" },
        { time: "43–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t name &quot;Test-Teach-Test&quot; until the debrief. Make sure the first test genuinely diagnoses gaps
        rather than teaching in disguise, and keep the teach stage limited to what the test actually revealed.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: has a teacher ever corrected you on something you actually already knew? How did
            that feel, compared to genuinely being taught something new?
          </p>
        </div>
      </div>

      <RevealCard
        variant="hero"
        question="What is Test-Teach-Test?"
        answer="A test comes first, diagnosing gaps — then teaching targets only those gaps."
      />

      <MatchTermsExercise terms={TERMS} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 2</p>
        <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">How do you think a Test-Teach-Test lesson should be staged?</p>
          <p className="text-[11px] italic text-muted">Discuss with your partner, about a minute.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 3 · Read the text and check if your ideas were right or wrong</p>
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">Staging a Test-Teach-Test lesson</p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            TTT begins with a test, not a presentation. Students attempt a task — sentence choice, gap-fill, matching,
            or a discussion that requires the target language — before any teaching happens. The point isn&apos;t to
            catch students out; it&apos;s diagnostic, revealing exactly which gaps exist, and which of meaning, form or
            pronunciation each gap belongs to — different students in the same room often need different things. The
            teach stage that follows is aimed only at those gaps:{" "}
            <strong className="font-semibold">meaning</strong> via a cline, a timeline, or CCQs on a handout;{" "}
            <strong className="font-semibold">form</strong> via a short board explanation, only if students got it
            wrong; <strong className="font-semibold">pronunciation</strong> via drilling, only if the test showed
            students couldn&apos;t say it. There&apos;s no need to re-teach what students already showed they know. A
            second test closes the loop, usually reusing the same task type as the first test but with new items, so
            the teacher and the students can see whether the gap has actually closed. Freer practice follows once
            accuracy is in place.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Stage 4</p>
          <p className="text-[11px] italic text-muted">More time now — answer these from the text, then check with your partner.</p>
        </div>
        {DETAILS.map((d) => (
          <RevealCard key={d.q} question={d.q} answer={d.a} />
        ))}

        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">Handling the teach stage without over-explaining</p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            The test already showed which gap is real, so the teach stage only closes that gap — the fastest ways to
            do it involve the teacher talking least. Some examples:
          </p>
          <ul className="list-disc space-y-1.5 pl-[18px] text-[12.5px] leading-relaxed text-ink">
            <li>
              <strong className="font-semibold">Meaning gap</strong> — put the sentence on the board and ask two or
              three CCQs (&quot;did this happen once or many times?&quot;) rather than explaining the rule; let
              students answer their way to the meaning.
            </li>
            <li>
              <strong className="font-semibold">Form gap</strong> — board a correct model next to the error students
              actually produced, then elicit the difference from the group (&quot;what&apos;s different here?&quot;)
              instead of naming the rule yourself.
            </li>
            <li>
              <strong className="font-semibold">Pronunciation gap</strong> — mark stress on the board and drill
              chorally, then individually; no explanation of word stress needed, just enough repetition to fix it.
            </li>
            <li>
              If only two or three students had the gap, deal with it in quick 1-to-1 concept-check while the rest
              move on — don&apos;t re-teach the whole class something most of them already showed they know.
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">What the second test can look like</p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            Test 2 checks the same gap the first test found — same task type, new items, so students can&apos;t just
            recall answers from Test 1. Examples, matched to the first test&apos;s task type:
          </p>
          <ul className="list-disc space-y-1.5 pl-[18px] text-[12.5px] leading-relaxed text-ink">
            <li>Test 1 was a gap-fill → Test 2 is a fresh gap-fill with the same target language in new sentences, not the same sentences reused.</li>
            <li>Test 1 was sentence choice (right/wrong) → Test 2 is a short set of new sentences to judge, or a quick error-correction task.</li>
            <li>Test 1 was matching → Test 2 asks students to produce the language themselves — a short written sentence or a spoken exchange — a slightly freer check than the first test, since accuracy should now be closer.</li>
            <li>Keep Test 2 short — it&apos;s a check, not a new task. If most students still get it wrong, the teach stage needs revisiting, not a longer Test 2.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <OrderExercise correctOrder={CORRECT_ORDER} shuffled={SHUFFLED} />
      </div>

      <AnswerKey terms={TERMS.map((t) => ({ term: t.term, def: t.definition }))} details={DETAILS} />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
  );
}

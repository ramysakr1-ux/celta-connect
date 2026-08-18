"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";
import { VideoReveal } from "@/components/input-sessions/video-reveal";

interface Drill {
  name: string;
  hint: string;
  accent: string;
  desc: string;
  example: string;
}

const DRILLS: Drill[] = [
  { name: "Choral drill", hint: "Whole class, together", accent: "var(--color-primary)", desc: "The whole group repeats together. Always go first — nobody can be heard failing alone, so it's safe, and it gets the sound into the room.", example: 'T: "I\'d rather not." → Class (all together): "I\'d rather not."' },
  { name: "Individual drill", hint: "One learner at a time", accent: "var(--color-primary)", desc: "Same phrase, one learner at a time after the choral round. The only drill that tells you honestly who's actually got it versus who was hiding in the chorus. Keep it fast — don't let it become a spotlight.", example: 'T: "I\'d rather not." → S1 (alone): "I\'d rather not." → S2 (alone): "I\'d rather not."' },
  { name: "Back-chaining", hint: "Build from the end", accent: "var(--color-gold)", desc: "For long or awkward phrases. Start at the last word or syllable, then add backwards toward the front, one piece at a time — each addition is easier than saying the whole thing cold.", example: '"...that\'s all right" → "...if that\'s all right" → "I\'d rather not, if that\'s all right"' },
  { name: "Substitution drill", hint: "Swap one part", accent: "var(--color-gold)", desc: "Keep the frame, swap one slot. Turns a single memorised chunk into a usable, flexible pattern — this is the step most teachers skip, and it's the one that actually builds fluency, not just recall.", example: 'T: "I\'d rather not go to the party." (cue: "the gym") → S: "I\'d rather not go to the gym."' },
  { name: "Transformation drill", hint: "Change the grammar", accent: "var(--color-destructive)", desc: "Same core content, but the learner has to change the grammatical form — statement to negative, active to passive, statement to question.", example: 'T: "She works on Fridays." (cue: question) → S: "Does she work on Fridays?"' },
  { name: "Mumble / silent drill", hint: "Quiet, own pace", accent: "var(--color-status-on-track-text)", desc: "Learners repeat under their breath, at their own pace, rather than aloud on cue. Useful for shyer learners, or as a private rehearsal step right before an individual drill.", example: "T models once aloud → learners each mutter it to themselves a few times before anyone speaks up." },
];

const DRILLS_2: Drill[] = [
  { name: "Forward (build-up) chaining", hint: "Grows from the front", accent: "var(--color-primary)", desc: "The opposite direction from back-chaining — start with a short core phrase and add a piece each round, building forward instead of backward. Useful when the front of a phrase is the easy, anchoring part.", example: '"I get up early" → "I get up early every day" → "Ayşe gets up early every day"' },
  { name: "Guessing drill", hint: "Meaningful, not mechanical", accent: "var(--color-gold)", desc: "A meaningful drill, not a mechanical one — the teacher thinks of something real (a favourite sport, an imaginary move abroad), and learners take turns asking yes/no questions to find out what it is. Slower, and the teacher can't be as strict about 100% correct form, but the language is genuinely purposeful.", example: 'L: "Is it a team sport?" T: "No." L: "Do you need special equipment?" T: "Yes." ...' },
  { name: "Finger counting & gesture", hint: "Visual, not verbal, cue", accent: "var(--color-destructive)", desc: 'Count syllables or words on your fingers as learners say them, or use a hand shape to show sentence stress and intonation instead of saying "listen to the stress again." Non-verbal cueing keeps the drill moving without extra teacher talk.', example: 'Hold up one finger per word as the class says "I\'d — rather — not," raising the "not" finger higher to show the stressed word.' },
  { name: "Jazz chant", hint: "Rhythmic, set to a beat", accent: "var(--color-status-on-track-text)", desc: "A short exchange drilled to a fixed rhythm rather than natural speech pace — makes repetitive drilling genuinely fun and memorable, and naturally reinforces stress and intonation because the beat forces it.", example: '"How\'s Jack?" / "He\'s sick." / "Oh no!" — chanted with a steady clap or beat under it, repeated faster each round.' },
];

const SCENARIOS: ChoiceScenario[] = [
  { text: "A learner can say \"I'd rather not go to the party\" perfectly, but freezes when asked to say the same thing about the gym instead.", choices: ["Back-chaining", "Substitution", "Individual", "Transformation"], correctIndex: 1, feedback: "Substitution drill — they have the frame, they just need practice swapping the slot." },
  { text: 'A learner keeps saying "Mussorgsky" wrong, dropping a syllable every time, no matter how many times you model the whole word.', choices: ["Back-chaining", "Substitution", "Individual", "Transformation"], correctIndex: 0, feedback: "Back-chaining — building it from the last syllable forward makes each addition small and manageable." },
  { text: "The whole class nails a phrase chorally, but you suspect two or three learners are just mouthing along without really producing it.", choices: ["Back-chaining", "Substitution", "Individual", "Transformation"], correctIndex: 2, feedback: "Individual drill — choral repetition can mask exactly this; only hearing them alone tells you the truth." },
  { text: 'A learner can say "She works on Fridays" but can\'t turn it into a question when you ask them to check with a partner.', choices: ["Back-chaining", "Substitution", "Individual", "Transformation"], correctIndex: 3, feedback: "Transformation drill — the grammar manipulation (statement → question) is the actual gap here." },
];

const DISCUSS = [
  { question: "What is a drill?", answer: "Controlled, repetitive oral practice of a form — manipulating grammar, intonation, or stress with no real message being communicated." },
  { question: "Why drill?", answer: "Builds oral confidence with new language, gives weaker learners a way to hide behind stronger ones at first, and lets the teacher hear problems directly rather than guessing from written work." },
  { question: "When should we drill?", answer: "Most naturally at the presentation stage, right after modelling new language — sometimes again just before a practice activity, as a quick warm-up for the form." },
  { question: "Advantages and disadvantages?", answer: "Advantages: builds confidence, reduces teacher talking time, works for a wide range of language, surfaces pronunciation problems, raises awareness of appropriate intonation. Disadvantages: can become mechanical and meaningless if overused, and a less confident teacher can make it feel flat rather than energetic." },
];

const NOTES = [
  { label: "Choral first, always", text: "It's safe, nobody's heard alone. Individual drilling comes second, to find who actually has it versus who's hiding in the chorus. Keep individual drilling fast-moving; don't let it turn into a spotlight moment for a nervous trainee playing \"learner.\"" },
  { label: "Scenario answers", text: "1 = back-chaining (long/awkward phrase), 2 = substitution drill (can say it but can't bend it), 3 = individual drill (choral is hiding a real gap), 4 = transformation drill (grammar manipulation, e.g. statement → question)." },
  { label: "If trainees dismiss drilling as old-fashioned", text: "Push back gently — it fell out of favour for being the whole lesson, not for being useless as one stage of one. It still earns criteria points, and used well it's genuinely fast." },
  { label: "Ten drill types total now, in two batches", text: "Don't let the second batch feel like an afterthought; guessing drills and jazz chants tend to be the ones trainees actually remember and use." },
  { label: "Discuss first", text: 'Don\'t over-explain the advantages/disadvantages up front — let trainees genuinely try to answer before revealing the notes. Most groups get "builds confidence" easily but miss "can become mechanical" until pushed.' },
  { label: '"Drill each other in an unknown language"', text: "Have a couple of genuinely unfamiliar short phrases ready to hand out (a greeting in a language unlikely to be in the room) — don't let pairs default to a language one of them half-knows, or the exercise loses its point." },
];

function DiscussCard({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-col gap-1.5 rounded-[8px] border border-border bg-card px-3.5 py-3 text-left">
      <p className="text-[13px] font-semibold text-ink">{question}</p>
      {open ? <p className="text-[11.5px] leading-relaxed text-muted">{answer}</p> : null}
    </button>
  );
}

function DrillCard({ n, drill }: { n: string; drill: Drill }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-col gap-1.5 rounded-[8px] border border-border bg-card px-4 py-3 text-left">
      <div className="flex items-baseline gap-2.5">
        <span className="min-w-[18px] text-[10.5px] font-bold" style={{ color: drill.accent }}>{n}</span>
        <span className="flex-1 text-[13px] font-semibold text-ink">{drill.name}</span>
        <span className="text-[10px] font-semibold text-muted">{drill.hint}</span>
      </div>
      {open ? (
        <div className="flex flex-col gap-1.5 pl-7">
          <p className="text-[11.5px] leading-relaxed text-muted">{drill.desc}</p>
          <p className="rounded-[6px] bg-accent px-3 py-2 font-mono text-xs text-ink">{drill.example}</p>
        </div>
      ) : null}
    </button>
  );
}

export default function DrillingTechniquesSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · Input session · ~65 minutes · 1 of 2 — pairs with Language Practice"
      title="Drilling techniques — getting the mouth to say it right."
      intro="Drilling is mechanical, controlled repetition — no message to communicate, just getting a form or sound out correctly and fluently. Do this session before Language Practice: drilling is the first, most controlled step; the next session moves from there toward learners actually using the language."
      agenda={[
        { time: "0–5", spine: "var(--color-gold)", title: "Warmer video" },
        { time: "5–10", spine: "var(--color-gold)", title: "Discuss first" },
        { time: "10–30", spine: "var(--color-primary)", title: "Six drill types" },
        { time: "30–45", spine: "var(--color-gold)", title: "Four more techniques" },
        { time: "45–55", spine: "var(--color-destructive)", title: "Match to the problem" },
        { time: "55–65", spine: "var(--color-status-on-track-text)", title: "Unknown-language game + wrap-up" },
      ]}
    >
      <RunningThisSession>
        Model each drill type out loud with trainees before they try it in pairs on each other — reading a definition
        isn&apos;t the same as feeling how back-chaining actually works in your mouth.
      </RunningThisSession>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">Warmer · 5 minutes</p>
        <VideoReveal embedUrl="https://www.youtube.com/embed/lz0IT4Uk2xQ?si=6KQSBkeS1d-tYfSl" />
      </div>

      <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-5">
        <p className="text-[13px] font-bold text-ink">Discuss first · 5 minutes</p>
        <p className="text-[11.5px] text-muted">In pairs, discuss each question, then click to compare with the trainer&apos;s notes.</p>
        {DISCUSS.map((d) => (
          <DiscussCard key={d.question} {...d} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">Six drill types, trainer-modelled · 20 minutes</p>
        <p className="text-[11.5px] text-muted">Trainer models each one live with the room first — then click a card to reveal the description and try it on your partner.</p>
        {DRILLS.map((d, i) => (
          <DrillCard key={d.name} n={String(i + 1).padStart(2, "0")} drill={d} />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-5">
        <p className="text-[13px] font-bold text-ink">Match the drill to the problem · 10 minutes</p>
        <p className="text-[11.5px] text-muted">A learner has a specific problem below. Which drill type actually fixes it? Click your answer.</p>
        {SCENARIOS.map((s) => (
          <ChoiceScenarioCard key={s.text} scenario={s} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">Four more techniques · 15 minutes</p>
        <p className="text-[11.5px] text-muted">Same pattern — trainer models, then click to reveal.</p>
        {DRILLS_2.map((d, i) => (
          <DrillCard key={d.name} n={String(i + 7).padStart(2, "0")} drill={d} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Drill each other in an unknown language · 10 minutes</p>
        <div className="flex flex-col gap-1.5 rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            In pairs: teach your partner one short phrase in a language neither of you has studied (ask the trainer for a
            phrase, or use one you half-remember). Drill it on them using any two techniques from today. Then swap — they
            drill you.
          </p>
          <p className="text-[11.5px] text-muted">
            The point: experiencing drilling as the actual learner, with zero existing anchor in the language, is the
            closest trainees will get on this course to feeling what a real beginner feels.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Wrap-up · 5 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            Drilling produces accurate, fluent form — but it&apos;s not communication yet. That&apos;s exactly where the next
            session, Language Practice, picks up.
          </p>
        </div>
      </div>

      <TrainerNotes notes={NOTES} />
    </SessionShell>
  );
}

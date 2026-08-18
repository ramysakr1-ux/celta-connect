"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";

const ELICIT_TECHNIQUES = [
  { name: "Visuals / realia", hint: "Show, don't tell", example: 'Hold up a real umbrella and ask "What\'s this?" instead of defining the word — the object elicits the label from students who already know it.' },
  { name: "Situation / context clue", hint: "Build a scenario first", example: 'Describe a scene ("It\'s raining hard, I forgot mine, I\'m getting soaked") and ask what you need — students supply "an umbrella" themselves.' },
  { name: "Definitions worked backward", hint: "Give the definition, they give the word", example: 'T: "A place where you borrow books for free — what\'s it called?" S: "A library." Reverses the usual direction: they produce the target word from a description.' },
  { name: "Students' existing knowledge", hint: "Ask before you tell", example: 'Before presenting a grammar point, ask "Does anyone know how we make the passive?" — some may already have partial knowledge worth surfacing first.' },
  { name: "Gesture / mime", hint: "Physical prompt", example: "Mime drinking from a cup and raise an eyebrow questioningly — students supply \"Would you like a drink?\" without you saying a word of it." },
];

const ELICIT_SCENARIOS = [
  { text: "Introducing the word \"photosynthesis-level\" vocabulary like \"chlorophyll\" to absolute beginners with zero science background in either language.", answer: "tell" as const, feedback: "Just tell them — there's nothing to elicit if the concept and the word are both entirely new. Eliciting works by surfacing something already partly known." },
  { text: "Presenting \"used to\" for past habits to an intermediate class who already know past simple well.", answer: "elicit" as const, feedback: 'Elicit — they likely already produce sentences like "I played a lot as a kid" naturally; drawing "used to" out via a situation builds on what they have.' },
  { text: "A fire alarm is about to go off for a drill and you need the class to line up at the door immediately.", answer: "tell" as const, feedback: "Just tell them — eliciting takes time you don't have, and the stakes of a misunderstanding are too high to risk." },
  { text: "A learner uses \"furious\" when they mean \"annoyed\" and you want the class to notice the difference in strength.", answer: "elicit" as const, feedback: "Elicit — a cline (scale) works well here, and having students place the words themselves cements the distinction better than you stating it." },
];

const CCQ_ITEMS = [
  { text: "Do you understand \"I've lived here for six years\"?", bad: true, why: "This just asks if they understand — it contains the target language and gives no way to check anything beyond a yes/no guess." },
  { text: "Did I move here six years ago?", bad: false, why: "" },
  { text: "Do I still live here now?", bad: false, why: "" },
  { text: "Have you ever lived somewhere for six years?", bad: true, why: "This asks about the student's own experience, not the meaning of the target sentence — it doesn't check anything about the grammar." },
  { text: "Is this a completed action in the past, or does it continue?", bad: true, why: 'This uses grammatical terminology ("completed action") the student may not know — a CCQ should be simpler than the target, not more technical.' },
];

const WRITE_ITEMS = [
  { item: 'Target: "She might be at work."', model: 'Model: "Do I know for sure where she is?" (No.) "Is this a guess?" (Yes.)' },
  { item: "Target: \"If I were you, I'd apologise.\"", model: 'Model: "Am I really you?" (No.) "Is this real advice or an imaginary situation?" (Imaginary, but real advice.)' },
  { item: "Target: \"I wish I hadn't said that.\"", model: 'Model: "Did I say it?" (Yes.) "Am I happy about it?" (No.) "Can I change it now?" (No.)' },
  { item: "Target: \"By the time I arrived, the film had started.\"", model: 'Model: "Which happened first, my arriving or the film starting?" (The film.) "Was the film still starting when I got there?" (No, already going.)' },
];

const NEAR_MISSES = [
  { text: '"Is \'might\' the same as \'will\'?"', why: "A near miss — it sounds like a CCQ but only tests if they can spot a synonym, not whether they grasp the concept of possibility versus certainty." },
  { text: '"So it means maybe, right?"', why: "A near miss — the teacher supplies the answer inside the question. Students agree without proving understanding." },
];

const TECHNIQUES = [
  { technique: "Timeline", use: "Best for tense and aspect — showing when an action happens relative to now." },
  { technique: "Realia (the real object)", use: "Fast and unambiguous for concrete nouns — showing an umbrella beats defining one." },
  { technique: "Situation / short story", use: "Good for functional language or attitude words — meaning that needs a context to make sense." },
  { technique: "Cline (a scale drawn on the board)", use: 'Good for grading words like "furious" vs. "annoyed" — shows relative strength.' },
  { technique: "Discrimination (compare two structures)", use: 'Higher levels: give a minimal pair — "She left when the police got there" vs. "She\'d left when the police got there" — and have students work out the difference themselves.' },
  { technique: "Negative checking", use: 'Establish when the item CAN\'T be used — e.g. is "I used to walk to school this morning" OK? (No — "used to" needs a past habit, not one specific morning.)' },
  { technique: "Extension / completion", use: 'Give the start of a sentence with the target item and have students complete it — "He used to drink champagne, but..." (now he\'s in prison) shows they\'ve grasped the contrast.' },
  { technique: "Personalising / giving examples", use: "Ask students to supply their own example of the concept — if they can, that proves understanding better than a yes/no answer." },
];

const EXAMPLE_ROWS = [
  { label: "Target", value: '"I used to play basketball." (past habit, not now)' },
  { label: "CCQ 1", value: '"Do I play basketball now?" (No.)' },
  { label: "CCQ 2", value: '"Did I play basketball in the past, many times?" (Yes.)' },
  { label: "Non-verbal backup", value: "A timeline: mark repeated Xs in the past, a clear stop before \"now.\"" },
];

const NOTES = [
  { label: "A good CCQ never contains the target language", text: "If the question requires understanding the item to answer it, it isn't checking anything — flag this constantly, it's the single most common CCQ mistake." },
  { label: "Simpler language than the target, always", text: "A CCQ pitched at or above the target item's level defeats the purpose — push trainees to go simpler than feels natural." },
  { label: "Non-verbal techniques aren't a fallback, they're often better", text: "A timeline or realia can check meaning faster and more reliably than a string of questions, especially at lower levels." },
  { label: "Eliciting only works on what's partly already there", text: "It's not a virtue in itself — trainees sometimes try to elicit genuinely new information nobody in the room has. If nobody can supply it, stop after one attempt and just give it." },
  { label: '"Elicit or tell?": there\'s a real judgment call here', text: 'Push trainees past "always elicit" as a reflex — the right instinct is speed and safety versus depth of understanding, not eliciting for its own sake.' },
];

function ElicitingTechniques() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-bold text-ink">Eliciting — drawing it out instead of giving it</p>
        <p className="text-[11.5px] text-muted">Get learners to produce or work out language themselves before you supply it. Click each technique for a real example.</p>
      </div>
      {ELICIT_TECHNIQUES.map((e, i) => (
        <button
          key={e.name}
          type="button"
          onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
          className={`flex flex-col gap-1.5 rounded-[8px] border px-3.5 py-3 text-left ${open[i] ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold text-ink">{e.name}</p>
            <p className="text-[10px] font-semibold text-muted">{e.hint}</p>
          </div>
          {open[i] ? <p className="text-[11.5px] leading-relaxed text-muted">{e.example}</p> : null}
        </button>
      ))}
    </div>
  );
}

function ElicitOrTell() {
  const [picked, setPicked] = useState<Record<number, "elicit" | "tell">>({});
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-5">
      <p className="text-[13px] font-bold text-ink">Match: elicit, or just tell them?</p>
      <p className="text-[11.5px] text-muted">A teaching moment below. Would eliciting actually work here, or is telling faster and clearer? Click your answer.</p>
      {ELICIT_SCENARIOS.map((s, i) => {
        const pick = picked[i];
        const correct = pick === s.answer;
        return (
          <div
            key={s.text}
            className={`flex flex-col gap-2 rounded-[8px] border p-3.5 ${
              pick === undefined ? "border-border bg-card" : correct ? "border-status-on-track-text/30 bg-status-on-track-bg" : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <p className="text-[12.5px] leading-relaxed text-ink">{s.text}</p>
            {pick === undefined ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setPicked((p) => ({ ...p, [i]: "elicit" }))} className="flex h-7 items-center rounded-full border border-border px-3.5 text-[11px] font-semibold text-ink">
                  Elicit it
                </button>
                <button type="button" onClick={() => setPicked((p) => ({ ...p, [i]: "tell" }))} className="flex h-7 items-center rounded-full border border-border px-3.5 text-[11px] font-semibold text-ink">
                  Just tell them
                </button>
              </div>
            ) : (
              <p className={`text-[11.5px] leading-relaxed ${correct ? "text-status-on-track-text" : "text-destructive"}`}>
                {correct ? "✓ " : "✗ "}
                {s.feedback}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SpotBadCcq() {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Spot the bad CCQ</p>
        <p className="text-[11.5px] text-muted">{picked !== null ? "1 of 5 examined" : "0 of 5 examined"}</p>
      </div>
      <p className="text-[11.5px] text-muted">
        Target: &quot;I&apos;ve lived here for six years.&quot; Click the question you think is genuinely a bad CCQ.
      </p>
      {CCQ_ITEMS.map((c, i) => {
        const show = picked === i;
        return (
          <button
            key={c.text}
            type="button"
            onClick={() => setPicked(i)}
            className={`flex items-center justify-between gap-3 rounded-[8px] border px-4 py-3 text-left ${
              show ? (c.bad ? "border-status-on-track-text bg-status-on-track-bg" : "border-destructive bg-destructive/5") : "border-border bg-card"
            }`}
          >
            <p className="text-[12.5px] text-ink">{c.text}</p>
            {show ? (
              <p className={`flex-none text-[10.5px] font-bold ${c.bad ? "text-status-on-track-text" : "text-destructive"}`}>
                {c.bad ? "Bad CCQ" : "Actually fine"}
              </p>
            ) : null}
          </button>
        );
      })}
      {picked !== null ? (
        <div className="rounded-[4px] border-l-[3px] border-status-on-track-text bg-status-on-track-bg px-3.5 py-2.5">
          <p className="text-xs leading-relaxed text-ink">
            {CCQ_ITEMS[picked].why || "This one is a genuinely good CCQ — simple, doesn't contain the target language, and checks meaning directly."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function WriteYourOwn() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-bold text-ink">Write your own CCQs</p>
        <p className="text-[11.5px] text-muted">For each target item, write two CCQs. Compare with a model once you&apos;ve tried.</p>
      </div>
      {WRITE_ITEMS.map((w, i) => (
        <div key={w.item} className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-sm font-semibold text-ink">{w.item}</p>
          <button
            type="button"
            data-print-hide
            onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
            className="self-start flex h-7 items-center rounded-full border border-primary/40 bg-primary/10 px-3 text-[11px] font-semibold text-primary"
          >
            {open[i] ? "Hide model CCQs" : "Compare with model CCQs"}
          </button>
          {open[i] ? (
            <div className="rounded-[4px] border-l-[3px] border-primary bg-primary/5 px-3.5 py-2.5">
              <p className="text-xs leading-relaxed text-ink">{w.model}</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BeyondCcqs() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-bold text-ink">Beyond CCQs — match the technique</p>
        <p className="text-[11.5px] text-muted">CCQs aren&apos;t the only tool. Match each technique to when you&apos;d actually use it.</p>
      </div>
      {TECHNIQUES.map((t, i) => (
        <button
          key={t.technique}
          type="button"
          onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
          className={`grid grid-cols-1 items-start gap-1.5 rounded-[6px] border px-3.5 py-2.5 text-left sm:grid-cols-2 sm:items-center sm:gap-3 ${
            open[i] ? "border-status-on-track-text/40 bg-status-on-track-bg" : "border-border bg-card"
          }`}
        >
          <p className="text-xs font-semibold text-ink">{t.technique}</p>
          {open[i] ? (
            <p className="text-[11.5px] text-status-on-track-text">{t.use}</p>
          ) : (
            <p className="text-[10.5px] font-semibold text-muted">When would you use this? Click to reveal</p>
          )}
        </button>
      ))}
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
          <p className="font-serif text-lg font-semibold text-ink">Example — checking &quot;used to&quot; for past habits</p>
          <div className="overflow-hidden rounded-[6px] border border-border">
            {EXAMPLE_ROWS.map((r) => (
              <div key={r.label} className="grid grid-cols-[130px_1fr] border-b border-border-faint last:border-b-0">
                <p className="bg-accent px-3 py-2 text-[11px] font-semibold text-ink">{r.label}</p>
                <p className="px-3 py-2 text-[11.5px] leading-relaxed text-muted">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnswerKey() {
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
        <p className="font-serif text-[15px] font-semibold text-ink">Good CCQ or bad CCQ?</p>
        {CCQ_ITEMS.map((c) => (
          <div key={c.text} className="flex flex-col gap-0.5 border-b border-border-faint py-1">
            <p className="text-[11.5px] text-ink">{c.text}</p>
            <p className="text-[11px] italic text-muted">{c.bad ? `Bad CCQ — ${c.why}` : "Good CCQ"}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
        <p className="font-serif text-[15px] font-semibold text-ink">Model CCQs</p>
        {WRITE_ITEMS.map((w) => (
          <div key={w.item} className="flex flex-col gap-0.5 border-b border-border-faint py-1">
            <p className="text-[11.5px] text-ink">{w.item}</p>
            <p className="text-[11px] italic text-muted">{w.model}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ElicitingAndConceptCheckingSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · ~60 minutes · language awareness"
      title="Eliciting and concept checking."
      intro="Two related skills: drawing language out of learners instead of just giving it to them, and checking they've actually understood it once it's there. &quot;Do you understand?&quot; tells you nothing — this session works through better tools for both."
      agenda={[
        { time: "0–2", spine: "var(--color-gold)", title: "Lead-in" },
        { time: "2–12", spine: "var(--color-primary)", title: "Eliciting techniques" },
        { time: "12–20", spine: "var(--color-destructive)", title: "Elicit or tell?" },
        { time: "20–29", spine: "var(--color-destructive)", title: "Spot the bad CCQ" },
        { time: "29–43", spine: "var(--color-primary)", title: "Write your own CCQs" },
        { time: "43–54", spine: "var(--color-status-on-track-text)", title: "Beyond CCQs" },
        { time: "54–60", spine: "var(--color-gold)", title: "Near misses" },
      ]}
    >
      <RunningThisSession>
        Ban &quot;Do you understand?&quot; and &quot;Is that clear?&quot; from the room for the next ~60 minutes — including
        from yourself. Trainees will reach for them constantly; that&apos;s the point of banning them.
      </RunningThisSession>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] text-ink">
            Quick show of hands: has anyone ever said &quot;yes, I understand&quot; in a foreign language class, and not
            actually understood?
          </p>
        </div>
      </div>

      <ElicitingTechniques />

      <ElicitOrTell />

      <SpotBadCcq />

      <WriteYourOwn />

      <BeyondCcqs />

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Discuss: near misses</p>
          <p className="text-[11.5px] text-muted">These sound like CCQs but aren&apos;t quite. Click each to see why, then discuss: what would fix it?</p>
        </div>
        {NEAR_MISSES.map((n) => (
          <RevealCard key={n.text} question={n.text} answer={n.why} />
        ))}
      </div>

      <AnswerKey />

      <TrainerNotes notes={NOTES} />

      <StagingExample />
    </SessionShell>
  );
}

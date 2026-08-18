"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";

const TERMS = [
  { term: "Skimming / Gist", definition: "Reading or listening fast over a whole text to get the main idea." },
  { term: "Scanning / Specific information", definition: "Particular facts a reader or listener scans for, ignoring the rest, reading or listening." },
  { term: "Detail", definition: "Finer points understood only on a closer, slower pass, reading or listening." },
  { term: "Prediction", definition: "Guessing content from a title, image or context before reading or listening." },
  { term: "Inference", definition: "Working out something the text or speaker implies but never states directly." },
  { term: "Authentic text", definition: "A real text written or a real recording made for real readers or listeners, not simplified for learners." },
];

const DETAILS = [
  { q: "It's a good idea to go cold into a text.", a: "False." },
  { q: "Using background knowledge helps us understand a text better.", a: "True." },
  { q: "After students have read for gist, you should ask them if there are any words they don't know.", a: "False." },
  { q: 'Asking students to "Just read" or "Just listen" is a valid task.', a: "False." },
  { q: "It's a good idea to get students to read out loud.", a: "False." },
  { q: "Setting time limits for skim and scan reading is a good idea.", a: "False — only for skimming." },
  { q: "Students should be given the option to read/listen more than once for gist.", a: "False." },
  { q: "Students should answer comprehension questions from memory.", a: "False." },
  { q: "The teacher must be active and interact with the students while they read.", a: "False." },
  { q: "Reading tasks should progressively get more difficult.", a: "True." },
  { q: "The detail/specific information task comes before peer check.", a: "True." },
  { q: "A follow-up task should be based on something related to the text.", a: "True." },
];

const ORDER_ITEMS = [
  { key: "lead-in", label: "Lead-in" },
  { key: "pre-teach", label: "Pre-teach vocab" },
  { key: "gist", label: "Gist task" },
  { key: "peer1", label: "Peer check" },
  { key: "detail", label: "Detail / specific information" },
  { key: "peer2", label: "Peer check" },
  { key: "followup", label: "Speaking or writing task" },
];
const CORRECT_ORDER = ["lead-in", "pre-teach", "gist", "peer1", "detail", "peer2", "followup"];
const SHUFFLED = ["peer1", "gist", "detail", "followup", "pre-teach", "lead-in", "peer2"];
const CORRECT_ORDER_LABEL = CORRECT_ORDER.map((k) => ORDER_ITEMS.find((i) => i.key === k)!.label).join(" → ");

function ReceptiveOrderAndKey() {
  const [picked, setPicked] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const done = picked.length === CORRECT_ORDER.length;
  const itemByKey = Object.fromEntries(ORDER_ITEMS.map((i) => [i.key, i]));

  return (
    <>
      <div className="flex flex-col gap-2.5 border-t border-border pt-5">
        <div className="flex flex-col gap-1">
          <p className="font-serif text-lg font-semibold text-ink">Debrief — put the stages back in order</p>
          <p className="text-xs text-muted">
            You just moved through these seven stages — click each one in the order you actually experienced it. This is a{" "}
            <strong className="text-ink">loop input</strong>: the session modelled the technique instead of only describing it.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {SHUFFLED.map((key) => {
            const idx = picked.indexOf(key);
            const isDone = idx !== -1;
            const isCorrectNext = CORRECT_ORDER[picked.length] === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (!isDone && isCorrectNext) setPicked((p) => [...p, key]);
                }}
                className={`flex items-center gap-3 rounded-[7px] border-2 px-3.5 py-2.5 text-left ${
                  isDone ? "border-status-on-track-text bg-status-on-track-bg cursor-default" : "border-border bg-card cursor-pointer"
                }`}
              >
                <span
                  className={`flex size-5 flex-none items-center justify-center rounded-full text-[10.5px] font-bold ${
                    isDone ? "bg-status-on-track-text text-white" : "bg-accent text-muted"
                  }`}
                >
                  {isDone ? idx + 1 : "?"}
                </span>
                <span className="text-[12.5px] font-semibold text-ink">{itemByKey[key].label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted">
          {done ? "All seven in order — that's the staging." : `${picked.length} of 7 placed — click the one that comes next.`}
        </p>
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          data-print-hide
          className="self-start flex h-9 items-center gap-1.5 rounded-full border border-gold/45 bg-gold/10 px-4 text-xs font-semibold text-gold"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="M11 12 20 3" />
            <path d="M16 8l2 2" />
            <path d="M13 11l2 2" />
          </svg>
          Reveal answer key — trainer only
        </button>
      ) : (
        <div className="flex flex-col gap-3.5 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">All done — handout · answer key, to keep</p>
            <div className="flex gap-2" data-print-hide>
              <button type="button" onClick={() => setRevealed(false)} className="h-7 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink">
                Hide
              </button>
              <button type="button" onClick={() => window.print()} className="flex h-7 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink">
                Print
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
            <p className="text-xs font-semibold text-ink">Terminology</p>
            {TERMS.map((t) => (
              <div key={t.term} className="grid grid-cols-[220px_1fr] gap-2.5 border-b border-border-faint py-1">
                <p className="font-serif text-xs font-semibold text-ink">{t.term}</p>
                <p className="text-[11px] leading-snug text-muted">{t.definition}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
            <p className="text-xs font-semibold text-ink">True or false</p>
            {DETAILS.map((d) => (
              <div key={d.q} className="grid grid-cols-[1fr_90px] gap-2.5 border-b border-border-faint py-1">
                <p className="text-[11.5px] text-ink">{d.q}</p>
                <p className="text-[11.5px] font-semibold text-muted">{d.a}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-ink">Correct stage order</p>
            <p className="text-[11.5px] leading-relaxed text-ink">{CORRECT_ORDER_LABEL}</p>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-destructive/25 bg-destructive/5 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-destructive">
              <span className="size-1.5 rounded-full bg-current" />
              Trainer only
            </p>
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-ink">A real time limit, not a formality</p>
              <p className="text-xs leading-relaxed text-ink">
                Time the gist task honestly, out loud, so trainees feel the pressure that forces skimming rather than
                close reading.
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-ink">Peer check is doing real work</p>
              <p className="text-xs leading-relaxed text-ink">
                Don&apos;t skip straight to whole-class feedback — the peer-check step is part of what&apos;s being modelled,
                not padding.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ReceptiveSkillsSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · day two, input 2 · 45 minutes · loop input"
      title="Receptive skills — taught the way you'll teach it."
      intro="This session is staged exactly like the lesson it teaches: pre-taught vocab, a discussion of how the skill should be taught, reading the text to check those ideas, then detail questions. Do the tasks first — the debrief afterward is where it gets named."
      agenda={[
        { time: "0–2", spine: "var(--color-gold)", title: "Lead-in" },
        { time: "2–5", spine: "var(--color-primary)", title: "What are receptive skills?" },
        { time: "5–10", spine: "var(--color-primary)", title: "Pre-teach vocab" },
        { time: "10–13", spine: "var(--color-primary)", title: "Predict the staging" },
        { time: "13–25", spine: "var(--color-primary)", title: "Read the text, check ideas" },
        { time: "25–35", spine: "var(--color-primary)", title: "Detail questions + peer check" },
        { time: "35–43", spine: "var(--color-status-on-track-text)", title: "Debrief: order the stages" },
        { time: "43–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <p className="-mt-4 text-[11px] text-muted">Pairs with: Speakout B2 TP1.1 — Identity &amp; personality</p>

      <RunningThisSession>
        Don&apos;t name &quot;receptive skills&quot; until the debrief. Time the gist task honestly — a real time limit is
        part of what&apos;s being modelled, not a formality.
      </RunningThisSession>

      <RevealCard variant="hero" question="What is a receptive skill?" answer="Reading or listening" />

      <div className="flex flex-col gap-2">
        <MatchTermsExercise terms={TERMS} />
        <p className="text-[11px] italic text-muted">These are the words you needed before reading — and the terms you&apos;ll teach with, from tomorrow on.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 2</p>
        <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-4">
          <p className="text-[13px] text-ink">How do you think receptive skills lessons should be taught?</p>
          <p className="text-[11px] italic text-muted">Discuss with your partner, about a minute.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 3 · Read the text and check if your ideas were right or wrong</p>
        <div className="flex flex-col gap-2.5 rounded-[8px] border border-border bg-card p-5">
          <p className="font-serif text-base font-semibold text-ink">Staging a receptive skills lesson</p>
          <p className="text-[13px] leading-relaxed text-ink">
            A receptive skills lesson never starts cold. It opens by creating interest in the topic — visuals,
            personalisation, brainstorming what the class already knows — because background knowledge is part of
            how anyone understands a text, not a shortcut around it. Only then does the lesson pre-teach vocabulary,
            and only the words essential to understanding.
          </p>
          <p className="text-[13px] leading-relaxed text-ink">
            The gist task comes next, testing global understanding only. For reading, students read silently under a
            time limit, so they read quickly and concentrate on the gist rather than the detail; for listening, the
            recording plays once. Only once gist is secure does the lesson set a specific information or detail
            task, prompting closer reading or listening.
          </p>
          <p className="text-[13px] leading-relaxed text-ink">
            Peer checking before whole-class feedback plays a major role in a receptive skills lesson — it increases
            involvement, builds confidence by making correction feel safer than the teacher stepping in first,
            deepens understanding as students explain answers to each other, and builds the teamwork and
            communication skills that matter beyond the classroom.
          </p>
          <p className="text-[13px] leading-relaxed text-ink">
            The lesson closes with a follow-up task based on something related to the text — a language focus, a
            discussion, a role play or a written task.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Stage 4</p>
          <p className="text-[11px] italic text-muted">More time now — look again at the text and answer these questions, then check with your partner.</p>
        </div>
        {DETAILS.map((d) => (
          <RevealCard key={d.q} question={d.q} answer={d.a} />
        ))}
      </div>

      <ReceptiveOrderAndKey />
    </SessionShell>
  );
}

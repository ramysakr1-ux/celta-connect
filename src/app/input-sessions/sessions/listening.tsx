"use client";

import { useEffect, useRef, useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession, TrainerNotes } from "@/components/input-sessions/trainer-notes";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { OrderExercise } from "@/components/input-sessions/order-exercise";
import { AnswerKey } from "@/components/input-sessions/answer-key";

const TERMS = [
  { term: "Gist", definition: "Listening once for the general idea, not the details." },
  { term: "Detail", definition: "Particular facts a listener listens for on a second, closer pass." },
  { term: "Prediction", definition: "Guessing content from a title, picture or context before listening." },
  { term: "Authentic audio", definition: "A real recording made for real listeners, not simplified for learners." },
  { term: "Scaffolding", definition: "Support given before a task — e.g. seeing the questions before you listen." },
  { term: "Peer check", definition: "Comparing answers with a partner before whole-class feedback." },
  { term: "Jigsaw listening", definition: "Each pair hears a different part of the audio, then shares to complete the picture." },
];

const DIALOGUE_LINES: { speaker: "Zoe" | "Marcus"; text: string }[] = [
  { speaker: "Zoe", text: "I need to plan a listening lesson for my CELTA course." },
  { speaker: "Zoe", text: "Okay so for the listening lesson, I was just going to play the recording like five times until they get it. Foolproof, right?" },
  { speaker: "Marcus", text: "Please don't. If you play it five times you're not testing listening, you're testing memory. One play for gist, that's it." },
  { speaker: "Zoe", text: "Should I at least get them to guess what it's about first, from a picture or the title?" },
  { speaker: "Marcus", text: "Yes — that's prediction, and it primes them before they've heard a single word." },
  { speaker: "Zoe", text: "Fine. But can I pre-teach every single word first, just so nothing surprises them?" },
  { speaker: "Marcus", text: "Also no! Only the words they truly can't survive without. Otherwise you've taught a vocab lesson wearing a listening costume." },
  { speaker: "Zoe", text: "A listening costume. Great. And should I record this myself, or find something real?" },
  { speaker: "Marcus", text: "Authentic audio if you can get it — a real recording beats a scripted one every time." },
  { speaker: "Zoe", text: 'Okay — lead-in, prediction, pre-teach, then play once for gist. What am I even asking them, "did you enjoy that"?' },
  { speaker: "Marcus", text: "Close! Something broad — who's talking, where are they, what's the general idea. Save the tricky detail questions for later." },
  { speaker: "Zoe", text: "Later meaning... a second play? I thought you just told me off for replaying it." },
  { speaker: "Marcus", text: "Different task, different rules. For detail work, a replay or two is totally fair — that's the harder listening, they've earned it." },
  { speaker: "Zoe", text: "Okay so once they've got their answers, I just tell them if they're right?" },
  { speaker: "Marcus", text: "Nope — get them to peer check with each other first. Way less scary than you looming over them with the answer key." },
  { speaker: "Zoe", text: "I don't loom! ...okay maybe a little. And after all that, we're done?" },
  { speaker: "Marcus", text: "Almost — give them a follow-up task tied to the content, so the listening actually leads somewhere instead of just ending." },
  { speaker: "Zoe", text: "Should I scaffold any of this, or just throw them in?" },
  { speaker: "Marcus", text: "A bit of scaffolding helps — give them the questions before they listen, not after." },
  { speaker: "Zoe", text: "What about jigsaw listening — is that for another day?" },
  { speaker: "Marcus", text: "Definitely another day — that's each pair hearing a different half of the audio, then piecing it together." },
  { speaker: "Zoe", text: "Oh, two by two, thank you very much — that actually sounds pretty easy now." },
];

const DETAILS = [
  { q: "It's fine to jump straight into playing the audio with no lead-in.", a: "False — background knowledge helps students follow what they'll hear." },
  { q: "All new vocabulary in the recording should be pre-taught first.", a: "False — only what's essential to following the audio." },
  { q: "Students should hear the recording more than once on the first listen.", a: "False — gist is once only." },
  { q: "A replay is expected for the detail task.", a: "True." },
  { q: "Peer check happens before whole-class feedback.", a: "True." },
  { q: "The lesson should end right after the detail task, with no follow-up.", a: "False — a follow-up task connects to the content or language." },
];

const CORRECT_ORDER = ["Lead-in", "Pre-teach vocab", "Predict the staging", "Listen to the dialogue, check ideas", "Gist task", "Detail task"];
const SHUFFLED = ["Detail task", "Pre-teach vocab", "Gist task", "Predict the staging", "Lead-in", "Listen to the dialogue, check ideas"];

const EXAMPLE_ROWS = [
  { stage: "Lead-in", time: "3′", text: 'Ss look at a photo of an airport departures board — "What\'s happening here?"' },
  { stage: "Pre-teach vocab", time: "5′", text: 'Clarify "delayed," "gate," "boarding" — only what\'s essential to follow the call.' },
  { stage: "Gist", time: "5′", text: 'Play once: "Why is she calling?"' },
  { stage: "Detail", time: "15′", text: "Play again (2–3 times): specific questions on times, reasons, next steps." },
  { stage: "Follow-on", time: "12′", text: 'Ss roleplay their own "delayed flight" phone call using the new vocab.' },
];

const NOTES = [
  { label: "Gist really is once only", text: "Resist replaying for gist even when trainees ask — the pressure is what forces global listening instead of word-by-word decoding." },
  { label: "The synthetic voice is a known limitation, say so once", text: "Real material should use authentic or professionally recorded audio — this session models staging, not audio quality." },
  { label: "Timing (not shown to trainees)", text: "Lead-in 0–2′ · Pre-teach vocab 2–8′ · Predict the staging 8–11′ · Listen to the dialogue 11–25′ · Detail task + discuss 25–33′ · Debrief + trainer notes 33–45′." },
  { label: "Pre-teaching vocab shouldn't pre-teach the answers", text: "Only clarify words essential to following the audio — over-teaching vocab turns a listening lesson into a vocabulary lesson." },
];

// Browser Web Speech API two-voice dialogue player -- no audio file exists
// for this mockup dialogue, so it's synthesized live rather than faked
// with a static player UI. Prefers Chrome's Google voices (reliably
// present, clearly distinguishable) and falls back to whatever the
// browser offers otherwise.
function DialoguePlayer() {
  const [speaking, setSpeaking] = useState(false);
  const [played, setPlayed] = useState(0);
  const [lineIdx, setLineIdx] = useState(-1);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    return () => {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
    };
  }, []);

  function pickTwoVoices(voices: SpeechSynthesisVoice[]) {
    const google = voices.filter((v) => /google/i.test(v.name));
    const pool = google.length ? google : voices;
    const female = pool.find((v) => /female/i.test(v.name)) || pool.find((v) => /us english/i.test(v.name)) || pool[0];
    const male = pool.find((v) => /male/i.test(v.name) && !/female/i.test(v.name)) || pool.find((v) => /uk english male/i.test(v.name)) || pool.find((v) => v !== female) || female;
    return [female, male] as const;
  }

  function play() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setLineIdx(-1);
      return;
    }
    cancelledRef.current = false;
    window.speechSynthesis.cancel();
    let voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
      voices = window.speechSynthesis.getVoices();
    }
    const [traineeVoice, tutorVoice] = pickTwoVoices(voices);
    setSpeaking(true);
    setPlayed((p) => p + 1);
    const speakNext = (i: number) => {
      if (cancelledRef.current) return;
      if (i >= DIALOGUE_LINES.length) {
        setSpeaking(false);
        setLineIdx(-1);
        return;
      }
      const line = DIALOGUE_LINES[i];
      setLineIdx(i);
      const utter = new SpeechSynthesisUtterance(line.text);
      utter.rate = 0.94;
      utter.voice = line.speaker === "Zoe" ? traineeVoice : tutorVoice;
      utter.pitch = line.speaker === "Zoe" ? 1.12 : 0.9;
      utter.onend = () => setTimeout(() => speakNext(i + 1), 320);
      utter.onerror = () => {
        setSpeaking(false);
        setLineIdx(-1);
      };
      window.speechSynthesis.speak(utter);
    };
    speakNext(0);
  }

  const currentLine = lineIdx >= 0 ? DIALOGUE_LINES[lineIdx] : null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-ink">Stage 3 · Listen to the dialogue and check if your ideas were right or wrong</p>
      <div className="flex flex-col gap-3 rounded-[8px] border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-print-hide
            onClick={play}
            className="flex size-11 flex-none items-center justify-center rounded-full bg-primary"
          >
            {speaking ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="flex-1">
            <p className="text-[12.5px] font-semibold text-ink">Zoe asks Marcus — &quot;Staging a listening lesson&quot;</p>
            <p className="text-[11px] text-muted">
              {played === 0 ? "Not played yet" : `Played ${played} time${played > 1 ? "s" : ""}`} · browser text-to-speech, two voices
            </p>
          </div>
        </div>
        {currentLine ? (
          <div className="flex items-baseline gap-2 rounded-[6px] bg-accent px-3.5 py-2.5">
            <p className={`flex-none text-[10.5px] font-bold uppercase tracking-[0.04em] ${currentLine.speaker === "Zoe" ? "text-[oklch(45%_0.09_260)]" : "text-primary"}`}>
              {currentLine.speaker}
            </p>
            <p className="text-[12.5px] text-ink">{currentLine.text}</p>
          </div>
        ) : null}
        <button
          type="button"
          data-print-hide
          onClick={() => setTranscriptOpen((o) => !o)}
          className="self-start text-[10.5px] font-semibold text-primary"
        >
          {transcriptOpen ? "Hide transcript" : "Show transcript"}
        </button>
        {transcriptOpen ? (
          <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
            {DIALOGUE_LINES.map((ln, i) => (
              <div key={i} className="flex gap-2">
                <p className="w-14 flex-none text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted">{ln.speaker}</p>
                <p className="text-xs leading-relaxed text-ink">{ln.text}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
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
        <div className="flex flex-col gap-2">
          <p className="font-serif text-lg font-semibold text-ink">Example lesson — a phone call about a delayed flight</p>
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

export default function ListeningSession() {
  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · loop input"
      title="Listening — taught the way you'll teach it."
      intro="This session is staged exactly like the lesson it teaches: pre-taught vocab, a discussion of how listening should be taught, then listening to a dialogue to check those ideas. Do the tasks first — the debrief afterward is where it gets named."
      agenda={[
        { time: "0–2", spine: "var(--color-gold)", title: "Lead-in" },
        { time: "2–8", spine: "var(--color-primary)", title: "Pre-teach vocab" },
        { time: "8–11", spine: "var(--color-primary)", title: "Predict the staging" },
        { time: "11–25", spine: "var(--color-primary)", title: "Listen to the dialogue, check ideas" },
        { time: "25–33", spine: "var(--color-destructive)", title: "Detail task + discuss" },
        { time: "33–45", spine: "var(--color-status-on-track-text)", title: "Debrief + trainer notes" },
      ]}
    >
      <RunningThisSession>
        Don&apos;t name &quot;listening&quot; or its stages until the debrief. The audio track is browser text-to-speech, not
        a real recording — flag that once, then play it exactly as many times as each task says, no more.
      </RunningThisSession>

      <RevealCard variant="hero" question="How many times should you play audio for gist?" answer="Once." />

      <MatchTermsExercise terms={TERMS} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Stage 2</p>
        <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-4">
          <p className="text-[13px] text-ink">How do you think a listening lesson should be staged?</p>
          <p className="text-[11px] italic text-muted">Discuss with your partner, about a minute — no wrong answers yet.</p>
        </div>
      </div>

      <DialoguePlayer />

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-ink">Stage 4</p>
          <p className="text-[11px] italic text-muted">More time now — answer these from the dialogue, then check with your partner.</p>
        </div>
        {DETAILS.map((d) => (
          <RevealCard key={d.q} question={d.q} answer={d.a} />
        ))}
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

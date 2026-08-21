"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { VoicePicker, speakWithVoice } from "@/components/input-sessions/voice-picker";

const CHART = [
  { symbol: "iː", example: "sheep" }, { symbol: "ɪ", example: "ship" }, { symbol: "ʊ", example: "book" }, { symbol: "uː", example: "boot" },
  { symbol: "e", example: "bed" }, { symbol: "ə", example: "about" }, { symbol: "ɜː", example: "bird" }, { symbol: "ɔː", example: "door" },
  { symbol: "æ", example: "cat" }, { symbol: "ʌ", example: "cup" }, { symbol: "ɑː", example: "car" }, { symbol: "ɒ", example: "hot" },
  { symbol: "p", example: "pen" }, { symbol: "b", example: "bad" }, { symbol: "θ", example: "think" }, { symbol: "ð", example: "this" },
];

const PAIRS = [
  { w1: "ship", w2: "sheep" },
  { w1: "sink", w2: "think" },
  { w1: "light", w2: "right" },
  { w1: "vest", w2: "west" },
];

const ARTICULATION = [
  { symbol: "iː", how: "Lips spread wide, like a small smile. Tongue high and forward, tense. Longer than /ɪ/." },
  { symbol: "ɪ", how: "Lips relaxed, more open than /iː/. Tongue lower and more central, muscles relaxed. Shorter." },
  { symbol: "θ", how: "Tongue tip between the teeth, air pushed through — voiceless, so no vocal cord buzz. Compare with /ð/, same position, voiced." },
  { symbol: "ð", how: "Same tongue position as /θ/, tongue tip between the teeth — but voiced, so the vocal cords buzz. Put a hand on your throat to feel the difference." },
];

const STRUGGLES = [
  { pair: "/iː/ vs /ɪ/ — sheep / ship", who: "Turkish, Spanish, Japanese, Korean speakers", note: "Many languages have only one vowel in this space. Learners often can't hear the contrast before they can produce it — the ear has to be trained first, which is why this session leads with listening." },
  { pair: "/θ/ vs /ð/ — think / this", who: "Almost every L1 without a dental fricative", note: 'Commonly replaced with /s/, /z/, /t/, or /d/ (French: "zis" for "this"; many Asian L1s: "tink" for "think"). Showing the tongue position directly is far more effective than describing it.' },
  { pair: "/r/ vs /l/ — right / light", who: "Japanese, Korean speakers", note: "A famously hard pair because many East Asian languages have one sound occupying the space between English /r/ and /l/. Needs sustained, low-pressure drilling rather than one-off correction." },
  { pair: "/v/ vs /w/ — vest / west", who: "German, Turkish, Hindi speakers", note: "Some L1s don't distinguish these, or map both onto one sound. Lip position is the visible cue worth demonstrating: teeth on lip for /v/, rounded lips for /w/." },
];

const DICTATION = [
  { word: "through", correct: "through", distractors: ["though", "thorough", "tough"] },
  { word: "colonel", correct: "colonel", distractors: ["kernel", "coronal", "colonial"] },
  { word: "debt", correct: "debt", distractors: ["debit", "deb", "debate"] },
];

const OBSTRUCTION_SOUNDS = [
  { symbol: "b", word: "ban", place: "lips" },
  { symbol: "m", word: "man", place: "lips" },
  { symbol: "v", word: "van", place: "lips and teeth" },
  { symbol: "n", word: "nan", place: "tongue tip, alveolar ridge" },
  { symbol: "t", word: "tan", place: "tongue tip, alveolar ridge" },
  { symbol: "k", word: "can", place: "tongue back, velum" },
];

const MATCH_PAIRS = [
  { term: "Vowels", def: "are formed by activating the vocal cords" },
  { term: "Diphthongs", def: "are a glide from one vowel to another" },
  { term: "Monophthongs", def: "are single vowels" },
  { term: "Consonants", def: "are formed when the airflow from the lungs is obstructed by the moveable parts of the mouth, including the tongue and the lips" },
  { term: "Voiced consonants", def: "are formed by modifying its passage through the mouth, principally through the use of the tongue and lips" },
  { term: "Unvoiced consonants", def: "do not require the activation of vocal cords" },
];

const TRAINER_SCRIPT = [
  { time: "0–2", step: "Play both, cold", note: 'Say nothing first. Play "ship" then "sheep" and ask by show of hands which was which. Some will be wrong — that\'s the point, not a problem to fix yet.' },
  { time: "2–10", step: "Chart, sound then word", note: "Go symbol by symbol. Click for the isolated sound, then the example word, and ask trainees to repeat both before moving on. Don't explain IPA conventions yet — let the sound come first." },
  { time: "10–17", step: "Articulation, on the real chart", note: "Open Seeing Speech on the shared screen. Click each of the four sounds on the real IPA chart and let the video play — real ultrasound or MRI, not a drawing. Trainees write down, for each sound, what they actually saw: tongue height, lip shape, whether the tongue touches the teeth. Then have them mouth the shape silently before they voice it — isolates the articulation from the sound itself." },
  { time: "17–25", step: "Learner struggles, by L1", note: 'Read each pair\'s "who" line aloud and ask if anyone has taught (or is) a speaker of that L1. Real anecdotes land harder than the printed note — let the room supply them.' },
  { time: "25–38", step: "Clap game, as a class would run it", note: 'Run it exactly as staged: replay, then clap. After two rounds, stop and ask: "What would you change running this with eight A2 students instead of six trainees?" — slower pace, fewer pairs at once, more repetition.' },
  { time: "38–43", step: "Dictation, spelling betrays them", note: "These three words are chosen because the spelling actively misleads. Let trainees get it wrong once before revealing — the surprise is the lesson." },
  { time: "43–45", step: "Close on the transfer question", note: 'One minute: "Which of today\'s four sounds is most likely to come up in your own TP group, based on their L1s?" No feedback needed — just plant it before they plan.' },
];

function MatchTerms() {
  const [rightOrder] = useState(() => MATCH_PAIRS.map((_, i) => i).reverse());
  const [selTerm, setSelTerm] = useState<number | null>(null);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);

  function pickTerm(i: number) {
    if (solved.has(i)) return;
    setSelTerm(i);
    setWrong(null);
  }
  function pickDef(i: number) {
    if (selTerm === null || solved.has(i)) return;
    if (selTerm === i) {
      setSolved((s) => new Set(s).add(i));
      setSelTerm(null);
      setWrong(null);
    } else {
      setWrong(i);
      setTimeout(() => setWrong(null), 700);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Terminology — match it up</p>
        <p className="text-[11.5px] text-muted">{solved.size ? `${solved.size} of ${MATCH_PAIRS.length} matched` : ""}</p>
      </div>
      <p className="text-[11.5px] text-muted">Click a term, then click the definition you think it goes with.</p>
      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          {MATCH_PAIRS.map((p, i) => {
            const isSolved = solved.has(i);
            const isSel = selTerm === i;
            return (
              <button
                key={p.term}
                type="button"
                onClick={() => pickTerm(i)}
                className={`rounded-[6px] border-[1.5px] px-3.5 py-2.5 text-left text-[12.5px] font-bold ${
                  isSolved
                    ? "border-primary bg-primary/10 text-primary"
                    : isSel
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-ink"
                }`}
              >
                {p.term}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5">
          {rightOrder.map((i) => {
            const p = MATCH_PAIRS[i];
            const isSolved = solved.has(i);
            const isWrong = wrong === i;
            return (
              <button
                key={p.term}
                type="button"
                onClick={() => pickDef(i)}
                className={`rounded-[6px] border-[1.5px] px-3.5 py-2.5 text-left text-[12px] leading-snug ${
                  isSolved
                    ? "border-primary bg-primary/10 text-primary"
                    : isWrong
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border bg-card text-ink"
                }`}
              >
                {p.def}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ClapGame({ voiceIdx }: { voiceIdx: number }) {
  const [answer, setAnswer] = useState<Record<number, "w1" | "w2">>(() =>
    Object.fromEntries(PAIRS.map((_, i) => [i, Math.random() < 0.5 ? "w1" : "w2"]))
  );
  const [picks, setPicks] = useState<Record<number, "correct" | "wrong">>({});

  const answered = Object.keys(picks).length;
  const correctCount = Object.values(picks).filter((v) => v === "correct").length;

  function replay(i: number) {
    const fresh: "w1" | "w2" = Math.random() < 0.5 ? "w1" : "w2";
    setAnswer((a) => ({ ...a, [i]: fresh }));
    setPicks((p) => {
      const next = { ...p };
      delete next[i];
      return next;
    });
    speakWithVoice(PAIRS[i][fresh], 0.92, voiceIdx);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Now try it yourself — clap for what you heard</p>
        <p className="text-[11.5px] text-muted">{answered ? `${correctCount} of ${answered} correct` : ""}</p>
      </div>
      <p className="text-[11.5px] text-muted">
        The same drill, from the student&apos;s seat. Hit replay for a fresh random word each time, then clap the pad
        you heard — the technique you&apos;d run live with a class.
      </p>
      {PAIRS.map((p, i) => {
        const picked = picks[i];
        return (
          <div key={p.w1} className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
            <button
              type="button"
              data-print-hide
              onClick={() => replay(i)}
              className="flex size-8 flex-none items-center justify-center rounded-full bg-muted text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <div className="flex flex-1 gap-2.5">
              {(["w1", "w2"] as const).map((key) => {
                const word = p[key];
                const isRight = key === (answer[i] ?? "w1");
                const isPicked = picked && key === (picked === "correct" ? (answer[i] ?? "w1") : key);
                const show = !!picked;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (picked) return;
                      setPicks((s) => ({ ...s, [i]: isRight ? "correct" : "wrong" }));
                    }}
                    className={`flex-1 rounded-full border-2 px-2.5 py-3 text-center font-serif text-sm font-bold ${
                      show && isRight
                        ? "border-primary bg-primary/10 text-primary"
                        : show && isPicked
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border bg-card text-ink"
                    }`}
                  >
                    👏 {word}
                  </button>
                );
              })}
            </div>
            <p className={`w-16 flex-none text-right text-[11px] font-semibold ${picked === "correct" ? "text-primary" : "text-destructive"}`}>
              {picked ? (picked === "correct" ? "Correct" : "Try again") : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Dictation({ voiceIdx }: { voiceIdx: number }) {
  const [picks, setPicks] = useState<Record<number, string>>({});
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink">Dictation — sound to spelling</p>
      <p className="text-[11.5px] text-muted">English spelling doesn&apos;t reliably show pronunciation. Listen and pick the word that matches the sound, not the sound that matches the usual spelling.</p>
      {DICTATION.map((d, di) => {
        const picked = picks[di];
        const opts = [d.correct, ...d.distractors];
        return (
          <div key={d.word} className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
            <button
              type="button"
              data-print-hide
              onClick={() => speakWithVoice(d.word, 0.92, voiceIdx)}
              className="flex size-8 flex-none items-center justify-center rounded-full bg-primary text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {opts.map((opt) => {
                const isCorrectPick = picked === opt && opt === d.correct;
                const isWrongPick = picked === opt && opt !== d.correct;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPicks((s) => ({ ...s, [di]: opt }))}
                    className={`rounded-full border-[1.5px] px-3 py-1.5 text-[11.5px] font-semibold ${
                      isCorrectPick
                        ? "border-primary bg-primary/10 text-primary"
                        : isWrongPick
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border bg-card text-ink"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrainerScript() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-print-hide
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-muted/10 px-4 text-xs font-semibold text-muted"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="M11 12 20 3" />
          <path d="M16 8l2 2" />
          <path d="M13 11l2 2" />
        </svg>
        Show trainer notes
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-[8px] border border-destructive/25 bg-destructive/5 p-4">
      <div className="flex items-center justify-between gap-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-destructive">
          <span className="size-1.5 rounded-full bg-current" />
          Trainer only — trainer notes
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-[10.5px] font-semibold text-destructive">
          Hide
        </button>
      </div>
      {TRAINER_SCRIPT.map((t) => (
        <div key={t.step} className="flex gap-2.5">
          <p className="w-14 flex-none pt-px text-[10.5px] font-bold text-destructive">{t.time}</p>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-ink">{t.step}</p>
            <p className="text-xs leading-relaxed text-ink">{t.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SoundsSession() {
  const [voiceIdx, setVoiceIdx] = useState(0);

  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · phonology, spoken aloud"
      title="Sounds."
      intro="Every phoneme and minimal pair on this page is spoken aloud, not just written as a symbol. Click any word or symbol to hear it."
      agenda={[
        { time: "0–2", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "2–10", spine: "var(--color-primary)", title: "The phonemic chart, spoken" },
        { time: "10–25", spine: "var(--color-destructive)", title: "Minimal pairs" },
        { time: "25–38", spine: "var(--color-primary)", title: "Dictation" },
        { time: "38–45", spine: "var(--color-destructive)", title: "Trainer notes" },
      ]}
    >
      <div className="flex flex-col gap-1 rounded-[8px] border border-border bg-accent p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">What you&apos;re actually learning to teach</p>
        <p className="text-[12.5px] leading-relaxed text-ink">
          Hearing &quot;ship&quot; and &quot;sheep&quot; apart is the easy part — you already can. The job is teaching a
          student who genuinely can&apos;t yet: knowing why they can&apos;t, what to do with your mouth to show the
          difference, and which pairs are worth drilling for their L1. That&apos;s what the next two sections are for.
        </p>
      </div>

      <VoicePicker voiceIdx={voiceIdx} setVoiceIdx={setVoiceIdx} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 2 minutes</p>
        <div className="flex items-center gap-3 rounded-[8px] border border-border bg-card p-4">
          <button
            type="button"
            data-print-hide
            onClick={() => {
              speakWithVoice("ship", 0.92, voiceIdx);
              setTimeout(() => speakWithVoice("sheep", 0.92, voiceIdx), 900);
            }}
            className="flex size-9 flex-none items-center justify-center rounded-full bg-primary text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <p className="text-[13px] text-ink">
            Listen: &quot;ship&quot; then &quot;sheep.&quot; Same spelling pattern almost, one letter of difference on
            the page. Can you hear which is which without seeing the words?
          </p>
        </div>
      </div>

      <MatchTerms />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">Where the sound is made</p>
        <p className="text-[11.5px] text-muted">Click each sound to hear it, then say it back yourself and notice where your own tongue, lips or teeth move.</p>
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="text-xs leading-relaxed text-ink">
            Consonants are formed when airflow from the lungs is obstructed by the moveable parts of the mouth —
            tongue, teeth, lips, palate. Click a sound to hear it and see where it&apos;s obstructed.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OBSTRUCTION_SOUNDS.map((s) => (
              <button
                key={s.symbol}
                type="button"
                data-print-hide
                onClick={() => {
                  speakWithVoice(s.symbol, 0.92, voiceIdx);
                  setTimeout(() => speakWithVoice(s.word, 0.92, voiceIdx), 700);
                }}
                className="rounded-full border-[1.5px] border-border bg-accent px-3 py-1.5 font-serif text-[12.5px] font-semibold text-ink"
              >
                /{s.symbol}/ <span className="font-sans font-normal text-muted">— {s.place}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">The phonemic chart, spoken</p>
        <p className="text-[11.5px] text-muted">Click any symbol to hear the sound in isolation, then in a real word.</p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {CHART.map((c) => (
            <button
              key={c.symbol}
              type="button"
              data-print-hide
              onClick={() => {
                speakWithVoice(c.symbol, 0.92, voiceIdx);
                setTimeout(() => speakWithVoice(c.example, 0.92, voiceIdx), 700);
              }}
              className="flex flex-col items-center gap-0.5 rounded-[6px] border-[1.5px] border-border bg-card px-1.5 py-2.5"
            >
              <p className="font-serif text-[15px] font-semibold text-ink">/{c.symbol}/</p>
              <p className="text-[9.5px] text-muted">{c.example}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">Articulation — how to physically produce it</p>
        <p className="text-[11.5px] text-muted">
          A learner can&apos;t copy a written symbol — they need to see the mouth move. On the site below, click each
          of these four sounds on the real IPA chart and watch the video, then write down what you actually see —
          tongue, lips, teeth — before checking it against the summary underneath.
        </p>
        <div className="flex items-center gap-2.5 rounded-[8px] border border-muted/25 bg-muted/10 px-3.5 py-2.5">
          <p className="flex-1 text-xs leading-relaxed text-ink">
            Show the real thing rather than a diagram — <strong className="font-semibold">Seeing Speech</strong> is a
            clickable IPA chart with real ultrasound, MRI and animated vocal-tract video for every sound, free.
          </p>
          <a
            href="https://www.seeingspeech.ac.uk/ipa-charts/"
            target="_blank"
            rel="noreferrer"
            className="flex h-8 flex-none items-center rounded-[6px] bg-muted px-3.5 text-xs font-bold text-ink"
          >
            seeingspeech.ac.uk
          </a>
        </div>
        {ARTICULATION.map((a) => (
          <button
            key={a.symbol}
            type="button"
            onClick={() => speakWithVoice(a.symbol, 0.92, voiceIdx)}
            className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card p-3.5 text-left"
          >
            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-primary text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="w-12 flex-none font-serif text-[15px] font-semibold text-ink">/{a.symbol}/</span>
            <span className="flex-1 text-xs leading-relaxed text-muted">{a.how}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-ink">Where learners typically struggle</p>
        <p className="text-[11.5px] text-muted">The same four pairs from the clap game — each is a known trouble spot for a common set of L1 backgrounds.</p>
        {STRUGGLES.map((s) => (
          <div key={s.pair} className="flex flex-col gap-1 rounded-[8px] border border-border bg-card p-3.5">
            <div className="flex items-baseline gap-2.5">
              <p className="font-serif text-sm font-semibold text-ink">{s.pair}</p>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted">{s.who}</p>
            </div>
            <p className="text-xs leading-relaxed text-muted">{s.note}</p>
          </div>
        ))}
      </div>

      <ClapGame voiceIdx={voiceIdx} />

      <Dictation voiceIdx={voiceIdx} />

      <TrainerScript />
    </SessionShell>
  );
}

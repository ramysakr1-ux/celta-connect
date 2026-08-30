"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { VoicePicker, speakWithVoice } from "@/components/input-sessions/voice-picker";

interface Example {
  label: string;
  full: string;
  options: [string, string];
  correct: 0 | 1;
  answer: string;
}
interface Section {
  title: string;
  tone: string;
  def: string;
  examples: Example[];
}

const SECTIONS: Section[] = [
  {
    title: "Strong and weak forms",
    tone: "var(--color-primary)",
    def: "small function words shrink and lose their vowel sound in fast speech",
    examples: [
      { label: '"A cup of tea, please."', full: "A cup of tea, please.", options: ["/ɒv/, the full vowel", "/əv/, the weak form"], correct: 1, answer: "/əv/ — the vowel shrinks to schwa. Function words like \"of,\" \"to,\" \"and\" almost always take their weak form in running speech." },
      { label: "\"I'd like to go.\"", full: "I'd like to go.", options: ["/tuː/, the full vowel", "/tə/, the weak form"], correct: 1, answer: '/tə/ — "to" loses its vowel the same way "of" does. Learners who only ever hear the dictionary form /tuː/ won\'t recognise it here.' },
      { label: '"What are you doing?"', full: "What are you doing?", options: ["/ɑː/, the full vowel", "/ə/, the weak form"], correct: 1, answer: '/ə/ — "are" almost always weakens in a question like this, running into "you" as "whaddaya."' },
    ],
  },
  {
    title: "Linking",
    tone: "var(--color-muted)",
    def: "a final consonant joins onto the next word's vowel",
    examples: [
      { label: '"an egg"', full: "an egg", options: ["Said as two separate words", 'The /n/ joins onto "egg"'], correct: 1, answer: '/əˈneg/ — the final /n/ of "an" links onto the vowel that starts "egg," so the words run together.' },
      { label: '"turn it off"', full: "turn it off", options: ["Said as three separate words", "The /n/ and /t/ link across the words"], correct: 1, answer: '"Turn it" links to sound like "tur-nit," and "it off" links to sound like "i-toff" — every consonant-to-vowel boundary is a potential join.' },
      { label: '"far away"', full: "far away", options: ["Said as two separate words", 'The /r/ links onto "away"'], correct: 1, answer: 'The written /r/ at the end of "far," silent on its own in most British accents, resurfaces because a vowel follows — "fa-raway."' },
    ],
  },
  {
    title: "Intrusion",
    tone: "var(--color-destructive)",
    def: "an extra /r/, /w/ or /j/ is inserted between two vowel sounds",
    examples: [
      { label: '"go away"', full: "go away", options: ["Nothing is added between the words", "An extra /w/ sound appears"], correct: 1, answer: 'A /w/ sound intrudes between "go" and "away" — neither word\'s spelling shows it, but two vowel sounds in a row are hard to say cleanly, so English inserts a glide.' },
      { label: '"I saw it"', full: "I saw it", options: ["Nothing is added between the words", 'An extra /r/ sound appears after "saw"'], correct: 1, answer: 'The famous "intrusive r" — "saw it" is often pronounced "saw-r-it," even though there\'s no r in "saw" at all.' },
      { label: '"do it"', full: "do it", options: ["Nothing is added between the words", "An extra /w/ sound appears"], correct: 1, answer: '"Do it" becomes "do-w-it" — the lip-rounding from /uː/ carries over as a /w/ before the next vowel starts.' },
    ],
  },
  {
    title: "Assimilation",
    tone: "var(--color-primary)",
    def: "a sound changes to match the sound that follows it",
    examples: [
      { label: '"ten bikes"', full: "ten bikes", options: ["/n/ stays /n/", "/n/ becomes /m/"], correct: 1, answer: '/n/ becomes /m/ before the /b/ that follows — "tem bikes." The tongue is already anticipating the lips closing for /b/.' },
      { label: '"good girl"', full: "good girl", options: ["/d/ stays /d/", "/d/ becomes /g/"], correct: 1, answer: '/d/ shifts toward /g/ before the /g/ of "girl" — "gug girl." Same principle: the earlier sound moves to anticipate the later one.' },
      { label: '"handbag"', full: "handbag", options: ["/d/ stays /d/", "/d/ becomes /b/"], correct: 1, answer: '/d/ shifts toward /b/ before the /b/ of "bag" — "hambag." Same anticipation, this time with the lips.' },
    ],
  },
  {
    title: "Elision",
    tone: "var(--color-ink)",
    def: "a sound or whole syllable is dropped to make a phrase easier to say",
    examples: [
      { label: '"next day"', full: "next day", options: ["All sounds are said", "The /t/ disappears"], correct: 1, answer: 'The /t/ in "next" is dropped — "nex\' day." Three consonants in a row (/k/, /s/, /t/) followed by another consonant is too much, so one goes.' },
      { label: '"probably"', full: "probably", options: ["All three syllables are said", "The middle syllable disappears"], correct: 1, answer: 'The middle syllable vanishes — "prob\'ly," two syllables instead of three. Very common in fast, informal speech.' },
      { label: '"friendship"', full: "friendship", options: ["The /d/ is fully said", "The /d/ disappears"], correct: 1, answer: 'The /d/ drops between /n/ and /ʃ/ — "frien\'ship." Same crowded-consonant pattern as "next day."' },
    ],
  },
];

const HOMOPHONE_LINES = [
  { line: "Eye here you want to meat hour sun.", answer: "I hear you want to meet our son." },
  { line: "Hour jump a risen may jet.", answer: "Our jumper isn't made yet." },
  { line: "Weave scene hour glass is.", answer: "We've seen our glasses." },
];

const MATCH_TERMS = [
  { term: "Linking", definition: "a final consonant joins onto the next word's vowel" },
  { term: "Intrusion", definition: "an extra /r/, /w/ or /j/ is inserted between two vowel sounds" },
  { term: "Assimilation", definition: "a sound changes to match the sound that follows it" },
  { term: "Elision", definition: "a sound or whole syllable is dropped to make a phrase easier to say" },
  { term: "Weak form", definition: "the reduced, schwa-vowel version a function word takes in fast speech" },
];

const TRAINER_SCRIPT = [
  { time: "0–3", step: 'Lead-in: "gonna"', note: 'Play it cold, no spelling shown. Ask what they heard, then reveal it\'s "going to." Name the session\'s promise: five reasons English doesn\'t sound like it\'s spelled, two examples each.' },
  { time: "3–7", step: "Terminology match", note: "Have trainees match the five terms to their definitions before any audio. This is the vocabulary they need for the rest of the session and for their LRT write-up — get it settled before the listening starts." },
  { time: "7–14", step: "Strong and weak forms, 3 items", note: "Play each sentence, let trainees guess which vowel they heard before revealing. After all three, ask them to say each sentence back themselves using the weak form — producing it is what makes it stick." },
  { time: "14–22", step: "Linking, 3 items", note: "After each guess, replay the careful word-by-word version so the join is audible only by contrast. Ask: what do the examples have in common structurally? (consonant end, vowel start)" },
  { time: "22–30", step: "Intrusion, 3 items", note: "This is the hardest of the five to hear. Give each item two plays before revealing. If trainees disagree on exactly which sound intrudes, that's fine — the point is noticing something is added at all." },
  { time: "30–39", step: "Assimilation, 3 items", note: "After each guess, have trainees say the phrase back at natural speed themselves. Producing it usually surfaces the sound change before they can consciously hear it in a recording. Name the direction explicitly: the earlier sound anticipates the later one." },
  { time: "39–47", step: "Elision, 3 items", note: "Good to end the guessing on a high note. Ask what trainees notice in common across the examples — each drops a sound that would otherwise be awkward to fit in." },
  { time: "47–50", step: "Close: connect to FOL and LRT", note: 'Ask: "Which of these five features showed up in your FOL learner\'s listening, or in your own natural speech that a learner might struggle with?" For LRT, remind them the phonological analysis section should name the specific feature, not just say "the pronunciation is different."' },
];

function HomophoneLines() {
  const [shown, setShown] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-ink">Lead-in, alternative · read these aloud</p>
      <p className="text-[11.5px] text-muted">Sound out each line fast — they&apos;re homophone strings, not real sentences on the page.</p>
      {HOMOPHONE_LINES.map((h, i) => (
        <div key={h.line} className="flex items-center gap-3 rounded-[8px] border border-border bg-card px-3.5 py-3">
          <p className="flex-1 font-serif text-sm italic text-ink">{h.line}</p>
          {shown[i] ? <p className="text-[11.5px] text-muted">{h.answer}</p> : null}
          <button
            type="button"
            data-print-hide
            onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))}
            className="flex-none text-[10.5px] font-semibold text-primary"
          >
            {shown[i] ? "Hide" : "Reveal"}
          </button>
        </div>
      ))}
    </div>
  );
}

function FeatureExample({ ex, tone, voiceIdx }: { ex: Example; tone: string; voiceIdx: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2.5 rounded-[8px] border border-border bg-card p-4">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          data-print-hide
          onClick={() => speakWithVoice(ex.full, 1.1, voiceIdx)}
          className="flex size-8 flex-none items-center justify-center rounded-full text-white"
          style={{ background: tone }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <p className="flex-1 text-[13px] text-ink">{ex.label}</p>
      </div>
      <div className="flex flex-wrap gap-2 pl-[46px]">
        {ex.options.map((opt, oi) => {
          const isRight = oi === ex.correct;
          const isPicked = picked === oi;
          const show = picked !== null;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (picked !== null) return;
                setPicked(oi);
              }}
              className={`rounded-[6px] border-[1.5px] px-3.5 py-1.5 text-xs font-semibold ${
                show && isRight
                  ? "border-primary bg-primary/10 text-primary"
                  : show && isPicked
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-card text-ink"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null ? (
        <p className="pl-[46px] text-xs leading-relaxed" style={{ color: tone }}>
          {ex.answer}
        </p>
      ) : null}
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
          Trainer only — stage-by-stage script
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

export default function ConnectedSpeechSession() {
  const [voiceIdx, setVoiceIdx] = useState(0);

  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · phonology, spoken aloud"
      title="Connected speech."
      intro="Five features, one example each: strong and weak forms, linking, intrusion, assimilation, elision."
      agenda={[
        { time: "0–3", spine: "var(--color-muted)", title: "Lead-in" },
        { time: "3–7", spine: "var(--color-muted)", title: "Terminology match" },
        { time: "7–14", spine: "var(--color-primary)", title: "Strong/weak forms · 3 items" },
        { time: "14–22", spine: "var(--color-muted)", title: "Linking · 3 items" },
        { time: "22–30", spine: "var(--color-destructive)", title: "Intrusion · 3 items" },
        { time: "30–39", spine: "var(--color-primary)", title: "Assimilation · 3 items" },
        { time: "39–47", spine: "var(--color-gold)", title: "Elision · 3 items" },
        { time: "47–50", spine: "var(--color-destructive)", title: "Close" },
      ]}
    >
      <div className="flex flex-col gap-1.5 rounded-[8px] border border-primary/25 bg-primary/5 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
          <span className="size-1.5 rounded-full bg-current" />
          Where this feeds back in
        </p>
        <p className="text-[12.5px] leading-relaxed text-ink">
          FOL&apos;s listening-comprehension section is where connected speech usually shows up: a learner who reads a
          script fine but can&apos;t follow the same words spoken naturally. LRT&apos;s phonological analysis should note
          where a text&apos;s natural pronunciation departs from its spelling — these five terms are the vocabulary for
          that.
        </p>
      </div>

      <VoicePicker voiceIdx={voiceIdx} setVoiceIdx={setVoiceIdx} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Lead-in · 3 minutes</p>
        <div className="flex items-center gap-3 rounded-[8px] border border-border bg-card p-4">
          <button
            type="button"
            data-print-hide
            onClick={() => speakWithVoice("gonna", 0.9, voiceIdx)}
            className="flex size-9 flex-none items-center justify-center rounded-full bg-primary text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <p className="text-[13px] text-ink">
            Listen: &quot;gonna.&quot; Now try writing what you heard using only words from a dictionary. There isn&apos;t
            one — that&apos;s the session.
          </p>
        </div>
      </div>

      <HomophoneLines />

      <MatchTermsExercise terms={MATCH_TERMS} />

      <div className="flex flex-col gap-4">
        <p className="text-[11.5px] text-muted">For each feature below: listen to the clip, then choose the answer that matches what you heard.</p>
        {SECTIONS.map((sec, si) => (
          <div key={sec.title} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2.5">
              <p className="font-serif text-lg font-semibold text-ink">
                {si + 1}. {sec.title}
              </p>
              <p className="text-[11px] text-muted">{sec.def}</p>
            </div>
            {sec.examples.map((ex) => (
              <FeatureExample key={ex.label} ex={ex} tone={sec.tone} voiceIdx={voiceIdx} />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card p-4">
        <p className="flex-1 text-xs leading-relaxed text-ink">
          For face-to-face, run every clip live from a laptop speaker — no headphones needed. The BBC&apos;s{" "}
          <strong className="font-semibold">Learning English</strong> pronunciation series has short free clips of
          natural connected speech if you want more examples beyond today&apos;s five.
        </p>
        <a
          href="https://www.bbc.co.uk/learningenglish/english/features/pronunciation"
          target="_blank"
          rel="noreferrer"
          className="flex h-8 flex-none items-center rounded-[6px] bg-primary px-3.5 text-xs font-bold text-white"
        >
          bbc.co.uk/learningenglish
        </a>
      </div>

      <TrainerScript />
    </SessionShell>
  );
}

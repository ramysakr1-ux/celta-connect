"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { MatchTermsExercise } from "@/components/input-sessions/match-terms-exercise";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { VoicePicker, speakWithVoice } from "@/components/input-sessions/voice-picker";

// design_handoff_input_sessions_2 §2a -- "Phonology: sounds", slug
// phonology-sounds, 60 minutes. The hands-on script session, and session 2
// of the sounds pair: the existing `sounds` session is minimal pairs and L1
// trouble spots, this one is the chart and the writing.
//
// Every word on the page can be HEARD -- sound first, then the word, through
// the same Web Speech voice picker the other phonology sessions use. Rate
// 0.85, per the spec.
//
// Seven stages, all self-checking: check marks each answer, any edit clears
// the marks so nobody is stuck looking at a red box they have already fixed.

const RATE = 0.85;

const LEAD: { word: string; letters: number; sounds: number[] }[] = [
  { word: "letter", letters: 6, sounds: [4, 5] },
  { word: "sound", letters: 5, sounds: [4] },
  { word: "vowel", letters: 5, sounds: [4] },
  { word: "consonant", letters: 9, sounds: [9] },
  { word: "phoneme", letters: 7, sounds: [5] },
];

// Corrected definitions -- the live `sounds` session had Vowels and Voiced
// consonants swapped, which made both wrong. See that file's own note.
const TERMS = [
  {
    term: "Vowels",
    definition: "are formed by modifying the airflow’s passage through the mouth, principally with the tongue and lips",
  },
  { term: "Diphthongs", definition: "are a glide from one vowel to another" },
  { term: "Monophthongs", definition: "are single vowels" },
  {
    term: "Consonants",
    definition:
      "are formed when the airflow from the lungs is obstructed by the moveable parts of the mouth, including the tongue and the lips",
  },
  { term: "Voiced consonants", definition: "are formed by activating the vocal cords" },
  { term: "Unvoiced consonants", definition: "do not require the activation of the vocal cords" },
];

const PLACES = [
  "— where? —",
  "the lips",
  "lower lip + top teeth",
  "tongue tip + ridge behind the teeth",
  "tongue tip near the ridge (not touching)",
  "back of the tongue + soft palate",
];
const OBSTRUCTION: { sound: string; word: string; answer: number }[] = [
  { sound: "b", word: "ban", answer: 1 },
  { sound: "m", word: "man", answer: 1 },
  { sound: "v", word: "van", answer: 2 },
  { sound: "n", word: "nan", answer: 3 },
  { sound: "t", word: "tan", answer: 3 },
  { sound: "r", word: "ran", answer: 4 },
  { sound: "k", word: "can", answer: 5 },
  { sound: "p", word: "pan", answer: 1 },
];

const VOICING: { ipa: string; word: string; first: "v" | "u"; last: "v" | "u" }[] = [
  { ipa: "/met/", word: "met", first: "v", last: "u" },
  { ipa: "/dek/", word: "deck", first: "v", last: "u" },
  { ipa: "/ðen/", word: "then", first: "v", last: "v" },
  { ipa: "/hedʒ/", word: "hedge", first: "u", last: "v" },
  { ipa: "/breθ/", word: "breath", first: "v", last: "u" },
  { ipa: "/fetʃ/", word: "fetch", first: "u", last: "u" },
  { ipa: "/nekst/", word: "next", first: "v", last: "u" },
  { ipa: "/jet/", word: "yet", first: "v", last: "u" },
];

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const RED = "oklch(45% 0.15 27)";
const WARM = "oklch(30% 0.042 58)";
const MUTED = "oklch(51% 0.017 70)";

type Cell = [string, string, string] | null;
const VOWELS: Cell[] = [
  ["iː", "see", TEAL], ["ɪ", "his", GOLD], ["ʊ", "put", GOLD], ["uː", "too", TEAL],
  ["e", "ten", GOLD], ["ə", "ago", GOLD], ["ɜː", "her", TEAL], ["ɔː", "saw", TEAL],
  ["æ", "hat", GOLD], ["ʌ", "but", GOLD], ["ɑː", "car", TEAL], ["ɒ", "hot", GOLD],
];
const DIPHTHONGS: Cell[] = [
  ["ɪə", "ear", RED], ["eɪ", "say", RED], null,
  ["ʊə", "pure", RED], ["ɔɪ", "boy", RED], ["əʊ", "so", RED],
  ["eə", "air", RED], ["aɪ", "buy", RED], ["aʊ", "now", RED],
];
const CONSONANTS: Cell[] = [
  ["p", "pen", MUTED], ["b", "book", WARM], ["t", "tea", MUTED], ["d", "day", WARM],
  ["tʃ", "chair", MUTED], ["dʒ", "jam", WARM], ["k", "key", MUTED], ["g", "go", WARM],
  ["f", "four", MUTED], ["v", "very", WARM], ["θ", "thin", MUTED], ["ð", "that", WARM],
  ["s", "sun", MUTED], ["z", "zoo", WARM], ["ʃ", "she", MUTED], ["ʒ", "vision", WARM],
  ["m", "man", WARM], ["n", "no", WARM], ["ŋ", "sing", WARM], ["h", "hat", MUTED],
  ["l", "look", WARM], ["r", "red", WARM], ["w", "want", WARM], ["j", "yes", WARM],
];

const KEYS = "ɪ e æ ʌ ɒ ʊ ə iː ɑː ɔː uː ɜː | eɪ aɪ ɔɪ əʊ aʊ ɪə eə ʊə | θ ð ʃ ʒ tʃ dʒ ŋ j".split(" ");
const SCRIPT: { word: string; answer: string }[] = [
  { word: "sent", answer: "sent" },
  { word: "edge", answer: "edʒ" },
  { word: "thin", answer: "θɪn" },
  { word: "thing", answer: "θɪŋ" },
  { word: "think", answer: "θɪŋk" },
  { word: "this", answer: "ðɪs" },
  { word: "fixed", answer: "fɪkst" },
  { word: "jest", answer: "dʒest" },
  { word: "yelled", answer: "jeld" },
  { word: "stretched", answer: "stretʃt" },
];

const FILMS: { ipa: string; answer: string }[] = [
  { ipa: "/bætmæn/", answer: "batman" },
  { ipa: "/kɪŋ kɒŋ/", answer: "king kong" },
  { ipa: "/eəpleɪn/", answer: "airplane" },
  { ipa: "/dʒɔːz/", answer: "jaws" },
  { ipa: "/ðə bɜːdz/", answer: "the birds" },
  { ipa: "/saɪkəʊ/", answer: "psycho" },
  { ipa: "/ʃɪkɑːgəʊ/", answer: "chicago" },
  { ipa: "/dɒktə ʒɪvɑːgəʊ/", answer: "doctor zhivago" },
];

/** Typed IPA is forgiving about the things a keyboard makes hard, and nothing else. */
function normaliseIPA(value: string): string {
  return value
    .trim()
    .replace(/[/\s]/g, "")
    .replace(/ʤ/g, "dʒ")
    .replace(/ʧ/g, "tʃ")
    .replace(/:/g, "ː")
    .replace(/ɡ/g, "g");
}

export default function PhonologySoundsSession() {
  const [voiceIdx, setVoiceIdx] = useState(0);
  const say = (text: string) => speakWithVoice(text, RATE, voiceIdx);

  return (
    <SessionShell
      eyebrow="Input session · 60 minutes · phonology, spoken aloud · session 2 of the sounds pair"
      title="Phonology: sounds"
      intro="Sounds against letters, the terminology, where consonants are made, voicing, the whole phonemic chart spoken aloud, and then writing in phonemic script until it stops feeling foreign. Every word on this page can be heard, not just read."
      agenda={[
        { time: "0–8", title: "Sounds vs letters", spine: GOLD },
        { time: "8–15", title: "Terminology", spine: TEAL },
        { time: "15–25", title: "Where consonants are made", spine: TEAL },
        { time: "25–33", title: "Voiced or unvoiced", spine: TEAL },
        { time: "33–40", title: "The chart, spoken", spine: WARM },
        { time: "40–50", title: "Phonemic script", spine: WARM },
        { time: "50–60", title: "Film titles", spine: RED },
      ]}
    >
      <RunningThisSession>
        Trainees type answers on their own screens and check themselves; you only reveal. Keep the chart open on the
        shared screen from stage 5 onwards — stages 6 and 7 are done with it in view. The film titles are a race; call it
        after ten minutes whatever the state of play.
      </RunningThisSession>

      <VoicePicker voiceIdx={voiceIdx} setVoiceIdx={setVoiceIdx} />

      <LeadIn say={say} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">2 · Terminology · 7 minutes</h2>
          <p className="text-xs text-muted">Six terms. Match each to its definition, then close the screen and say them back from memory.</p>
        </div>
        <MatchTermsExercise terms={TERMS} />
      </section>

      <Obstruction say={say} />
      <Voicing say={say} />
      <Chart say={say} />
      <ScriptWriting />
      <FilmRace />

      <TrainerNotes
        notes={[
          {
            label: "0–8 · Dictate, then count",
            text: 'Play each word twice at most. Let them argue over the count of sounds in "letter" — four or five is the point, not a problem: it depends on rhoticity. Ask a non-British speaker in the room what they say.',
          },
          {
            label: "8–15 · Match, then say it back",
            text: 'After matching, close the screen and ask pairs to define "diphthong" and "voiced" from memory. If they can\'t, they haven\'t got it yet.',
          },
          {
            label: "15–25 · Hands on mouths",
            text: "Have them say each sound with a hand on the lips, then a finger on the throat. Open Seeing Speech on the shared screen for /r/ and /k/ — the two most people get wrong — and watch the tongue.",
          },
          {
            label: "25–33 · Voicing from the throat",
            text: 'Hand on the throat for /s/ then /z/, holding each for two seconds. Then the table. Learners devoice final consonants in many L1s (Turkish, German, Russian) — say so here, it is why "last sound" is in the task.',
          },
          {
            label: "33–40 · Chart, sound then word",
            text: "Click through by row. Don't explain conventions; let the sound come first. Point out the colour groups and that the chart is arranged by mouth position, not alphabet.",
          },
          {
            label: "40–50 · Script, keys not memory",
            text: 'Nobody memorises symbols today; they look them up on the chart above. Common slips: "yelled" starting with y not j, "edge" starting with a vowel, "stretched" ending in /t/ not /d/. Check as a class before revealing.',
          },
          {
            label: "50–60 · Race, then close",
            text: "Pairs race; first to eight wins. Close on the transfer question: which two sounds from today are most likely to trouble your own TP group?",
          },
        ]}
      />
    </SessionShell>
  );
}

// ---------------------------------------------------------------------------

function PlayButton({ onClick, label = "Play" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-7 flex-none items-center justify-center rounded-full border border-border bg-card text-primary hover:border-primary"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  );
}

function Score({ right, total }: { right: number; total: number }) {
  return (
    <span className="text-[11.5px] font-semibold" style={{ color: right === total ? TEAL : GOLD }}>
      {right} / {total} correct
    </span>
  );
}

function markClass(checked: boolean, ok: boolean) {
  if (!checked) return "border-border";
  return ok ? "border-primary bg-primary/5" : "border-destructive bg-destructive/5";
}

function LeadIn({ say }: { say: (t: string) => void }) {
  const [answers, setAnswers] = useState<Record<number, { word: string; letters: string; sounds: string }>>({});
  const [checked, setChecked] = useState(false);

  const get = (i: number) => answers[i] ?? { word: "", letters: "", sounds: "" };
  const set = (i: number, patch: Partial<{ word: string; letters: string; sounds: string }>) => {
    setChecked(false);
    setAnswers((a) => ({ ...a, [i]: { ...get(i), ...patch } }));
  };
  const rowOk = (i: number) => {
    const row = LEAD[i];
    const a = get(i);
    return (
      a.word.trim().toLowerCase() === row.word &&
      Number(a.letters) === row.letters &&
      row.sounds.includes(Number(a.sounds))
    );
  };
  const right = LEAD.filter((_, i) => rowOk(i)).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">1 · Sounds vs letters · 8 minutes</h2>
          <p className="text-xs text-muted">
            Listen, write the word, then count its letters and its sounds. They are not the same number.
          </p>
        </div>
        {checked ? <Score right={right} total={LEAD.length} /> : null}
      </div>
      <div className="flex flex-col gap-2">
        {LEAD.map((row, i) => {
          const a = get(i);
          return (
            <div key={row.word} className={`flex flex-wrap items-center gap-2 rounded-[8px] border px-3 py-2 ${markClass(checked, rowOk(i))}`}>
              <PlayButton onClick={() => say(row.word)} label={`Play word ${i + 1}`} />
              <input
                value={a.word}
                onChange={(e) => set(i, { word: e.target.value })}
                placeholder="the word"
                className="w-32 rounded-[6px] border border-border bg-card px-2 py-1 text-[12.5px] text-ink outline-none focus:border-primary"
              />
              <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
                letters
                <input
                  value={a.letters}
                  onChange={(e) => set(i, { letters: e.target.value })}
                  inputMode="numeric"
                  className="w-12 rounded-[6px] border border-border bg-card px-2 py-1 text-center text-[12.5px] text-ink outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
                sounds
                <input
                  value={a.sounds}
                  onChange={(e) => set(i, { sounds: e.target.value })}
                  inputMode="numeric"
                  className="w-12 rounded-[6px] border border-border bg-card px-2 py-1 text-center text-[12.5px] text-ink outline-none focus:border-primary"
                />
              </label>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setChecked(true)} className="rounded-full bg-primary px-4 py-1.5 text-[11.5px] font-semibold text-primary-foreground">
          Check
        </button>
      </div>
      <RevealCard
        question="Why doesn’t the number of letters match the number of sounds?"
        answer="Because English spelling records history, not pronunciation. “letter” has six letters and four or five sounds depending on whether you pronounce the r; “phoneme” has seven letters and five sounds. A phoneme is a unit of sound, and the alphabet was never built to write one."
      />
    </section>
  );
}

function Obstruction({ say }: { say: (t: string) => void }) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const right = OBSTRUCTION.filter((o, i) => picks[i] === o.answer).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">3 · Where is the obstruction? · 10 minutes</h2>
          <p className="text-xs text-muted">
            Play the sound, then the word. Say it yourself with a hand on your lips — where is the airflow actually
            stopped?
          </p>
        </div>
        {checked ? <Score right={right} total={OBSTRUCTION.length} /> : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OBSTRUCTION.map((o, i) => (
          <div key={o.sound} className={`flex flex-wrap items-center gap-2 rounded-[8px] border px-3 py-2 ${markClass(checked, picks[i] === o.answer)}`}>
            <span className="font-serif text-base font-semibold text-ink">/{o.sound}/</span>
            <PlayButton onClick={() => say(o.sound)} label={`Play the sound ${o.sound}`} />
            <PlayButton onClick={() => say(o.word)} label={`Play the word ${o.word}`} />
            <select
              value={picks[i] ?? 0}
              onChange={(e) => {
                setChecked(false);
                setPicks((p) => ({ ...p, [i]: Number(e.target.value) }));
              }}
              className="min-w-0 flex-1 rounded-[6px] border border-border bg-card px-2 py-1 text-[11.5px] text-ink outline-none focus:border-primary"
            >
              {PLACES.map((label, pi) => (
                <option key={label} value={pi}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setChecked(true)} className="self-start rounded-full bg-primary px-4 py-1.5 text-[11.5px] font-semibold text-primary-foreground">
        Check
      </button>
      <a
        href="https://www.seeingspeech.ac.uk/ipa-charts/"
        target="_blank"
        rel="noreferrer"
        className="self-start rounded-[8px] border border-border bg-card px-4 py-2 text-[12px] text-ink hover:border-primary"
      >
        Seeing Speech — real ultrasound and MRI of each sound, on the IPA chart
      </a>
    </section>
  );
}

function Voicing({ say }: { say: (t: string) => void }) {
  const [answers, setAnswers] = useState<Record<number, { word: string; first: string; last: string }>>({});
  const [checked, setChecked] = useState(false);
  const get = (i: number) => answers[i] ?? { word: "", first: "", last: "" };
  const rowOk = (i: number) => {
    const row = VOICING[i];
    const a = get(i);
    return a.word.trim().toLowerCase() === row.word && a.first === row.first && a.last === row.last;
  };
  const right = VOICING.filter((_, i) => rowOk(i)).length;
  const set = (i: number, patch: Partial<{ word: string; first: string; last: string }>) => {
    setChecked(false);
    setAnswers((a) => ({ ...a, [i]: { ...get(i), ...patch } }));
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">4 · Voiced or unvoiced? · 8 minutes</h2>
          <p className="text-xs text-muted">
            A finger on your throat. Write the word from the script, then say whether its first and last sounds are
            voiced.
          </p>
        </div>
        {checked ? <Score right={right} total={VOICING.length} /> : null}
      </div>
      <div className="flex flex-col gap-2">
        {VOICING.map((row, i) => {
          const a = get(i);
          return (
            <div key={row.ipa} className={`flex flex-wrap items-center gap-2 rounded-[8px] border px-3 py-2 ${markClass(checked, rowOk(i))}`}>
              <span className="w-20 font-serif text-[15px] text-ink">{row.ipa}</span>
              <PlayButton onClick={() => say(row.word)} label={`Play ${row.word}`} />
              <input
                value={a.word}
                onChange={(e) => set(i, { word: e.target.value })}
                placeholder="spelling"
                className="w-28 rounded-[6px] border border-border bg-card px-2 py-1 text-[12.5px] text-ink outline-none focus:border-primary"
              />
              {(["first", "last"] as const).map((which) => (
                <span key={which} className="flex items-center gap-1">
                  <span className="text-[10.5px] text-muted">{which}</span>
                  {(["v", "u"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set(i, { [which]: v })}
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        a[which] === v ? "bg-primary text-primary-foreground" : "border border-border text-muted"
                      }`}
                    >
                      {v === "v" ? "voiced" : "unvoiced"}
                    </button>
                  ))}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => setChecked(true)} className="self-start rounded-full bg-primary px-4 py-1.5 text-[11.5px] font-semibold text-primary-foreground">
        Check
      </button>
    </section>
  );
}

function ChartBlock({ title, cells, columns, say }: { title: string; cells: Cell[]; columns: number; say: (t: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{title}</p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {cells.map((cell, i) =>
          cell === null ? (
            <span key={i} aria-hidden />
          ) : (
            <button
              key={cell[0]}
              type="button"
              onClick={() => {
                say(cell[0]);
                setTimeout(() => say(cell[1]), 900);
              }}
              className="flex flex-col items-center gap-0.5 rounded-[6px] border-2 bg-card px-1 py-1.5"
              style={{ borderColor: cell[2] }}
            >
              <span className="font-serif text-[15px] leading-none text-ink">{cell[0]}</span>
              <span className="text-[9.5px] text-muted">{cell[1]}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Chart({ say }: { say: (t: string) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-lg font-semibold text-ink">5 · The phonemic chart, spoken · 7 minutes</h2>
        <p className="text-xs text-muted">
          Forty-four phonemes. Click any cell for the sound, then the word. The chart is arranged by where the sound is
          made, not by the alphabet.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {[
          ["Long vowels", TEAL],
          ["Short vowels", GOLD],
          ["Diphthongs", RED],
          ["Voiced consonants", WARM],
          ["Unvoiced consonants", MUTED],
        ].map(([label, hue]) => (
          <span key={label} className="flex items-center gap-1.5 text-[10.5px] text-muted">
            <span className="size-2 rounded-[2px]" style={{ background: hue }} />
            {label}
          </span>
        ))}
      </div>
      <ChartBlock title="Vowels" cells={VOWELS} columns={4} say={say} />
      <ChartBlock title="Diphthongs" cells={DIPHTHONGS} columns={3} say={say} />
      <ChartBlock title="Consonants" cells={CONSONANTS} columns={8} say={say} />
    </section>
  );
}

function ScriptWriting() {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [active, setActive] = useState(0);
  const ok = (i: number) => normaliseIPA(answers[i] ?? "") === SCRIPT[i].answer;
  const right = SCRIPT.filter((_, i) => ok(i)).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">6 · Write it in phonemic script · 10 minutes</h2>
          <p className="text-xs text-muted">
            Nobody memorises symbols today — look them up on the chart above. Click a box, then tap the keys.
          </p>
        </div>
        {checked ? <Score right={right} total={SCRIPT.length} /> : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {KEYS.map((k, i) =>
          k === "|" ? (
            <span key={`sep-${i}`} className="mx-1 w-px self-stretch bg-border" />
          ) : (
            <button
              key={k}
              type="button"
              onClick={() => {
                setChecked(false);
                setAnswers((a) => ({ ...a, [active]: (a[active] ?? "") + k }));
              }}
              className="min-w-7 rounded-[5px] border border-border bg-card px-1.5 py-1 font-serif text-[13px] text-ink hover:border-primary"
            >
              {k}
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SCRIPT.map((row, i) => (
          <div key={row.word} className={`flex items-center gap-2 rounded-[8px] border px-3 py-2 ${markClass(checked, ok(i))}`}>
            <span className="w-20 text-[12.5px] text-ink">{row.word}</span>
            <span className="text-muted">/</span>
            <input
              value={answers[i] ?? ""}
              onFocus={() => setActive(i)}
              onChange={(e) => {
                setChecked(false);
                setAnswers((a) => ({ ...a, [i]: e.target.value }));
              }}
              className={`min-w-0 flex-1 rounded-[6px] border bg-card px-2 py-1 font-serif text-[13px] text-ink outline-none ${
                active === i ? "border-primary" : "border-border"
              }`}
            />
            <span className="text-muted">/</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setChecked(true)} className="rounded-full bg-primary px-4 py-1.5 text-[11.5px] font-semibold text-primary-foreground">
          Check
        </button>
      </div>
      <RevealCard
        question="Reveal the answers"
        answer={SCRIPT.map((s) => `${s.word} /${s.answer}/`).join("  ·  ")}
      />
    </section>
  );
}

function FilmRace() {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const ok = (i: number) =>
    (answers[i] ?? "")
      .trim()
      .toLowerCase()
      .replace(/^the\s+/, "") === FILMS[i].answer.replace(/^the\s+/, "");
  const right = FILMS.filter((_, i) => ok(i)).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-lg font-semibold text-ink">7 · Film titles · 10 minutes</h2>
          <p className="text-xs text-muted">In pairs, against the clock. First to eight. A leading “the” doesn’t matter.</p>
        </div>
        {checked ? <Score right={right} total={FILMS.length} /> : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FILMS.map((f, i) => (
          <div key={f.ipa} className={`flex items-center gap-2 rounded-[8px] border px-3 py-2 ${markClass(checked, ok(i))}`}>
            <span className="w-40 font-serif text-[14px] text-ink">{f.ipa}</span>
            <input
              value={answers[i] ?? ""}
              onChange={(e) => {
                setChecked(false);
                setAnswers((a) => ({ ...a, [i]: e.target.value }));
              }}
              className="min-w-0 flex-1 rounded-[6px] border border-border bg-card px-2 py-1 text-[12.5px] text-ink outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setChecked(true)} className="rounded-full bg-primary px-4 py-1.5 text-[11.5px] font-semibold text-primary-foreground">
          Check
        </button>
      </div>
      <RevealCard question="Reveal the titles" answer={FILMS.map((f) => `${f.ipa} — ${f.answer}`).join("  ·  ")} />
      <p className="text-[12.5px] leading-relaxed text-ink">
        To close: which two sounds from today are most likely to trouble your own TP group, and why?
      </p>
    </section>
  );
}

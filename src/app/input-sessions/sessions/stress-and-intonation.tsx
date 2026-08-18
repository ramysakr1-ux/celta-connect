"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { VoicePicker } from "@/components/input-sessions/voice-picker";

const VOICE_PREFS = [
  (v: SpeechSynthesisVoice) => /Google UK English Female/i.test(v.name),
  (v: SpeechSynthesisVoice) => /Google UK English Male/i.test(v.name),
  (v: SpeechSynthesisVoice) => /Google US English/i.test(v.name),
];

function pickVoice(voiceIdx: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const all = window.speechSynthesis.getVoices();
  let voice = VOICE_PREFS[voiceIdx] ? all.find(VOICE_PREFS[voiceIdx]) : undefined;
  if (!voice) voice = all.find((v) => /en-GB/i.test(v.lang)) || all.find((v) => /en/i.test(v.lang));
  return voice;
}

function speakSyllablesAt(syllables: string[], stressedIdx: number, voiceIdx: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voice = pickVoice(voiceIdx);
  window.speechSynthesis.cancel();
  syllables.forEach((syl, i) => {
    const isStressed = i === stressedIdx;
    const u = new SpeechSynthesisUtterance(syl);
    if (voice) u.voice = voice;
    u.rate = isStressed ? 0.85 : 1.0;
    u.pitch = isStressed ? 1.1 : 0.95;
    u.volume = isStressed ? 1 : 0.85;
    window.speechSynthesis.speak(u);
  });
}

function speakWord(text: string, voiceIdx: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voice = pickVoice(voiceIdx);
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 0.92;
  window.speechSynthesis.speak(u);
}

function speakIntonation(text: string, rising: boolean) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const words = text.replace(/[?.]/g, "").split(" ");
  const all = window.speechSynthesis.getVoices();
  const voice = all.find((v) => /en-GB/i.test(v.lang)) || all[0];
  window.speechSynthesis.cancel();
  words.forEach((w, i2) => {
    const frac = words.length > 1 ? i2 / (words.length - 1) : 1;
    const u = new SpeechSynthesisUtterance(w);
    if (voice) u.voice = voice;
    u.pitch = rising ? 0.95 + frac * 0.55 : 1.35 - frac * 0.55;
    window.speechSynthesis.speak(u);
  });
}

const INTONATION = [
  { text: "You're coming?", rising: true, answer: "Question — rising tune, checking" },
  { text: "You're coming.", rising: false, answer: "Statement — falling tune, telling" },
  { text: "Coffee or tea?", rising: false, answer: "Choice question — rise on the first option, fall on the last" },
];

const DOUBLE_STRESS_WORDS = [
  { word: "information", syllables: ["in", "for", "ma", "tion"], levels: [1, 0, 2, 0] },
  { word: "understand", syllables: ["un", "der", "stand"], levels: [1, 0, 2] },
  { word: "afternoon", syllables: ["af", "ter", "noon"], levels: [1, 0, 2] },
  { word: "engineer", syllables: ["en", "gi", "neer"], levels: [1, 0, 2] },
  { word: "conversation", syllables: ["con", "ver", "sa", "tion"], levels: [1, 0, 2, 0] },
  { word: "university", syllables: ["u", "ni", "ver", "si", "ty"], levels: [1, 0, 2, 0, 0] },
];

const MARKING_WORDS = [
  { syllables: ["pho", "to", "graph"], stressed: 0 },
  { syllables: ["pho", "to", "gra", "phy"], stressed: 2 },
  { syllables: ["pho", "to", "gra", "phic"], stressed: 2 },
  { syllables: ["con", "sid", "er"], stressed: 1 },
];

const CONTRASTIVE = [
  { context: 'A: "Did Sara take my charger?"', reply: "I didn't take your charger.", explains: { 0: 'Stress on "I" — someone else did, not me.', 2: 'Stress on "your" — I took a charger, just not yours.', 4: 'Stress on "charger" — I took something of yours, but not that.' } as Record<number, string> },
  { context: 'A: "You said you\'d finish the report today."', reply: "I said I'd try to finish it today.", explains: { 4: 'Stress on "try" — pushing back on the accusation of a broken promise; "try" was the actual claim.', 6: 'Stress on "today" — conceding the deadline was today, defending only the effort.' } as Record<number, string> },
  { context: 'A: "This isn\'t the shirt I ordered."', reply: "That's the shirt we sent.", explains: { 1: "Stress on \"that's\" — flat correction, almost defensive.", 3: 'Stress on "we" — shifting blame toward the warehouse, away from the speaker.', 4: "Stress on \"sent\" — emphasising the order was fulfilled correctly on their end." } as Record<number, string> },
];

const TRAINER_SCRIPT = [
  { time: "0–8", step: "Intonation, minimal context", note: "Play each line without telling them whether it's a question or statement. The words are identical in two of the three — make the point that punctuation on a page can't carry this, only the ear can." },
  { time: "8–20", step: "Marking convention for LRT", note: "This is a direct LRT skill: showing you can locate and mark word stress is part of the language analysis section. Have trainees mark all four words on paper first, then check against the interactive version." },
  { time: "20–30", step: "Primary and secondary stress", note: "Word stress in longer words, same clap/circle logic as marking — keep it brisk, most trainees pick up the pattern fast." },
  { time: "30–40", step: "Connect to FOL", note: 'Ask: "In your FOL recording, did your learner stress any word wrongly, or use a flat/wrong-direction intonation anywhere?" This is the moment to point trainees back to their own recording with new ears.' },
  { time: "—", step: "Delivery", note: "For face-to-face, everything above works live off a laptop and projector — no student devices needed. For real spoken intonation beyond synthesised speech, the BBC's Learning English pronunciation series (bbc.co.uk/learningenglish/english/features/pronunciation) has short free videos worth linking to." },
  { time: "—", step: "Contrastive stress extension", note: "TTS can't fake this convincingly — once trainees have picked and read the explanation, say the line aloud yourself with the stress they chose." },
  { time: "40–45", step: "Close", note: "One-sentence transfer: which of today's two features — stress or intonation — is most likely to trip up their own TP group, based on L1." },
];

function IntonationSection({ voiceIdx }: { voiceIdx: number }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink">Intonation — question or statement?</p>
      <p className="text-[11.5px] text-muted">
        The words don&apos;t change, only the tune does. &quot;You&apos;re coming.&quot; falling means a statement;
        rising means a question — click each line to hear the tune, then guess before revealing.
      </p>
      {INTONATION.map((it, i) => (
        <div key={it.text} className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
          <button
            type="button"
            data-print-hide
            onClick={() => speakIntonation(it.text, it.rising)}
            className="flex size-8 flex-none items-center justify-center rounded-full bg-primary text-white"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <p className="flex-1 text-[13px] text-ink">&quot;{it.text}&quot;</p>
          {revealed[i] ? (
            <p className={`text-[11.5px] font-semibold ${it.rising ? "text-primary" : "text-gold"}`}>{it.answer}</p>
          ) : (
            <button type="button" data-print-hide onClick={() => setRevealed((r) => ({ ...r, [i]: true }))} className="text-[11px] font-semibold text-primary">
              Reveal
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MarkingStress({ voiceIdx }: { voiceIdx: number }) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink">Marking stress for LRT</p>
      <p className="text-[11.5px] text-muted">
        The convention: a bold syllable, or a small mark before it — <strong className="font-semibold">re</strong>
        cord vs re<strong className="font-semibold">cord</strong>. Click a word to hear it, then click the syllable
        you think carries the stress.
      </p>
      {MARKING_WORDS.map((w, wi) => {
        const picked = picks[wi];
        return (
          <div key={w.syllables.join("")} className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
            <button
              type="button"
              data-print-hide
              onClick={() => speakSyllablesAt(w.syllables, w.stressed, voiceIdx)}
              className="flex size-8 flex-none items-center justify-center rounded-full bg-gold text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <div className="flex flex-1 gap-1">
              {w.syllables.map((s, si) => {
                const isStressed = si === w.stressed;
                const isPicked = picked === si;
                const show = picked !== undefined;
                return (
                  <button
                    key={si}
                    type="button"
                    onClick={() => {
                      if (show) return;
                      setPicks((p) => ({ ...p, [wi]: si }));
                    }}
                    className={`rounded-[6px] border-[1.5px] px-3 py-1.5 font-serif text-sm ${isStressed ? "font-bold" : "font-normal"} ${
                      show && isStressed
                        ? "border-status-on-track-text bg-status-on-track-bg text-status-on-track-text"
                        : show && isPicked
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border bg-card text-ink"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <p className={`w-16 flex-none text-right text-[11px] font-semibold ${picked === w.stressed ? "text-status-on-track-text" : "text-destructive"}`}>
              {picked !== undefined ? (picked === w.stressed ? "Correct" : "Try again") : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const SIZE = [14, 22, 32];

function DoubleStress({ voiceIdx }: { voiceIdx: number }) {
  const [picks, setPicks] = useState<Record<number, number[]>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink">Primary and secondary stress</p>
      <p className="text-[11.5px] text-muted">
        Longer words often carry two stresses, not one — a strong primary stress and a weaker secondary stress. Click
        the speaker to hear the word said naturally (the synthesised voice can&apos;t fake syllable-level stress
        convincingly — listen for it yourself, or say the word aloud). Click each circle once for secondary stress,
        twice for primary.
      </p>
      {DOUBLE_STRESS_WORDS.map((w, wi) => {
        const cur = picks[wi] || w.syllables.map(() => 0);
        const isRevealed = !!revealed[wi];
        const shown = isRevealed ? w.levels : cur;
        const done = cur.every((p, i) => p === w.levels[i]) && cur.some((p) => p > 0);
        return (
          <div key={w.word} className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card p-3.5">
            <button
              type="button"
              data-print-hide
              onClick={() => speakWord(w.word, voiceIdx)}
              className="flex size-8 flex-none items-center justify-center rounded-full bg-primary text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <p className="w-[130px] flex-none font-serif text-sm font-semibold text-ink">{w.word}</p>
            <div className="flex flex-1 items-end gap-2">
              {w.syllables.map((_, si) => (
                <button
                  key={si}
                  type="button"
                  disabled={isRevealed}
                  onClick={() => {
                    setPicks((p) => {
                      const next = [...(p[wi] || w.syllables.map(() => 0))];
                      next[si] = (next[si] + 1) % 3;
                      return { ...p, [wi]: next };
                    });
                  }}
                  className={`rounded-full border-[1.5px] ${done ? "border-status-on-track-text bg-status-on-track-bg" : isRevealed ? "border-gold bg-gold/15" : "border-border bg-card"}`}
                  style={{ width: SIZE[shown[si]], height: SIZE[shown[si]] }}
                />
              ))}
            </div>
            <button
              type="button"
              data-print-hide
              onClick={() => {
                if (done) return;
                setRevealed((r) => ({ ...r, [wi]: !r[wi] }));
              }}
              className={`w-16 flex-none text-right text-[11px] font-semibold ${done ? "text-status-on-track-text" : isRevealed ? "text-muted" : "text-primary"}`}
            >
              {done ? "Correct" : isRevealed ? "Hide" : "Reveal"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ContrastiveStress() {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink">Extension, if there&apos;s time — stress carries attitude</p>
      <p className="text-[11.5px] text-muted">Same sentence, same words — the stressed word changes what&apos;s actually meant. Read the context, then click the word you&apos;d stress in the reply.</p>
      {CONTRASTIVE.map((c, ci) => {
        const words = c.reply.split(" ");
        const pick = picks[ci];
        const isRevealed = !!revealed[ci];
        return (
          <div key={c.context} className="flex flex-col gap-2.5 rounded-[8px] border border-border bg-card p-4">
            <p className="text-xs italic text-muted">{c.context}</p>
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {words.map((w, wi) => (
                  <button
                    key={wi}
                    type="button"
                    onClick={() => setPicks((p) => ({ ...p, [ci]: wi }))}
                    className={`rounded-[4px] px-1.5 py-0.5 text-sm ${pick === wi ? "bg-primary/10 font-extrabold text-primary" : "font-medium text-ink"}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-print-hide
                onClick={() => setRevealed((r) => ({ ...r, [ci]: !r[ci] }))}
                className="w-16 flex-none text-right text-[11px] font-semibold text-primary"
              >
                {isRevealed ? "Hide" : "Reveal"}
              </button>
            </div>
            {isRevealed && pick !== undefined ? (
              <p className="border-t border-border pt-2 text-[11.5px] text-ink">
                {c.explains[pick] || "Try one of the words with an explanation below — not every word carries a distinct attitude here."}
              </p>
            ) : null}
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
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-gold/45 bg-gold/10 px-4 text-xs font-semibold text-gold"
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

export default function StressAndIntonationSession() {
  const [voiceIdx, setVoiceIdx] = useState(0);

  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · 45 minutes · phonology, spoken aloud"
      title="Stress and intonation."
      intro="Word stress and sentence tune, both spoken aloud, both worth a mark on FOL and LRT. Click any word or line to hear it."
      agenda={[
        { time: "0–8", spine: "var(--color-primary)", title: "Intonation: question or statement" },
        { time: "8–20", spine: "var(--color-gold)", title: "Marking stress for LRT" },
        { time: "20–30", spine: "var(--color-primary)", title: "Primary and secondary stress" },
        { time: "30–40", spine: "var(--color-destructive)", title: "Connect to FOL" },
        { time: "40–45", spine: "var(--color-status-on-track-text)", title: "Close" },
      ]}
    >
      <div className="flex flex-col gap-1.5 rounded-[8px] border border-primary/25 bg-primary/5 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
          <span className="size-1.5 rounded-full bg-current" />
          Where this feeds back in
        </p>
        <p className="text-[12.5px] leading-relaxed text-ink">
          FOL asks you to record and analyse a learner&apos;s pronunciation errors — stress and intonation are two of
          the categories you&apos;ll be sorting those errors into. LRT asks you to analyse language for teaching,
          including its phonological features — the word-stress marking convention practised here is the one your
          LRT write-up should use.
        </p>
      </div>

      <VoicePicker voiceIdx={voiceIdx} setVoiceIdx={setVoiceIdx} />

      <IntonationSection voiceIdx={voiceIdx} />

      <MarkingStress voiceIdx={voiceIdx} />

      <DoubleStress voiceIdx={voiceIdx} />

      <ContrastiveStress />

      <TrainerScript />
    </SessionShell>
  );
}

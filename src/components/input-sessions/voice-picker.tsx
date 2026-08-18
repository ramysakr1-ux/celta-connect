"use client";

import { useEffect, useState } from "react";

// Shared across the phonology sessions (Connected Speech, Sounds, Stress and
// Intonation) -- every clip is browser Web Speech API, not a real audio
// file, so trainees get to pick which built-in voice reads it.
export function speakWithVoice(text: string, rate: number, voiceIdx: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const all = window.speechSynthesis.getVoices();
  const prefs = [
    (v: SpeechSynthesisVoice) => /Google UK English Female/i.test(v.name),
    (v: SpeechSynthesisVoice) => /Google UK English Male/i.test(v.name),
    (v: SpeechSynthesisVoice) => /Google US English/i.test(v.name),
  ];
  let chosen = prefs[voiceIdx] ? all.find(prefs[voiceIdx]) : undefined;
  if (!chosen) chosen = all.find((v) => /en-GB/i.test(v.lang)) || all.find((v) => /en/i.test(v.lang));
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (chosen) u.voice = chosen;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

export function VoicePicker({ voiceIdx, setVoiceIdx }: { voiceIdx: number; setVoiceIdx: (i: number) => void }) {
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      if (window.speechSynthesis.getVoices().filter((v) => /en/i.test(v.lang)).length) setVoicesLoaded(true);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  return (
    <div className="flex flex-col gap-2.5 rounded-[8px] border border-primary/25 bg-primary/5 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
        <span className="size-1.5 rounded-full bg-current" />
        Voice
      </p>
      <p className="text-[12.5px] leading-relaxed text-ink">
        {voicesLoaded ? "Using your browser's built-in speech — in Chrome this is Google's natural voices." : "Loading voices… works best in Chrome."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {["British — female", "British — male", "American"].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setVoiceIdx(i)}
            className={`rounded-full border-[1.5px] px-3 py-1.5 text-[11.5px] font-semibold ${
              voiceIdx === i ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

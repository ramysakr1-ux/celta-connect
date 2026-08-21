"use client";

import { useState } from "react";

// Enrolment Forms.dc.html 1a -- Cambridge's "Disclaimer for AI Use" (May
// 2024), verbatim. Only the tick-per-section is Connect's own addition, so
// acceptance is recorded per clause rather than as one blanket signature.
const SECTIONS = [
  {
    letter: "A",
    lead: "I understand that, on the CELTA course, I can use AI for the following purposes.",
    items: [
      "to generate ideas for teaching practice including texts, activities, etc.,",
      "to carry out initial research for written assignments, including generating a bibliography,",
      "to proofread work.",
    ],
    tick: "I understand what I may use AI for",
  },
  {
    letter: "B",
    lead: "I understand that I need to reference use of generative AI in my work and I have been informed how to do so.",
    items: ["In-text citation stating the prompt, the quoted text, the tool and the date — plus a reference list entry. APA is recommended."],
    tick: "I have been shown how to reference AI use",
  },
  {
    letter: "C",
    lead: "I understand that the following will be treated as an attempt at malpractice and will result in failing the work:",
    items: [
      "Generating a lesson plan, language analysis, or a written assignment using AI,",
      "Using AI for purposes other than the ones mentioned in section A above or in “Candidate declaration” sections in each written assignment.",
      "Failing to acknowledge use of AI, regardless of the scope and the purpose of use.",
    ],
    tick: "I understand what counts as malpractice",
  },
] as const;

export function AiDisclaimerFields({ fullName = "" }: { fullName?: string }) {
  const [ticked, setTicked] = useState<boolean[]>([false, false, false]);
  const [signedName, setSignedName] = useState(fullName);
  const allTicked = ticked.every(Boolean);
  const signed = allTicked && signedName.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Cambridge English Teaching Qualifications</p>
        <p className="text-lg font-serif text-ink">Disclaimer for AI use</p>
      </div>

      {SECTIONS.map((s, i) => (
        <div key={s.letter} className={`flex flex-col gap-2.5 rounded-[6px] border p-3.5 ${s.letter === "C" ? "border-status-warning-text bg-status-warning-bg" : "border-primary/20 bg-primary/5"}`}>
          <div className="flex items-start gap-2.5">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold text-primary-foreground ${s.letter === "C" ? "bg-status-warning-text" : "bg-primary"}`}
            >
              {s.letter}
            </span>
            <p className="text-sm font-semibold text-ink">{s.lead}</p>
          </div>
          <ul className="flex flex-col gap-1.5 pl-[30px]">
            {s.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2 text-xs text-ink">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                {item}
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 pl-[30px] text-xs font-semibold text-ink">
            <input
              type="checkbox"
              checked={ticked[i]}
              onChange={(e) => setTicked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
              required
            />
            {s.tick}
          </label>
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ai_disclaimer_signed_name" className="text-xs text-muted">
          Type your full name to sign
        </label>
        <input
          id="ai_disclaimer_signed_name"
          name="ai_disclaimer_signed_name"
          type="text"
          required
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          className="h-11 rounded-[6px] border border-input bg-card px-3 font-serif text-base text-ink outline-none focus:border-primary"
        />
        <p className="text-[11px] text-muted">Name, date and time are recorded. A copy is filed in your portfolio.</p>
      </div>

      <input type="hidden" name="ai_disclaimer_ticked" value={allTicked ? "1" : ""} />
      {!signed ? <p className="text-xs text-muted">Tick all three sections and type your name to sign the disclaimer.</p> : null}
    </div>
  );
}

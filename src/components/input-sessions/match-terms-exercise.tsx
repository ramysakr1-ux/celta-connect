"use client";

import { useState } from "react";

export interface MatchTerm {
  term: string;
  definition: string;
}

// "Stage 1 · Match each term to its meaning" -- click a term on the left,
// then its definition on the right (either order). Auto-checks on the
// second click: matched pairs lock teal, a wrong pair briefly shakes red
// then clears both selections. Right column order is reversed (not
// randomized -- matches every source .dc.html's own `reverse()`, and
// keeps this deterministic so server and client render the same order).
export function MatchTermsExercise({ terms }: { terms: MatchTerm[] }) {
  const rightOrder = terms.map((_, i) => i).reverse();
  const [selLeft, setSelLeft] = useState<number | null>(null);
  const [selRight, setSelRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [shake, setShake] = useState<number[]>([]);

  function tryMatch(left: number | null, right: number | null) {
    if (left === null || right === null) return;
    if (left === right) {
      setMatched((m) => new Set(m).add(left));
      setSelLeft(null);
      setSelRight(null);
    } else {
      setShake([left, right]);
      setTimeout(() => {
        setSelLeft(null);
        setSelRight(null);
        setShake([]);
      }, 400);
    }
  }

  function pickLeft(i: number) {
    if (matched.has(i)) return;
    setSelLeft(i);
    tryMatch(i, selRight);
  }
  function pickRight(i: number) {
    if (matched.has(i)) return;
    setSelRight(i);
    tryMatch(selLeft, i);
  }

  function styleFor(id: number, sel: number | null) {
    const isMatched = matched.has(id);
    const isSel = sel === id;
    const isShake = shake.includes(id);
    if (isMatched) return "border-2 border-primary bg-primary/10 text-primary cursor-default";
    if (isSel) return "border-2 border-primary bg-primary/10 text-ink cursor-pointer";
    if (isShake) return "border-2 border-destructive bg-card text-ink cursor-pointer";
    return "border border-border bg-card text-ink cursor-pointer";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-ink">Match each term to its meaning</p>
        <p className="text-[11.5px] text-muted">
          {matched.size} of {terms.length} matched
        </p>
      </div>
      <div className="flex gap-4 rounded-[8px] border border-border bg-card p-4">
        <div className="flex flex-1 flex-col gap-2">
          {terms.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pickLeft(i)}
              className={`flex min-h-[38px] items-center rounded-[6px] px-3 font-serif text-sm font-semibold ${styleFor(i, selLeft)}`}
            >
              {t.term}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {rightOrder.map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => pickRight(idx)}
              className={`flex min-h-[38px] items-center rounded-[6px] px-3 text-left text-[11px] leading-snug ${styleFor(idx, selRight)}`}
            >
              {terms[idx].definition}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

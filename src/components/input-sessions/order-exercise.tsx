"use client";

import { useState } from "react";

// "Debrief — put the stages back in order." Shown shuffled; clicking the
// correct next stage locks it in place (numbered, teal); clicking any
// other stage is a silent no-op -- no penalty, just doesn't advance,
// matching the source's own "no wrong answer" framing for this exercise.
export function OrderExercise({ correctOrder, shuffled }: { correctOrder: string[]; shuffled: string[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const done = picked.length === correctOrder.length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <p className="font-serif text-lg font-semibold text-ink">Debrief — put the stages back in order</p>
        <p className="text-xs text-muted">
          Click each stage in the order you just experienced it. This is a <strong className="text-ink">loop input</strong> — the
          session modelled the framework instead of only describing it.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {shuffled.map((label) => {
          const idx = picked.indexOf(label);
          const isDone = idx !== -1;
          const isCorrectNext = correctOrder[picked.length] === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (!isDone && isCorrectNext) setPicked((p) => [...p, label]);
              }}
              className={`flex items-center gap-3 rounded-[7px] border-2 px-3.5 py-2.5 text-left ${
                isDone ? "border-primary bg-primary/10 cursor-default" : "border-border bg-card cursor-pointer"
              }`}
            >
              <span
                className={`flex size-5 flex-none items-center justify-center rounded-full text-[10.5px] font-bold ${
                  isDone ? "bg-primary text-white" : "bg-accent text-muted"
                }`}
              >
                {isDone ? idx + 1 : "?"}
              </span>
              <span className="text-[12.5px] font-semibold text-ink">{label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted">
        {done ? `All ${correctOrder.length} in order — that's the staging.` : `${picked.length} of ${correctOrder.length} placed — click the one that comes next.`}
      </p>
    </div>
  );
}

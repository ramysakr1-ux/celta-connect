"use client";

import { useState } from "react";

export interface ChoiceScenario {
  text: string;
  choices: string[];
  correctIndex: number;
  feedback: string;
}

// "Spot the barrier" / "Match the drill to the problem" / "Sort the
// activity by stage" -- one real scenario, a row of labeled choice
// buttons, and feedback once picked. Answer locks in on first pick (no
// retry) -- matches every source file's own behavior, where a wrong pick
// just shows the correct answer rather than letting the trainee retry.
export function ChoiceScenarioCard({ scenario }: { scenario: ChoiceScenario }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const correct = picked === scenario.correctIndex;

  return (
    <div
      className={`flex flex-col gap-2 rounded-[8px] border p-3.5 ${
        !answered ? "border-border bg-card" : correct ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <p className="text-[12.5px] leading-relaxed text-ink">{scenario.text}</p>
      {!answered ? (
        <div className="flex flex-wrap gap-2">
          {scenario.choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPicked(i)}
              className="flex h-7 items-center rounded-full border border-border px-3.5 text-[11px] font-semibold text-ink hover:border-primary"
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <p className={`text-[11.5px] leading-relaxed ${correct ? "text-primary" : "text-destructive"}`}>
          {correct ? "✓ " : "✗ "}
          {scenario.feedback}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { getOrCreateAssessorToken } from "@/app/trainer/assessor-actions";

export function AssessorLinkButton() {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error" | "not_ready">("idle");
  const [issues, setIssues] = useState<string[]>([]);

  async function handleClick() {
    setState("loading");
    const { token, error, readinessIssues } = await getOrCreateAssessorToken();
    if (readinessIssues && readinessIssues.length > 0) {
      setIssues(readinessIssues);
      setState("not_ready");
      return;
    }
    if (error || !token) {
      setState("error");
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/assessor/${token}`);
    setState("copied");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {state === "loading"
          ? "Checking readiness…"
          : state === "copied"
            ? "Copied!"
            : state === "error"
              ? "Try again"
              : state === "not_ready"
                ? "Not ready yet"
                : "Share assessor link"}
      </button>
      {state === "not_ready" ? (
        <div className="absolute right-0 top-full z-10 mt-1.5 w-72 rounded-[6px] border border-border bg-card p-3 text-xs shadow-sm">
          <p className="font-semibold text-ink">Portfolios aren&apos;t complete yet:</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-muted">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setState("idle")} className="mt-2 text-primary hover:underline">
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

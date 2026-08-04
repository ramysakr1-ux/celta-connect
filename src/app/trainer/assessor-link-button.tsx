"use client";

import { useState } from "react";
import { getOrCreateAssessorToken } from "@/app/trainer/assessor-actions";

export function AssessorLinkButton() {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function handleClick() {
    setState("loading");
    const { token, error } = await getOrCreateAssessorToken();
    if (error || !token) {
      setState("error");
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/assessor/${token}`);
    setState("copied");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary disabled:opacity-60"
    >
      {state === "loading" ? "Getting link…" : state === "copied" ? "Copied!" : state === "error" ? "Try again" : "Share assessor link"}
    </button>
  );
}

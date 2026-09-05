"use client";

import { HUB_BUTTON } from "@/app/trainer/(hub)/page-head";

import { useState } from "react";
import { getOrCreateRegisterViewToken } from "@/app/trainer/(hub)/volunteers/actions";

export function RegisterLinkButton({ small = false }: { small?: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setMessage(null);
    const { token, error } = await getOrCreateRegisterViewToken();
    if (error || !token) {
      setState("error");
      setMessage(error ?? "Could not create the link.");
      // The message clears itself -- it shouldn't sit there forever.
      setTimeout(() => {
        setMessage(null);
        setState("idle");
      }, 6000);
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/register/${token}`);
    setState("copied");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    // The message floats below the button (absolute) so it never changes
    // the button's own height -- a growing box re-centred the whole
    // actions row and knocked its neighbours out of line (Ramy, 5 Sep
    // 2026: "the filming consent form doesn't go back where it is").
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        title="Copies a link to the register for someone without a Connect account -- reception can see attendance and add walk-ins, nothing else"
        className={small ? "trainer-hover-fill inline-flex h-[34px] items-center gap-2 rounded-[6px] border border-border bg-card px-3 text-[12px] font-semibold whitespace-nowrap text-ink disabled:opacity-60" : `${HUB_BUTTON} disabled:opacity-60`}
      >
        {/* The design's little chain glyph -- the button hands over a link. */}
        {small ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
          </svg>
        ) : null}
        {state === "loading" ? "Getting link…" : state === "copied" ? "Link copied" : "Front-desk link"}
      </button>
      {message ? <p className="absolute top-full right-0 z-10 mt-1 w-max max-w-[280px] rounded-[6px] bg-card px-2 py-1 text-right text-[11px] text-destructive shadow-sm">{message}</p> : null}
    </div>
  );
}

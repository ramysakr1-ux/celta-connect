"use client";

import { HUB_BUTTON } from "@/app/trainer/(hub)/page-head";

import { useState } from "react";
import { getOrCreateRegisterViewToken } from "@/app/trainer/(hub)/volunteers/actions";

export function RegisterLinkButton() {
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
        title="Copies a read-only link to the attendance register for someone who is not a tutor -- centre staff, the assessor"
        className={`${HUB_BUTTON} disabled:opacity-60`}
      >
        {state === "loading" ? "Getting link…" : state === "copied" ? "Link copied" : "Share register view"}
      </button>
      {message ? <p className="absolute top-full right-0 z-10 mt-1 w-max max-w-[280px] rounded-[6px] bg-card px-2 py-1 text-right text-[11px] text-destructive shadow-sm">{message}</p> : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";

// design_handoff_trainee_lesson_plan §8: "all these textareas grow with
// content, no inner scrollbars, min-height: 1.5em. Re-measure on mount, after
// fonts load, and on every input."
//
// The plan reads as one document, so a field that scrolls inside itself breaks
// the illusion -- a procedure stage with six bullets has to show six bullets.

export function fitToContent(el: HTMLTextAreaElement | null | undefined): void {
  if (!el) return;
  el.style.height = "auto";
  // A field inside a closed details/hidden branch measures 0; leaving the
  // height at "auto" there is right, and forcing 1px would collapse it.
  if (el.scrollHeight === 0) return;
  el.style.height = `${el.scrollHeight + 1}px`;
}

/**
 * Ref callback for an autosizing textarea. Measures on mount, again once web
 * fonts have loaded (Newsreader and Karla both change the line count), and on
 * every input event.
 */
export function useAutosize() {
  const nodes = useRef(new Set<HTMLTextAreaElement>());

  useEffect(() => {
    const measureAll = () => nodes.current.forEach(fitToContent);
    measureAll();
    let cancelled = false;
    // document.fonts is absent in some embedded webviews.
    document.fonts?.ready.then(() => {
      if (!cancelled) measureAll();
    });
    window.addEventListener("resize", measureAll);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measureAll);
    };
  }, []);

  return useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    nodes.current.add(el);
    fitToContent(el);
  }, []);
}

/** Put on every autosizing textarea alongside the ref. */
export function autosizeOnInput(e: React.FormEvent<HTMLTextAreaElement>): void {
  fitToContent(e.currentTarget);
}

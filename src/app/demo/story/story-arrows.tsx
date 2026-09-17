"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The dashed hand-over arrows. Measured from the laid-out cards at runtime
// and drawn as one SVG overlay -- a card that hands work to another carries
// data-to="<that card's data-node>", and the line is routed from the card's
// right edge to the target's left, or, for two cards in the same column, down
// the left gutter so it never crosses a card in between. Ported line for
// line from the DC's Component (design_handoff_course_story, 17 Sep 2026).
export function StoryArrows({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<{ d: string; colour: string }[]>([]);
  const lastKey = useRef("");

  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const root = ref.current;
      if (!root) return;
      const rr = root.getBoundingClientRect();
      const first = root.querySelector<HTMLElement>("a[data-node]");
      // Nothing laid out yet -- try again, and never commit a zero measurement.
      if (rr.width === 0 || !first || first.getBoundingClientRect().width === 0) {
        if (tries++ < 40) timer = setTimeout(measure, 250);
        return;
      }
      const byId = new Map<string, HTMLElement>();
      root.querySelectorAll<HTMLElement>("a[data-node]").forEach((el) => {
        if (el.dataset.node) byId.set(el.dataset.node, el);
      });
      const next: { d: string; colour: string }[] = [];
      root.querySelectorAll<HTMLElement>("a[data-to]").forEach((el) => {
        const t = el.dataset.to ? byId.get(el.dataset.to) : undefined;
        if (!t) return;
        const a = el.getBoundingClientRect();
        const b = t.getBoundingClientRect();
        const sameCol = Math.abs(a.left - b.left) < 20;
        const up = b.top < a.top;
        const gx = a.left - 7 - rr.left;
        const x1 = sameCol ? a.left + 18 - rr.left : a.right - rr.left;
        const y1 = sameCol ? (up ? a.top : a.bottom) - rr.top : a.top + Math.min(22, a.height / 2) - rr.top;
        const x2 = sameCol ? b.left + 18 - rr.left : b.left - rr.left;
        const y2 = sameCol ? (up ? b.bottom : b.top) - rr.top : b.top + Math.min(22, b.height / 2) - rr.top;
        const adjacent = sameCol && Math.abs(y2 - y1) < 40;
        const d = sameCol
          ? adjacent
            ? `M${x1} ${y1} L${x2} ${y2}`
            : `M${x1} ${y1} C${gx} ${y1} ${gx} ${y2} ${x2} ${y2}`
          : `M${x1} ${y1} C${x1 + 28} ${y1} ${x2 - 28} ${y2} ${x2} ${y2}`;
        next.push({ d, colour: el.dataset.cyc || "oklch(51% 0.017 70)" });
      });
      const key = JSON.stringify(next);
      if (key !== lastKey.current) {
        lastKey.current = key;
        setArrows(next);
      }
    };
    const ro = new ResizeObserver(() => measure());
    if (ref.current) ro.observe(ref.current);
    ro.observe(document.body);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        maxWidth: 1240,
        width: "100%",
        margin: "0 auto",
        padding: "44px 40px 80px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 44,
      }}
    >
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1, overflow: "visible" }}>
        <defs>
          <marker id="cs-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        {arrows.map((a, i) => (
          <path key={i} d={a.d} fill="none" stroke={a.colour} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.85} markerEnd="url(#cs-arrow)" />
        ))}
      </svg>
      {children}
    </div>
  );
}

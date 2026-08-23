"use client";

import { useState, type ReactNode } from "react";

// for-claude-code-rotation-page-grouping.md: "a trainer visiting to do one
// specific thing... has to scroll past several unrelated compliance
// warnings and full team boards to get there." Compliance warnings stay
// outside this component entirely (always visible, per the spec -- they're
// safety-relevant, not content a trainer navigates away from); everything
// else lives behind one rail entry so the page loads to one section at a
// time. Board is the default landing section -- the TP group boards +
// running order is the thing a trainer actually opens this page to check
// day to day, per the spec's own hint that it's likely the most-visited.
const TABS = [
  { id: "board", label: "TP group boards" },
  { id: "peer-notes", label: "Peer observation notes" },
  { id: "one-to-one", label: "1-to-1 / small-group TP" },
  { id: "aim-constraints", label: "TP7/8 aim constraints" },
  { id: "coursebooks", label: "Coursebook schedule" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RotationTabs({
  board,
  peerNotes,
  oneToOne,
  aimConstraints,
  coursebooks,
}: {
  board: ReactNode;
  peerNotes: ReactNode;
  oneToOne: ReactNode;
  aimConstraints: ReactNode;
  coursebooks: ReactNode;
}) {
  const [active, setActive] = useState<TabId>("board");
  const content: Record<TabId, ReactNode> = {
    board,
    "peer-notes": peerNotes,
    "one-to-one": oneToOne,
    "aim-constraints": aimConstraints,
    coursebooks,
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`shrink-0 rounded-[6px] px-3 py-2 text-left text-sm font-medium transition-colors ${
              active === tab.id ? "bg-primary text-primary-foreground" : "text-muted hover:bg-accent/40 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-6">{content[active]}</div>
    </div>
  );
}

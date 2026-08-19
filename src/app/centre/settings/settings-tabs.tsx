"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const TABS = [
  { key: "profile", label: "Profile & Drive" },
  { key: "payments", label: "Payment providers" },
  { key: "people", label: "Admin roster" },
  { key: "support", label: "Support access" },
] as const;
type TabKey = (typeof TABS)[number]["key"] | "danger";

// for-claude-code-centre-settings.md: "State: one section key... controlling
// which tab's content renders, same tab-switch pattern as Centre Admin."
// Client-state tabs within this one page (unlike Centre Admin's own three
// top-level tabs, which are separate routes) -- matches the design file's
// own model exactly, and nothing here needs a shareable per-tab URL.
export function SettingsTabs({
  profile,
  payments,
  people,
  support,
  danger,
}: {
  profile: ReactNode;
  payments: ReactNode;
  people: ReactNode;
  support: ReactNode;
  danger: ReactNode | null;
}) {
  const [section, setSection] = useState<TabKey>("profile");
  const allTabs = danger ? [...TABS, { key: "danger" as const, label: "Danger zone" }] : TABS;

  const content =
    section === "profile" ? profile : section === "payments" ? payments : section === "people" ? people : section === "support" ? support : danger;

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-border pb-0.5">
        {allTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSection(tab.key)}
            className={`-mb-[3px] border-b-2 px-3 pb-2 text-sm font-medium ${
              section === tab.key
                ? tab.key === "danger"
                  ? "border-destructive text-destructive"
                  : "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="card p-6">{content}</div>
    </div>
  );
}

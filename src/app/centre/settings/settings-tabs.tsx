"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const TABS = [
  { key: "profile", label: "Profile & Drive" },
  { key: "payments", label: "Payment providers" },
  { key: "people", label: "Admin roster" },
  { key: "support", label: "Support access" },
  { key: "platform", label: "Connect access" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

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
  platform,
}: {
  profile: ReactNode;
  payments: ReactNode;
  people: ReactNode;
  support: ReactNode;
  platform: ReactNode;
}) {
  const [section, setSection] = useState<TabKey>("profile");
  // Danger zone moved to the centre owner's screen, 1 Sep 2026 -- it was the
  // one owner-only thing in a page everyone with a centre role can open.
  const allTabs = TABS;

  const content =
    section === "profile"
      ? profile
      : section === "payments"
        ? payments
        : section === "people"
          ? people
          : section === "support"
            ? support
            : platform;

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-border pb-0.5">
        {allTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSection(tab.key)}
            className={`admin-hover-fill -mb-[3px] border-b-2 px-3 pb-2 text-sm font-medium ${
              section === tab.key
                ? "border-primary text-primary"
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

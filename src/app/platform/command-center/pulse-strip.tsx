import type { PulseStripStats } from "@/app/platform/command-center/pulse-strip-data";

// Migrated onto the shared .card/.card-side-* design system 27 Aug 2026 --
// was hand-built inline styles (CARD/INK/MUTED/GOLD literals) copied
// straight from command-center-visual-reference.html, never wired to the
// shared tokens. These four tiles carry no status of their own (see
// src/app/platform/accounts/page.tsx's KPI row and src/app/centre/page.tsx's
// pilot for the same "small ones get a left-side bar" pattern), so the
// accent here is purely the decorative teal/garnet alternation, not a
// hardcoded single gold border.
export function PulseStrip({ stats }: { stats: PulseStripStats }) {
  const cards = [
    { label: "Centres live", value: stats.centresLive, sub: `${stats.centresRunningNow} running a course now` },
    { label: "Active trainees", value: stats.activeTraineesAccessible, sub: "across centres you have access to" },
    { label: "Courses running", value: stats.coursesRunningNow, sub: stats.courseRunningLabel },
    { label: "Open support threads", value: stats.openSupportThreads, sub: "" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((stat, i) => (
        <div key={stat.label} className={`card ${i % 2 === 0 ? "card-side-teal" : "card-side-garnet"} flex flex-col gap-1.5 px-[18px] py-4`}>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{stat.label}</div>
          <div className="font-serif text-[26px] font-semibold text-ink tabular-nums">{stat.value}</div>
          {stat.sub ? <div className="text-[11px] text-muted">{stat.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

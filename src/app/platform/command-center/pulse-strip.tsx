import type { PulseStripStats } from "@/app/platform/command-center/pulse-strip-data";

const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const CARD = "oklch(0.992 0.005 90)";
const GOLD = "oklch(0.62 0.14 68)";

export function PulseStrip({ stats }: { stats: PulseStripStats }) {
  const cards = [
    { label: "Centres live", value: stats.centresLive, sub: `${stats.centresRunningNow} running a course now` },
    { label: "Active trainees", value: stats.activeTraineesAccessible, sub: "across centres you have access to" },
    { label: "Courses running", value: stats.coursesRunningNow, sub: stats.courseRunningLabel },
    { label: "Open support threads", value: stats.openSupportThreads, sub: "" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {cards.map((stat) => (
        <div
          key={stat.label}
          style={{ background: CARD, borderRadius: 8, borderLeft: `3px solid ${GOLD}`, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 5, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px" }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{stat.label}</div>
          <div style={{ fontFamily: "Newsreader, serif", fontSize: 26, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
          {stat.sub ? <div style={{ fontSize: 11, color: MUTED }}>{stat.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

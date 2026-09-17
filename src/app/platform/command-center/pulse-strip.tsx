import type { PulseStripStats } from "@/app/platform/command-center/pulse-strip-data";

// Four platform-wide counters. Plain .card -- this shell carries no card
// edges (platform-room), and the numbers carry no status of their own; the
// old decorative teal/garnet alternation went with the centre-side A1 pass.
export function PulseStrip({ stats }: { stats: PulseStripStats }) {
  const cards = [
    { label: "Centres live", value: stats.centresLive, sub: `${stats.centresRunningNow} running a course now` },
    { label: "Active trainees", value: stats.activeTraineesAccessible, sub: "across centres you have access to" },
    { label: "Courses running", value: stats.coursesRunningNow, sub: stats.courseRunningLabel },
    { label: "Open support threads", value: stats.openSupportThreads, sub: "" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((stat) => (
        <div key={stat.label} className="card flex flex-col gap-1.5 px-[18px] py-4">
          <div className="text-micro font-bold uppercase tracking-[0.08em] text-muted">{stat.label}</div>
          <div className="font-serif text-h1 font-semibold text-ink tabular-nums">{stat.value}</div>
          {stat.sub ? <div className="text-label text-muted">{stat.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

import { DayBar } from "@/components/day-bar";
import type { TraineeDay } from "@/lib/trainee-day";

// The trainee's day bar: the shared DayBar on the dark header, in the lifted
// garnet that survives an ink-warm ground. Ramy, 10 Sep 2026, on the trainee
// having no role colour of their own -- garnet here is "where you are", not a
// role, which is why the trainer hub passes its own accent instead.
export function HeaderDayBar({
  day,
  serverNowMs,
  timeZone,
}: {
  day: TraineeDay;
  serverNowMs: number;
  timeZone: string;
}) {
  const anchor = day.slots[0];
  return (
    <DayBar
      items={day.slots.map((s) => ({
        id: s.id,
        fromMin: s.fromMin,
        toMin: s.toMin,
        endsAtMs: s.endsAtMs,
        title: s.title,
        emphasis: s.mine,
      }))}
      windowStart={day.windowStart}
      windowEnd={day.windowEnd}
      anchorMs={anchor ? anchor.startsAtMs : serverNowMs}
      anchorMin={anchor ? anchor.fromMin : day.windowStart}
      accent="var(--color-garnet-lift)"
      tone="dark"
      serverNowMs={serverNowMs}
      timeZone={timeZone}
    />
  );
}

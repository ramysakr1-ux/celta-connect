import { DayBar } from "@/components/day-bar";
import type { TraineeDay } from "@/lib/trainee-day";

// The trainee's day bar: the shared DayBar on the dark header. Ramy, 10 Sep
// 2026, on the trainee having no role colour of their own -- the fill here is
// "where you are", not a role, which is why the trainer hub passes its own
// accent instead.
//
// Gold, not garnet, since 16 Sep 2026 (trainee spec C2, Ramy's call): garnet
// was doing elapsed here, overdue in Catch up and "now" on the track all at
// once, and a candidate had no way to tell the three apart. Gold takes
// elapsed; garnet keeps lateness and the live moment. One value, this one.
export function HeaderDayBar({
  day,
  serverNowMs,
  timeZone,
  dayLabel,
}: {
  day: TraineeDay;
  serverNowMs: number;
  timeZone: string;
  /** "Mon" when the day drawn is the next timetabled one, not today. */
  dayLabel?: string;
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
      accent="var(--color-gold-lift)"
      tone="dark"
      serverNowMs={serverNowMs}
      timeZone={timeZone}
      dayLabel={dayLabel}
    />
  );
}

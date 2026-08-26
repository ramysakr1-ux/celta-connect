// Every IANA zone the runtime actually supports (~418), rather than a
// hand-curated shortlist -- a centre could genuinely be anywhere, and this
// guarantees every option Intl.DateTimeFormat will actually accept. Sorted
// by current UTC offset then name, the standard timezone-picker order, with
// the offset shown in the label so "which one is mine" doesn't require
// knowing the city name for it.
function offsetMinutesFor(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = raw.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sign = match[1].startsWith("-") ? -1 : 1;
  const hours = Math.abs(Number(match[1]));
  const minutes = Number(match[2] ?? 0);
  return sign * (hours * 60 + minutes);
}

function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = Intl.supportedValuesOf("timeZone")
  .map((value) => ({ value, offsetMinutes: offsetMinutesFor(value) }))
  .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.value.localeCompare(b.value))
  .map(({ value, offsetMinutes }) => ({
    value,
    label: `${offsetLabel(offsetMinutes)} -- ${value.replace(/_/g, " ")}`,
  }));

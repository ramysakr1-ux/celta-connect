// §3.4 -- neutral, factual, never a judgement. Fill is always teal, no
// colour semantics/thresholds -- this is not where standing lives.
export function StatBar({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-lg leading-none text-ink">
        {value} / {max}
        {unit ? ` ${unit}` : ""}
      </p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-primary/20">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

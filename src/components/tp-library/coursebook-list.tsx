import Link from "next/link";
import type { Database } from "@/lib/supabase/types";

type Coursebook = Database["public"]["Tables"]["tp_coursebooks"]["Row"];

const STATUS_LABEL: Record<Coursebook["generation_status"], string> = {
  pending: "Not generated yet",
  processing: "Generating...",
  completed: "Generated",
  failed: "Generation failed",
};

// `level` is free text (not an enum -- a center might type "A2+", "Upper
// Intermediate", anything), so group order follows real CEFR progression
// where a level matches one, and anything else falls back after, sorted
// alphabetically among itself rather than breaking on an unrecognised value.
const CEFR_ORDER = ["A1", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C2"];
function levelRank(level: string): number {
  const i = CEFR_ORDER.indexOf(level.trim());
  return i === -1 ? CEFR_ORDER.length : i;
}

export function CoursebookList({
  coursebooks,
  basePath,
}: {
  coursebooks: Coursebook[];
  basePath: string;
}) {
  if (coursebooks.length === 0) {
    return <p className="text-muted">No coursebooks uploaded yet.</p>;
  }

  const byLevel = new Map<string, Coursebook[]>();
  for (const cb of coursebooks) {
    const list = byLevel.get(cb.level) ?? [];
    list.push(cb);
    byLevel.set(cb.level, list);
  }
  const levels = [...byLevel.keys()].sort((a, b) => levelRank(a) - levelRank(b) || a.localeCompare(b));

  return (
    <div className="flex flex-col gap-5">
      {levels.map((level) => (
        <div key={level}>
          <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">{level}</h3>
          <div className="mt-2 flex flex-col gap-2">
            {byLevel
              .get(level)!
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((cb) => (
                <Link
                  key={cb.id}
                  href={`${basePath}/${cb.id}`}
                  className="card-interactive flex items-center justify-between p-4"
                >
                  <span className="text-ink">{cb.title}</span>
                  <span className="text-sm text-muted">{STATUS_LABEL[cb.generation_status]}</span>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

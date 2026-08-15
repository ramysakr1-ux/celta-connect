const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "with", "without", "for", "of", "to", "in", "on", "at",
  "is", "are", "was", "were", "be", "been", "being", "this", "that", "these", "those", "not",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/θðʃʒŋ]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

interface Claim {
  id: string;
  candidate_id: string;
  problem_type: string;
  problem_description: string;
  source: string;
}
interface PoolEntry {
  id: string;
  note: string;
}

// "Day 12 (marking): the review/marking view should let the tutor
// cross-check a submission's cited example against class_error_log/the
// transcript, surfacing a flag if the citation doesn't trace back to a
// real logged/transcribed instance." Same heuristic as
// submitFolClaim's zero-evidence check -- a claim that passed validation
// when made should still trace here; this mainly catches evidence that
// existed at claim-time but doesn't read as a real match on a closer look.
export function FolCrossCheck({ claims, poolEntries }: { claims: Claim[]; poolEntries: PoolEntry[] }) {
  if (claims.length === 0) return null;

  return (
    <div className="sheet flex flex-col gap-2 p-6">
      <h2 className="font-serif text-lg text-ink">Focus on the Learner -- claimed problems</h2>
      <p className="text-sm text-muted">Cross-checked against the class log. A flag means the citation doesn&apos;t trace to a logged instance.</p>
      <ul className="flex flex-col gap-1.5">
        {claims.map((c) => {
          const words = significantWords(c.problem_description);
          const traces = poolEntries.some((e) => words.some((w) => e.note.toLowerCase().includes(w)));
          return (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span className="pill pill-neutral">{c.problem_type}</span>
              <span className="text-ink">{c.problem_description}</span>
              <span className="text-xs text-muted">({c.source === "pooled_log" ? "class log" : "sign-up recording"})</span>
              {!traces ? <span className="pill pill-danger ml-auto">Doesn&apos;t trace to a logged instance</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

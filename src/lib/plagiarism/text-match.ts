// Pure text-comparison core for the built-in scanner. No I/O -- takes
// strings, returns matched runs. Kept separate from builtin-provider.ts
// (which does the DB fetching) so this part is unit-testable on its own.

export interface MatchedRun {
  /** Word length of the contiguous match. */
  length: number;
  /** The matched text, reconstructed from the candidate's own words (original casing). */
  text: string;
  /** Word-index range in the candidate text, for future highlighting UI. */
  candidateStart: number;
  candidateEnd: number;
}

const SHINGLE_SIZE = 8;

// build-spec.md: prose fields need a real run of continuous writing to be
// worth a look; analysis fields (language analysis, criteria wording) are
// EXPECTED to share short phrasing between candidates analysing the same
// coursebook item, so they need a much longer run before it's worth
// surfacing -- this is the "weight continuous prose far more heavily"
// requirement, implemented as different thresholds rather than a shown
// score.
export const MATCH_THRESHOLD: Record<"prose" | "analysis", number> = {
  prose: 15,
  analysis: 25,
};

function tokenize(text: string): { original: string[]; normalized: string[] } {
  // Split on whitespace, strip surrounding punctuation per word, drop empties.
  const raw = text.split(/\s+/).filter(Boolean);
  const normalized = raw.map((w) => w.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, ""));
  return { original: raw, normalized };
}

// build-spec.md: "Quotations they attributed are excluded where the
// referencing convention makes them identifiable". Simple heuristic: any
// run of words inside literal double quotes in the candidate's OWN text is
// treated as an attributed quotation and excluded from shingle generation
// -- it can still match verbatim source text, but that's expected of a
// citation, not a finding.
function stripQuotedSpans(text: string): string {
  return text.replace(/"[^"]*"/g, (m) => " ".repeat(m.length));
}

function shingles(normalized: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = 0; i + SHINGLE_SIZE <= normalized.length; i++) {
    const key = normalized.slice(i, i + SHINGLE_SIZE).join(" ");
    if (!key.trim()) continue;
    const positions = map.get(key) ?? [];
    positions.push(i);
    map.set(key, positions);
  }
  return map;
}

function buildRun(start: number, end: number, originalWords: string[]): MatchedRun {
  return {
    length: end - start,
    text: originalWords.slice(start, end).join(" "),
    candidateStart: start,
    candidateEnd: end,
  };
}

// Shared by both match functions below: given the set of candidate
// word-indices where a shingle hit landed, merge overlapping/adjacent
// hits into contiguous runs (a hit at word-index i covers words
// [i, i+SHINGLE_SIZE)) and keep only runs at or above the field type's
// threshold.
function mergeHitsToRuns(hitStarts: Set<number>, originalWords: string[], fieldType: "prose" | "analysis"): MatchedRun[] {
  if (hitStarts.size === 0) return [];
  const sorted = [...hitStarts].sort((a, b) => a - b);
  const runs: MatchedRun[] = [];
  let runStart = sorted[0];
  let runEnd = sorted[0] + SHINGLE_SIZE;
  for (let i = 1; i < sorted.length; i++) {
    const start = sorted[i];
    if (start <= runEnd) {
      runEnd = Math.max(runEnd, start + SHINGLE_SIZE);
    } else {
      runs.push(buildRun(runStart, runEnd, originalWords));
      runStart = start;
      runEnd = start + SHINGLE_SIZE;
    }
  }
  runs.push(buildRun(runStart, runEnd, originalWords));
  return runs.filter((r) => r.length >= MATCH_THRESHOLD[fieldType]);
}

/**
 * Finds contiguous matched runs between a candidate section and one
 * comparison text, at or above the field type's threshold. Multiple
 * disjoint runs can be returned if the candidate matches different parts
 * of the comparison text in different places.
 *
 * `excludeShingleKeys` is the brief's own shingle set (see briefShingleKeys
 * below) -- any candidate shingle that also came from the brief never
 * counts as a hit against ANY comparison text. This is what "the app
 * already holds the brief's exact text and can subtract every passage
 * that came from it" means in practice: subtraction happens at the
 * shingle-key level, once, reused across every comparison.
 */
export function findMatchedRuns(
  candidateText: string,
  comparisonText: string,
  fieldType: "prose" | "analysis",
  excludeShingleKeys: ReadonlySet<string> = new Set()
): MatchedRun[] {
  const candidate = tokenize(stripQuotedSpans(candidateText));
  const comparison = tokenize(stripQuotedSpans(comparisonText));
  if (candidate.normalized.length < SHINGLE_SIZE || comparison.normalized.length < SHINGLE_SIZE) return [];

  const comparisonShingles = shingles(comparison.normalized);
  const candidateShingles = shingles(candidate.normalized);

  const hitStarts = new Set<number>();
  for (const key of candidateShingles.keys()) {
    if (excludeShingleKeys.has(key)) continue;
    if (comparisonShingles.has(key)) {
      for (const pos of candidateShingles.get(key)!) hitStarts.add(pos);
    }
  }
  return mergeHitsToRuns(hitStarts, candidate.original, fieldType);
}

/**
 * Same as findMatchedRuns, but against a stored shingle set rather than
 * raw text -- what the cross-course archive comparison uses, since
 * submission_text_fingerprints deliberately never stores the original
 * text (see migration 0063's header comment). The reconstructed matched
 * passage necessarily comes from the CANDIDATE's own text, never the
 * archived submission -- there is no archived text to show.
 */
export function findMatchedRunsAgainstShingleSet(
  candidateText: string,
  comparisonShingles: ReadonlySet<string>,
  fieldType: "prose" | "analysis",
  excludeShingleKeys: ReadonlySet<string> = new Set()
): MatchedRun[] {
  const candidate = tokenize(stripQuotedSpans(candidateText));
  if (candidate.normalized.length < SHINGLE_SIZE) return [];
  const candidateShingles = shingles(candidate.normalized);

  const hitStarts = new Set<number>();
  for (const key of candidateShingles.keys()) {
    if (excludeShingleKeys.has(key)) continue;
    if (comparisonShingles.has(key)) {
      for (const pos of candidateShingles.get(key)!) hitStarts.add(pos);
    }
  }
  return mergeHitsToRuns(hitStarts, candidate.original, fieldType);
}

/** Normalized shingle set for a text -- what gets persisted for the
 * cross-course archive (submission_text_fingerprints.shingles). */
export function shingleSet(text: string): string[] {
  const { normalized } = tokenize(stripQuotedSpans(text));
  return [...shingles(normalized).keys()];
}

/** The brief's own shingle keys, for excludeShingleKeys above. */
export function briefShingleKeys(briefText: string): Set<string> {
  return new Set(shingleSet(briefText));
}

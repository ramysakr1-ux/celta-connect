/**
 * Initials for an avatar chip: the first letter of the first two words.
 *
 * Ramy, 1 Sep 2026: "why does the chat pill for all roles read CO instead of
 * CC as it should?"
 *
 * Because the old helper only took word-initials for direct messages, and fell
 * back to the first two CHARACTERS for everything else -- so "Connect CELTA
 * New York" came out as CO. A person's name got PR for "Priya Raman" while the
 * centre's own channel got the first syllable of its first word.
 *
 * One rule for both: names are made of words, and the initial of each is what
 * people expect. Single-word names keep their first two letters, which is the
 * only case where the old behaviour was right.
 */
export function initials(name: string): string {
  // Only words that START with a letter or digit count. Channel names carry
  // separators -- "Tutors -- Demo Course", "Connect CELTA New York . admin" --
  // and without this the dash is a word, so that first example came out as
  // "T-" rather than "TD". Found by running the real names through it rather
  // than assuming two-word input.
  const parts = name.trim().split(/\s+/).filter((p) => /^[\p{L}\p{N}]/u.test(p));
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

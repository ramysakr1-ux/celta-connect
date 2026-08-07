// Shared between the client picker (provisional-grade-form.tsx) and the
// server action (celta5-actions.ts) -- kept out of the "use server" file
// since only async functions survive as real exports there; a plain
// constant silently becomes a non-callable proxy in the client bundle.
export const PROVISIONAL_SLOTS = [
  "Fail",
  "Fail/Pass",
  "Pass",
  "Pass/Pass B",
  "Pass B",
  "Pass B/Pass A",
  "Pass A",
  "Withdrawn",
] as const;

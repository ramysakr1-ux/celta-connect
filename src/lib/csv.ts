/**
 * One CSV cell, safe to open in a spreadsheet.
 *
 * Two separate jobs, and four copies of this helper around the app only did
 * the first one (walked 15 Sep 2026):
 *
 * 1. Quoting, so a comma, quote or newline inside a value cannot break the
 *    column structure.
 * 2. Defusing formulas. A cell whose first character is =, +, - or @ is a
 *    FORMULA to Excel, Numbers and Sheets, not text -- and the values here
 *    are names and titles people typed, including applicants on a public
 *    form. A leading apostrophe is the standard fix: the spreadsheet shows
 *    the text and never evaluates it.
 */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

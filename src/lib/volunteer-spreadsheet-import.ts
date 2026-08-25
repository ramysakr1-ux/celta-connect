import { LEVEL_OPTIONS } from "@/lib/levels";

// Parallel to spreadsheet-import.ts's applicant fields, deliberately kept
// separate rather than generalizing that file in place -- volunteers have no
// pipeline stage, and (unlike applicants.email, NOT NULL) no email is a
// completely valid volunteer, not an error. Reusing IMPORT_FIELDS'
// applicant-shaped required/hard-stop semantics for this would be wrong, not
// just redundant.
export const VOLUNTEER_IMPORT_FIELDS = [
  { key: "name", label: "Name", required: true, aliases: ["name", "full name", "student", "volunteer"] },
  { key: "email", label: "Email", required: false, aliases: ["email", "e-mail", "mail", "email address"] },
  { key: "level", label: "Level", required: false, aliases: ["level", "class level", "cefr"] },
] as const;

export type VolunteerImportFieldKey = (typeof VOLUNTEER_IMPORT_FIELDS)[number]["key"];
/** null means "explicitly not imported" -- distinct field-key union from
 * spreadsheet-import.ts's applicant-shaped ColumnMapping, not a reuse of it. */
export type VolunteerColumnMapping = Record<string, VolunteerImportFieldKey | null>;

const normalise = (s: string) => s.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");

export function guessVolunteerMapping(headers: string[]): VolunteerColumnMapping {
  const mapping: VolunteerColumnMapping = {};
  const taken = new Set<VolunteerImportFieldKey>();

  for (const header of headers) {
    const h = normalise(header);
    let match: VolunteerImportFieldKey | null = null;

    for (const field of VOLUNTEER_IMPORT_FIELDS) {
      if (taken.has(field.key)) continue;
      if (field.aliases.some((a) => normalise(a) === h)) {
        match = field.key;
        break;
      }
    }
    if (!match) {
      for (const field of VOLUNTEER_IMPORT_FIELDS) {
        if (taken.has(field.key)) continue;
        if (field.aliases.some((a) => h.startsWith(normalise(a)))) {
          match = field.key;
          break;
        }
      }
    }
    if (match) taken.add(match);
    mapping[header] = match;
  }
  return mapping;
}

export type VolunteerRowVerdict = "import" | "duplicate" | "no_name";

export interface AnalysedVolunteerRow {
  rowNumber: number;
  name: string;
  email: string | null;
  level: string | null;
  verdict: VolunteerRowVerdict;
  note: string;
}

export interface VolunteerImportAnalysis {
  rows: AnalysedVolunteerRow[];
  tallies: { willImport: number; duplicates: number; noName: number };
}

export function analyseVolunteerRows({
  headers,
  rows,
  mapping,
  existingEmails,
}: {
  headers: string[];
  rows: string[][];
  mapping: VolunteerColumnMapping;
  /** Emails already on this course's volunteers -- lower-cased by the caller. */
  existingEmails: Set<string>;
}): VolunteerImportAnalysis {
  const indexOf = (key: VolunteerImportFieldKey) => headers.findIndex((h) => mapping[h] === key);
  const nameIdx = indexOf("name");
  const emailIdx = indexOf("email");
  const levelIdx = indexOf("level");

  const seenInFile = new Set<string>();
  const analysed: AnalysedVolunteerRow[] = [];

  rows.forEach((cells, i) => {
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const name = get(nameIdx);
    const rawEmail = get(emailIdx);
    const email = rawEmail ? rawEmail.toLowerCase() : null;
    const rawLevel = get(levelIdx).toUpperCase();
    const level = (LEVEL_OPTIONS as readonly string[]).includes(rawLevel) ? rawLevel : null;

    let verdict: VolunteerRowVerdict;
    let note: string;
    if (!name) {
      verdict = "no_name";
      note = "No name";
    } else if (email && (existingEmails.has(email) || seenInFile.has(email))) {
      verdict = "duplicate";
      note = seenInFile.has(email) ? "Listed twice in this sheet -- will be skipped" : "Already a volunteer on this course -- will be skipped";
    } else {
      verdict = "import";
      note = email ? "New" : "New (no email -- won't get reminder emails)";
      if (email) seenInFile.add(email);
    }

    analysed.push({ rowNumber: i + 1, name: name || "(no name)", email, level, verdict, note });
  });

  return {
    rows: analysed,
    tallies: {
      willImport: analysed.filter((r) => r.verdict === "import").length,
      duplicates: analysed.filter((r) => r.verdict === "duplicate").length,
      noName: analysed.filter((r) => r.verdict === "no_name").length,
    },
  };
}

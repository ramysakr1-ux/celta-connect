// Centre Admin "Import" tab. Everything here is pure -- no DB, no I/O -- so
// the dry-run the admin sees and the commit that follows are computed by the
// same code path. The spec's whole promise is "this is the whole import laid
// out with its problems on top... before it becomes forty phantom candidates
// nobody can delete", which only holds if preview and commit can't disagree.

// .xlsx via SheetJS -- installed from cdn.sheetjs.com rather than the npm
// registry copy, which carries two unpatched high-severity advisories
// (prototype pollution, ReDoS) SheetJS never backported there after moving
// off npm. Isolated behind this one function, same as parseDelimited below,
// so parsing stays swappable.
export const SUPPORTED_EXTENSIONS = [".csv", ".tsv", ".xlsx", ".xls"] as const;

export async function parseXlsx(data: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  return rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

/**
 * RFC4180-ish: quoted fields may contain the delimiter, newlines, and ""
 * escapes. Written by hand rather than split(",") because a "Notes" column
 * with a comma in it would otherwise shift every field after it and silently
 * import garbage.
 */
export function parseDelimited(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM -- Excel writes one, and it would otherwise become part
  // of the first header name and break every mapping guess for that column.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  // Trailing field/row, unless the file simply ended with a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// The applicant columns an import may write. Deliberately excludes anything
// that would need inventing: applicant payments are a plan + instalments
// structure (migration 0087) needing a total and currency a sheet may not
// carry, so a "deposit paid" column is recognised as unmappable rather than
// turned into a fabricated payment plan.
export const IMPORT_FIELDS = [
  { key: "full_name", label: "Full name", required: true, aliases: ["name", "full name", "candidate", "applicant", "surname"] },
  { key: "email", label: "Email", required: true, aliases: ["email", "e-mail", "mail", "email address"] },
  { key: "phone", label: "Phone", required: false, aliases: ["phone", "tel", "telephone", "mobile", "contact number"] },
  { key: "stage", label: "Pipeline stage", required: false, aliases: ["status", "stage", "pipeline", "progress"] },
  { key: "date_of_birth", label: "Date of birth", required: false, aliases: ["dob", "date of birth", "birthdate", "born"] },
  { key: "education_summary", label: "Education", required: false, aliases: ["education", "qualifications", "degree"] },
  { key: "elt_experience_summary", label: "ELT experience", required: false, aliases: ["experience", "elt experience", "teaching experience"] },
  { key: "special_requirements", label: "Special requirements", required: false, aliases: ["special requirements", "accessibility", "needs"] },
  { key: "anything_else", label: "Anything else", required: false, aliases: ["notes", "comments", "other", "anything else"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
/** null means "explicitly not imported" -- the spec's "Skipped" mapping state. */
export type ColumnMapping = Record<string, ImportFieldKey | null>;

const normalise = (s: string) => s.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");

/**
 * "Connect guesses from the headings and gets most of them right." Exact
 * normalised match first, then prefix -- never fuzzy/substring, because a
 * wrong-but-confident guess is worse here than no guess: the admin reviews
 * "Needs you" rows and would likely wave through an already-filled one.
 */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<ImportFieldKey>();

  for (const header of headers) {
    const h = normalise(header);
    let match: ImportFieldKey | null = null;

    for (const field of IMPORT_FIELDS) {
      if (taken.has(field.key)) continue;
      if (field.aliases.some((a) => normalise(a) === h)) {
        match = field.key;
        break;
      }
    }
    if (!match) {
      for (const field of IMPORT_FIELDS) {
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

// applicants.stage's check constraint (migration 0081). A centre's own status
// words are mapped onto these by hand in step 2 -- "no two centres use the
// same vocabulary", so this is never inferred from the sheet alone.
export const APPLICANT_STAGES = [
  "submitted",
  "task_returned",
  "interview_booked",
  "interview_completed",
  "offer_sent",
  "accepted",
  "rejected_before_interview",
  "rejected_after_interview",
  "waiting_list",
  "not_this_time",
  "withdrawn_application",
] as const;

/** null means "rows with this status are not imported" -- the row-level skip. */
export type StatusValueMapping = Record<string, (typeof APPLICANT_STAGES)[number] | null>;

export type RowVerdict = "import" | "duplicate" | "missing_email" | "skipped";

export interface AnalysedRow {
  rowNumber: number; // 1-based within the data rows, matching what the admin sees in their sheet
  fullName: string;
  email: string | null;
  stage: (typeof APPLICANT_STAGES)[number];
  verdict: RowVerdict;
  note: string;
  values: Partial<Record<ImportFieldKey, string>>;
}

export interface ImportAnalysis {
  rows: AnalysedRow[];
  tallies: { willImport: number; duplicates: number; missingEmail: number; skipped: number };
  /** Status values present in the sheet with no mapping decision yet -- step 2 can't be finished while this is non-empty. */
  unmappedStatusValues: string[];
}

export function analyseRows({
  headers,
  rows,
  mapping,
  statusMapping,
  existingEmails,
}: {
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
  statusMapping: StatusValueMapping;
  /** Emails already on this centre's applicants -- lower-cased by the caller. */
  existingEmails: Set<string>;
}): ImportAnalysis {
  const indexOf = (key: ImportFieldKey) => headers.findIndex((h) => mapping[h] === key);
  const nameIdx = indexOf("full_name");
  const emailIdx = indexOf("email");
  const stageIdx = indexOf("stage");

  const unmapped = new Set<string>();
  // Duplicates within the file itself, not just against the DB -- a sheet that
  // lists someone twice would otherwise import them twice on first run and
  // only dedupe on the second.
  const seenInFile = new Set<string>();
  const analysed: AnalysedRow[] = [];

  rows.forEach((cells, i) => {
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const fullName = get(nameIdx);
    const rawEmail = get(emailIdx);
    const email = rawEmail ? rawEmail.toLowerCase() : null;
    const rawStatus = get(stageIdx);

    const values: Partial<Record<ImportFieldKey, string>> = {};
    for (const field of IMPORT_FIELDS) {
      if (field.key === "stage") continue;
      const v = get(indexOf(field.key));
      if (v) values[field.key] = v;
    }

    let stage: (typeof APPLICANT_STAGES)[number] = "submitted";
    let statusSkipped = false;
    let statusNote = "";
    if (rawStatus) {
      if (rawStatus in statusMapping) {
        const mapped = statusMapping[rawStatus];
        if (mapped === null) {
          statusSkipped = true;
          statusNote = `Status "${rawStatus}" set to not import`;
        } else {
          stage = mapped;
          statusNote = `Status "${rawStatus}" read as ${mapped.replace(/_/g, " ")}`;
        }
      } else {
        unmapped.add(rawStatus);
        statusNote = `Status "${rawStatus}" needs a decision`;
      }
    }

    let verdict: RowVerdict;
    let note: string;
    if (statusSkipped) {
      verdict = "skipped";
      note = statusNote;
    } else if (!email) {
      // applicants.email is NOT NULL, so this is a hard stop, not a warning --
      // and the spec's reason is the human one: "cannot be invited later".
      verdict = "missing_email";
      note = "No email -- cannot be invited later";
    } else if (existingEmails.has(email) || seenInFile.has(email)) {
      verdict = "duplicate";
      note = seenInFile.has(email) ? "Listed twice in this sheet -- will be skipped" : "Already in Connect -- will be skipped";
    } else {
      verdict = "import";
      note = statusNote || "New";
      seenInFile.add(email);
    }

    analysed.push({ rowNumber: i + 1, fullName: fullName || "(no name)", email, stage, verdict, note, values });
  });

  return {
    rows: analysed,
    tallies: {
      willImport: analysed.filter((r) => r.verdict === "import").length,
      duplicates: analysed.filter((r) => r.verdict === "duplicate").length,
      missingEmail: analysed.filter((r) => r.verdict === "missing_email").length,
      skipped: analysed.filter((r) => r.verdict === "skipped").length,
    },
    unmappedStatusValues: [...unmapped],
  };
}

/** Distinct raw values in the sheet's status column -- what step 2 asks about. */
export function statusValuesIn(headers: string[], rows: string[][], mapping: ColumnMapping): string[] {
  const idx = headers.findIndex((h) => mapping[h] === "stage");
  if (idx < 0) return [];
  const seen = new Set<string>();
  for (const cells of rows) {
    const v = (cells[idx] ?? "").trim();
    if (v) seen.add(v);
  }
  return [...seen];
}

/** The spec's undo window: "can be undone for seven days". */
export const UNDO_WINDOW_DAYS = 7;

export function undoDeadline(createdAt: string | Date): Date {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + UNDO_WINDOW_DAYS);
  return d;
}

export function isWithinUndoWindow(createdAt: string | Date, now = new Date()): boolean {
  return now <= undoDeadline(createdAt);
}

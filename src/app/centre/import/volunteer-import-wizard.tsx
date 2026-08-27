"use client";

import { useActionState, useMemo, useState } from "react";
import { commitVolunteerImport, getCenterDriveAccessTokenForVolunteerImport, type CommitVolunteerImportState } from "@/app/centre/import/volunteer-actions";
import { fetchDriveFileAsArrayBuffer, fetchDriveFileAsText, openDrivePicker, XLSX_MIME_TYPE } from "@/lib/google/picker-client";
import { parseDelimited, parseXlsx } from "@/lib/spreadsheet-import";
import {
  VOLUNTEER_IMPORT_FIELDS,
  analyseVolunteerRows,
  guessVolunteerMapping,
  type VolunteerColumnMapping,
  type VolunteerImportFieldKey,
} from "@/lib/volunteer-spreadsheet-import";

const STEPS = [
  { key: "connect", label: "Connect the sheet" },
  { key: "map", label: "Match the columns" },
  { key: "preview", label: "See what happens" },
  { key: "after", label: "Afterwards" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const initialCommit: CommitVolunteerImportState = {};

// Parallel to src/app/centre/import/import-wizard.tsx -- same real Drive
// picker, dry-run-before-write, and seven-day-undo shape, simplified for
// volunteers (no pipeline stage, no status-value mapping step, email
// optional rather than required). Ramy, 25/26 Aug 2026: "center management
// also have one" / "it could have its own tab."
export function VolunteerImportWizard({
  courses,
  existingEmailsByCourse,
}: {
  courses: { id: string; name: string }[];
  /** Already-registered emails, scoped per course -- "already on THIS
   * course", never flattened across the whole centre (see page.tsx). */
  existingEmailsByCourse: Record<string, string[]>;
}) {
  const [step, setStep] = useState<StepKey>("connect");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<VolunteerColumnMapping>({});
  const [readError, setReadError] = useState<string | null>(null);
  const [drivePending, setDrivePending] = useState(false);
  const [state, action, pending] = useActionState(commitVolunteerImport, initialCommit);

  const emailSet = useMemo(() => new Set(existingEmailsByCourse[courseId] ?? []), [existingEmailsByCourse, courseId]);

  function ingestRows(name: string, parsed: string[][]) {
    if (parsed.length < 2) {
      setReadError("That file has no rows under its headings.");
      return;
    }
    const [head, ...body] = parsed;
    setFilename(name);
    setHeaders(head);
    setRows(body);
    setMapping(guessVolunteerMapping(head));
    setStep("map");
  }

  async function onFile(file: File) {
    setReadError(null);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        ingestRows(file.name, await parseXlsx(await file.arrayBuffer()));
        return;
      }
      const text = await file.text();
      ingestRows(file.name, parseDelimited(text, name.endsWith(".tsv") ? "\t" : ","));
    } catch {
      setReadError("Could not read that file. Try again.");
    }
  }

  async function onDriveConnect() {
    setReadError(null);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
      setReadError("Google Drive isn't configured for this app yet.");
      return;
    }
    setDrivePending(true);
    try {
      const result = await getCenterDriveAccessTokenForVolunteerImport();
      if ("error" in result) {
        setReadError(result.error);
        return;
      }
      await openDrivePicker({
        accessToken: result.accessToken,
        apiKey,
        viewId: "SPREADSHEETS",
        onPicked: async (file) => {
          try {
            if (file.mimeType === XLSX_MIME_TYPE) {
              const buffer = await fetchDriveFileAsArrayBuffer(file, result.accessToken);
              ingestRows(file.name, await parseXlsx(buffer));
              return;
            }
            const text = await fetchDriveFileAsText(file, result.accessToken);
            const delimiter = file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",";
            ingestRows(file.name, parseDelimited(text, delimiter));
          } catch {
            setReadError("Could not read that file from Drive. Try again.");
          }
        },
      });
    } catch {
      setReadError("Could not open the Drive picker. Try again.");
    } finally {
      setDrivePending(false);
    }
  }

  const analysis = useMemo(() => analyseVolunteerRows({ headers, rows, mapping, existingEmails: emailSet }), [headers, rows, mapping, emailSet]);
  const mappedFields = new Set(Object.values(mapping).filter(Boolean) as VolunteerImportFieldKey[]);
  const missingRequired = VOLUNTEER_IMPORT_FIELDS.filter((f) => f.required && !mappedFields.has(f.key));
  const canPreview = missingRequired.length === 0;

  const done = Boolean(state.importId);
  const currentStep: StepKey = done ? "after" : step;

  return (
    <div className="volunteer-import-wizard flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const active = s.key === currentStep;
          return (
            <div
              key={s.key}
              className={`flex items-center gap-2.5 rounded-[8px] border px-4 py-3 ${
                active ? "border-primary bg-card" : "border-border bg-surface-muted/40"
              }`}
            >
              <span className={`font-serif text-lg ${active ? "text-primary" : "text-muted"}`}>{i + 1}</span>
              <span className={`text-[13px] font-medium ${active ? "text-primary" : "text-muted"}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {currentStep === "connect" ? (
        <div className="sheet flex flex-col gap-4" style={{ borderTop: "3px solid var(--vol-sage)" }}>
          <div>
            <h2 className="font-serif text-[22px] text-ink">Point Connect at the file you already have</h2>
            <p className="mt-1 text-sm text-muted">
              Nothing is written anywhere yet. This is a one-time read, not a live link -- your spreadsheet keeps
              working exactly as it did, and nothing here changes when somebody edits it afterwards.
            </p>
          </div>

          <label className="flex max-w-sm flex-col gap-1.5">
            <span className="text-sm text-muted">Which course are these volunteers for?</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex max-w-sm flex-col gap-1.5">
            <span className="text-sm text-muted">Choose a file</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onDriveConnect}
                disabled={drivePending}
                className="admin-hover-fill h-10 shrink-0 rounded-[6px] border border-border bg-card px-3.5 text-sm text-ink hover:border-primary disabled:opacity-50"
              >
                {drivePending ? "Opening…" : "Connect centre's Drive"}
              </button>
              <span className="shrink-0 text-xs text-muted">or</span>
              <input
                type="file"
                accept=".csv,.tsv,.xlsx,.xls,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
                className="text-sm text-ink file:mr-3 file:rounded-[6px] file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-ink"
              />
            </div>
          </div>

          {readError ? <p className="text-sm text-destructive">{readError}</p> : null}
          <p className="text-xs text-muted">
            Nothing is created until you have seen the preview, and nobody is emailed automatically -- send join
            links afterward, on your own timing, the same way you already can one at a time.
          </p>
        </div>
      ) : null}

      {currentStep === "map" ? (
        <div className="sheet flex flex-col gap-4" style={{ borderTop: "3px solid var(--vol-sage)" }}>
          <div>
            <h2 className="font-serif text-[22px] text-ink">Their column names, our fields</h2>
            <p className="mt-1 text-sm text-muted">Connect guesses from the headings -- check each one before moving on.</p>
          </div>

          <div className="flex flex-col">
            {headers.map((header, i) => {
              const value = mapping[header];
              return (
                <div key={`${header}-${i}`} className={`admin-hover flex items-center gap-3 py-2 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <span className="w-40 shrink-0 truncate text-sm text-ink">{header || "(unnamed column)"}</span>
                  <span className="text-xs text-muted">&rarr;</span>
                  <select
                    value={value ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [header]: (e.target.value || null) as VolunteerImportFieldKey | null }))}
                    className="h-9 flex-1 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary"
                  >
                    <option value="">Not imported</option>
                    {VOLUNTEER_IMPORT_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                        {f.required ? " (required)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className={`w-20 shrink-0 text-right text-xs ${value ? "text-primary" : "text-muted"}`}>{value ? "Matched" : "Skipped"}</span>
                </div>
              );
            })}
          </div>

          {missingRequired.length > 0 ? (
            <p className="text-sm text-destructive">Still needed: {missingRequired.map((f) => f.label).join(", ")}.</p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("preview")}
              disabled={!canPreview}
              className="admin-hover-fill rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              See what happens
            </button>
            <button type="button" onClick={() => setStep("connect")} className="text-sm text-muted hover:text-ink">
              Choose a different file
            </button>
          </div>
        </div>
      ) : null}

      {currentStep === "preview" ? (
        <div className="sheet flex flex-col gap-4" style={{ borderTop: "3px solid var(--vol-sage)" }}>
          <div>
            <h2 className="font-serif text-[22px] text-ink">
              {rows.length} row{rows.length === 1 ? "" : "s"}, and what each will become
            </h2>
            <p className="mt-1 text-sm text-muted">Nothing has been written yet.</p>
          </div>

          <div className="flex flex-wrap gap-10 rounded-[8px] border border-border bg-surface-muted/50 px-5 py-4">
            {[
              { k: "Will import", v: analysis.tallies.willImport, cls: "text-primary" },
              { k: "Duplicates", v: analysis.tallies.duplicates, cls: "text-status-warning-text" },
              { k: "No name", v: analysis.tallies.noName, cls: "text-destructive" },
            ].map((t) => (
              <div key={t.k} className="flex flex-col gap-0.5">
                <span className={`font-serif text-2xl ${t.cls}`}>{t.v}</span>
                <span className="text-[11px] tracking-[0.08em] text-muted uppercase">{t.k}</span>
              </div>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {analysis.rows.map((r) => (
              <div
                key={r.rowNumber}
                className={`admin-hover mb-1 flex items-center gap-3 rounded-[6px] border-l-[3px] bg-surface-muted/40 py-2 pr-3 pl-3 ${
                  r.verdict === "import" ? "border-l-primary" : r.verdict === "no_name" ? "border-l-destructive" : "border-l-status-warning-text"
                }`}
              >
                <span className="w-8 shrink-0 text-xs text-muted tabular-nums">{r.rowNumber}</span>
                <span className="w-44 shrink-0 truncate text-sm text-ink">{r.name}</span>
                <span className="w-56 shrink-0 truncate text-xs text-muted">{r.email ?? "--"}</span>
                <span className="w-16 shrink-0 truncate text-xs text-muted">{r.level ?? "--"}</span>
                <span
                  className={`flex-1 truncate text-xs ${
                    r.verdict === "import" ? "text-muted" : r.verdict === "no_name" ? "text-destructive" : "text-status-warning-text"
                  }`}
                >
                  {r.note}
                </span>
              </div>
            ))}
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <form action={action} className="flex items-center gap-3">
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="source_filename" value={filename} />
            <input type="hidden" name="headers" value={JSON.stringify(headers)} />
            <input type="hidden" name="rows" value={JSON.stringify(rows)} />
            <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
            <button
              type="submit"
              disabled={pending || analysis.tallies.willImport === 0}
              className="admin-hover-fill rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Importing..." : `Import ${analysis.tallies.willImport} volunteer${analysis.tallies.willImport === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={() => setStep("map")} className="text-sm text-muted hover:text-ink">
              Back to the mapping
            </button>
          </form>
          <p className="text-xs text-muted">
            {analysis.rows.length - analysis.tallies.willImport} row{analysis.rows.length - analysis.tallies.willImport === 1 ? " is" : "s are"} held
            back. Fix them in the sheet and run this again -- Connect matches on email and won&apos;t duplicate anyone it has already seen.
          </p>
        </div>
      ) : null}

      {currentStep === "after" ? (
        <div className="sheet flex flex-col gap-4" style={{ borderTop: "3px solid var(--vol-sage)" }}>
          <div>
            <h2 className="font-serif text-[22px] text-ink">Imported, and nobody has been emailed</h2>
            <p className="mt-1 text-sm text-muted">
              {state.imported} more volunteer{state.imported === 1 ? "" : "s"} now on the course, each with a real join link. Not one of them has
              heard from Connect.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { t: "No links were sent", d: "Sending join links is a separate, deliberate action -- use \"Send links\" when you're ready.", c: "border-l-destructive" },
              {
                t: "The import can be undone for seven days",
                d: "One action removes everyone it created, provided none of them have already signed up since.",
                c: "border-l-status-warning-text",
              },
              { t: "It can be run again", d: "Fix the held-back rows in the original sheet and re-import.", c: "border-l-primary" },
              { t: "The spreadsheet still works", d: "Nothing was changed in it and nothing is syncing.", c: "border-l-border" },
            ].map((p) => (
              <div key={p.t} className={`border-l-[3px] pl-3 ${p.c}`}>
                <p className="text-sm font-semibold text-ink">{p.t}</p>
                <p className="text-xs text-muted">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Ramy, 26 Aug 2026: "if you want the voluntary students to be
          green because the page is also green, then fine... let's make it
          green." Reuses the exact sage/coral values from
          for-claude-code-volunteer-pool-header.md rather than inventing a
          new pair. Scoped locally by remapping --color-primary itself
          (same technique /centre/volunteers/page.tsx already uses for its
          own header/card colours) -- every existing bg-primary/text-primary/
          border-primary utility in this component picks up sage
          automatically, no per-class rewrite needed, and nothing outside
          this wrapper is affected. */}
      <style>{`
        .volunteer-import-wizard {
          --vol-sage: oklch(35% 0.075 155);
          --vol-coral: oklch(58% 0.14 25);
          --color-primary: var(--vol-sage);
        }
      `}</style>
    </div>
  );
}

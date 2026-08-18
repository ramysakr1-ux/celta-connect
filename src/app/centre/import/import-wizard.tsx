"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { commitImport, getCenterDriveAccessTokenForImport, type CommitImportState } from "@/app/centre/import/actions";
import { fetchDriveFileAsArrayBuffer, fetchDriveFileAsText, openDrivePicker, XLSX_MIME_TYPE } from "@/lib/google/picker-client";
import {
  APPLICANT_STAGES,
  IMPORT_FIELDS,
  analyseRows,
  guessMapping,
  parseDelimited,
  parseXlsx,
  statusValuesIn,
  type ColumnMapping,
  type ImportFieldKey,
  type StatusValueMapping,
} from "@/lib/spreadsheet-import";

const STEPS = [
  { key: "connect", label: "Connect the sheet" },
  { key: "map", label: "Match the columns" },
  { key: "preview", label: "See what happens" },
  { key: "after", label: "Afterwards" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const STAGE_LABEL: Record<string, string> = {
  submitted: "Submitted",
  task_returned: "Task returned",
  interview_booked: "Interview booked",
  interview_completed: "Interview completed",
  offer_sent: "Offer sent",
  accepted: "Accepted",
  rejected_before_interview: "Rejected (before interview)",
  rejected_after_interview: "Rejected (after interview)",
  waiting_list: "Waiting list",
  not_this_time: "Not this time",
  withdrawn_application: "Withdrawn",
};

const initialCommit: CommitImportState = {};

export function ImportWizard({
  courses,
  existingEmails,
}: {
  courses: { id: string; name: string }[];
  existingEmails: string[];
}) {
  const [step, setStep] = useState<StepKey>("connect");
  const [intakeCourseId, setIntakeCourseId] = useState(courses[0]?.id ?? "");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [statusMapping, setStatusMapping] = useState<StatusValueMapping>({});
  const [readError, setReadError] = useState<string | null>(null);
  const [drivePending, setDrivePending] = useState(false);
  const [state, action, pending] = useActionState(commitImport, initialCommit);

  const emailSet = useMemo(() => new Set(existingEmails), [existingEmails]);

  function ingestRows(name: string, parsed: string[][]) {
    if (parsed.length < 2) {
      setReadError("That file has no rows under its headings.");
      return;
    }
    const [head, ...body] = parsed;
    setFilename(name);
    setHeaders(head);
    setRows(body);
    setMapping(guessMapping(head));
    setStatusMapping({});
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

  // Native Google Sheets export as CSV regardless of the sheet's own
  // delimiter -- an uploaded .csv/.tsv/.xlsx living in Drive keeps its real
  // type, so that part still branches on the file's mime type / name.
  async function onDriveConnect() {
    setReadError(null);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
      setReadError("Google Drive isn't configured for this app yet.");
      return;
    }
    setDrivePending(true);
    try {
      const result = await getCenterDriveAccessTokenForImport();
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

  const statusValues = useMemo(() => statusValuesIn(headers, rows, mapping), [headers, rows, mapping]);
  const analysis = useMemo(
    () => analyseRows({ headers, rows, mapping, statusMapping, existingEmails: emailSet }),
    [headers, rows, mapping, statusMapping, emailSet]
  );

  const mappedFields = new Set(Object.values(mapping).filter(Boolean) as ImportFieldKey[]);
  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && !mappedFields.has(f.key));
  const canPreview = missingRequired.length === 0 && analysis.unmappedStatusValues.length === 0;

  // The committed screen is terminal -- once rows exist, going back would offer
  // to import the same sheet a second time.
  const done = Boolean(state.importId);
  const currentStep: StepKey = done ? "after" : step;

  return (
    <div className="flex flex-col gap-5">
      {/* Numbered step cards in a row, per the layout spec -- the active one
          bordered and teal, the rest quiet. */}
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
        <div className="sheet flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-[22px] text-ink">Point Connect at the file you already have</h2>
            <p className="mt-1 text-sm text-muted">
              Nothing is written anywhere yet. This is a one-time read, not a live link -- your spreadsheet keeps
              working exactly as it did, and nothing here changes when somebody edits it afterwards.
            </p>
          </div>

          <label className="flex max-w-sm flex-col gap-1.5">
            <span className="text-sm text-muted">Which intake are these people for?</span>
            <select
              value={intakeCourseId}
              onChange={(e) => setIntakeCourseId(e.target.value)}
              className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
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
                className="h-10 shrink-0 rounded-[6px] border border-border bg-card px-3.5 text-sm text-ink hover:border-primary disabled:opacity-50"
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
            Nothing is created until you have seen the preview. The Drive option reads through your centre&apos;s
            existing connection (Settings &gt; Google Drive) -- picking a file doesn&apos;t grant any new standing
            access beyond what&apos;s already connected there. .csv, .tsv, .xlsx, and native Google Sheets all read
            straight in -- an .xlsx with more than one tab only reads the first.
          </p>
        </div>
      ) : null}

      {currentStep === "map" ? (
        <div className="sheet flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-[22px] text-ink">Their column names, our fields</h2>
            <p className="mt-1 text-sm text-muted">
              Connect guesses from the headings. What it can&apos;t guess is what your own words mean -- every centre
              has a status column and no two use the same vocabulary.
            </p>
          </div>

          <div className="flex flex-col">
            {headers.map((header, i) => {
              const value = mapping[header];
              return (
                <div key={`${header}-${i}`} className={`flex items-center gap-3 py-2 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <span className="w-40 shrink-0 truncate text-sm text-ink">{header || "(unnamed column)"}</span>
                  <span className="text-xs text-muted">&rarr;</span>
                  <select
                    value={value ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [header]: (e.target.value || null) as ImportFieldKey | null }))
                    }
                    className="h-9 flex-1 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
                  >
                    <option value="">Not imported</option>
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                        {f.required ? " (required)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className={`w-20 shrink-0 text-right text-xs ${value ? "text-primary" : "text-muted"}`}>
                    {value ? "Matched" : "Skipped"}
                  </span>
                </div>
              );
            })}
          </div>

          {missingRequired.length > 0 ? (
            <p className="text-sm text-destructive">
              Still needed: {missingRequired.map((f) => f.label).join(", ")}. Without an email nobody can be invited
              later.
            </p>
          ) : null}

          {statusValues.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-border-faint pt-4">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
                Your status words &middot; {statusValues.length}
              </p>
              <p className="text-sm text-muted">
                Tell Connect what each of your own status values means. Anything set to &ldquo;Don&apos;t import&rdquo;
                holds those rows back entirely.
              </p>
              {statusValues.map((v) => (
                <div key={v} className="flex items-center gap-3 py-1">
                  <span className="w-40 shrink-0 truncate text-sm text-ink">{v}</span>
                  <span className="text-xs text-muted">&rarr;</span>
                  <select
                    value={v in statusMapping ? (statusMapping[v] ?? "__skip__") : ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setStatusMapping((m) => ({
                        ...m,
                        [v]: raw === "__skip__" ? null : (raw as (typeof APPLICANT_STAGES)[number]),
                      }));
                    }}
                    className="h-9 flex-1 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
                  >
                    <option value="" disabled>
                      Needs a decision
                    </option>
                    {APPLICANT_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                    <option value="__skip__">Don&apos;t import these rows</option>
                  </select>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("preview")}
              disabled={!canPreview}
              className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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
        <div className="sheet flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-[22px] text-ink">
              {rows.length} row{rows.length === 1 ? "" : "s"}, and what each will become
            </h2>
            <p className="mt-1 text-sm text-muted">
              Nothing has been written. This is the whole import with its problems on top, so the mapping can be fixed
              before it becomes phantom candidates nobody can delete.
            </p>
          </div>

          <div className="flex flex-wrap gap-10 rounded-[8px] border border-border bg-surface-muted/50 px-5 py-4">
            {[
              { k: "Will import", v: analysis.tallies.willImport, cls: "text-[oklch(48%_0.09_150)]" },
              { k: "Duplicates", v: analysis.tallies.duplicates, cls: "text-gold" },
              { k: "Missing email", v: analysis.tallies.missingEmail, cls: "text-destructive" },
              { k: "Skipped by you", v: analysis.tallies.skipped, cls: "text-muted" },
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
                className={`mb-1 flex items-center gap-3 rounded-[6px] border-l-[3px] bg-surface-muted/40 py-2 pr-3 pl-3 ${
                  r.verdict === "import"
                    ? "border-l-[oklch(48%_0.09_150)]"
                    : r.verdict === "missing_email"
                      ? "border-l-destructive"
                      : r.verdict === "duplicate"
                        ? "border-l-gold"
                        : "border-l-border"
                }`}
              >
                <span className="w-8 shrink-0 text-xs text-muted tabular-nums">{r.rowNumber}</span>
                <span className="w-44 shrink-0 truncate text-sm text-ink">{r.fullName}</span>
                <span className="w-56 shrink-0 truncate text-xs text-muted">{r.email ?? "--"}</span>
                <span className="w-32 shrink-0 truncate text-xs text-muted">{STAGE_LABEL[r.stage]}</span>
                <span
                  className={`flex-1 truncate text-xs ${
                    r.verdict === "import"
                      ? "text-muted"
                      : r.verdict === "missing_email"
                        ? "text-destructive"
                        : r.verdict === "duplicate"
                          ? "text-status-warning-text"
                          : "text-muted"
                  }`}
                >
                  {r.note}
                </span>
              </div>
            ))}
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <form action={action} className="flex items-center gap-3">
            <input type="hidden" name="intake_course_id" value={intakeCourseId} />
            <input type="hidden" name="source_filename" value={filename} />
            <input type="hidden" name="headers" value={JSON.stringify(headers)} />
            <input type="hidden" name="rows" value={JSON.stringify(rows)} />
            <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
            <input type="hidden" name="status_mapping" value={JSON.stringify(statusMapping)} />
            <button
              type="submit"
              disabled={pending || analysis.tallies.willImport === 0}
              className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Importing..." : `Import ${analysis.tallies.willImport} people`}
            </button>
            <button type="button" onClick={() => setStep("map")} className="text-sm text-muted hover:text-ink">
              Back to the mapping
            </button>
          </form>
          <p className="text-xs text-muted">
            {analysis.rows.length - analysis.tallies.willImport} row
            {analysis.rows.length - analysis.tallies.willImport === 1 ? " is" : "s are"} held back. Fix them in the
            sheet and run this again -- Connect matches on email and won&apos;t duplicate anyone it has already seen.
          </p>
        </div>
      ) : null}

      {currentStep === "after" ? (
        <div className="sheet flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-[22px] text-ink">Imported, and nobody has been emailed</h2>
            <p className="mt-1 text-sm text-muted">
              The pipeline now has {state.imported} more {state.imported === 1 ? "person" : "people"} in it, at the
              stages you chose. Not one of them has heard from Connect.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              {
                t: "No invitations were sent",
                d: "Imported people exist as records, not accounts. Inviting them is a separate, deliberate action you take when you're ready.",
                c: "border-l-destructive",
              },
              {
                t: "The import can be undone for seven days",
                d: "One button removes everything it created, provided nobody has been invited or paid since.",
                c: "border-l-gold",
              },
              {
                t: "It can be run again",
                d: "Fix the held-back rows in the original sheet and re-import. Connect matches on email and won't duplicate anyone.",
                c: "border-l-primary",
              },
              {
                t: "The spreadsheet still works",
                d: "Nothing was changed in it and nothing is syncing. Keep it running alongside for a course or two if you like.",
                c: "border-l-border",
              },
            ].map((p) => (
              <div key={p.t} className={`border-l-[3px] pl-3 ${p.c}`}>
                <p className="text-sm font-semibold text-ink">{p.t}</p>
                <p className="text-xs text-muted">{p.d}</p>
              </div>
            ))}
          </div>
          <Link href="/dashboard/admissions" className="text-sm text-primary hover:underline">
            Go to the pipeline &rarr;
          </Link>
        </div>
      ) : null}
    </div>
  );
}

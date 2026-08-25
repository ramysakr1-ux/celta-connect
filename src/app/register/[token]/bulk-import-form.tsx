"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addVolunteerStudentsBulk, type BulkImportState } from "@/app/register/[token]/actions";

const initialState: BulkImportState = { error: null, summary: null };

const TEMPLATE = "Name,Email,Level\nJane Doe,jane@example.com,B1\nJohn Smith,,A2\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "volunteer-students-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Ramy, 25 Aug 2026: "is that something that could be just connected to
// the drive... you're gonna have to tell me how." Landed on a one-time CSV
// upload rather than a live Google Drive sync -- export the sheet as CSV
// (File -> Download -> Comma Separated Values in Google Sheets) and upload
// it here. Same Name/Email/Level columns the single "Add student" form
// already collects, just many rows at once through the same code path.
export function BulkImportForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(addVolunteerStudentsBulk, initialState);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  }

  // Only clear the picked file once a submit has actually succeeded --
  // resetting on every submit would lose the selection if the import
  // errored, forcing them to re-pick the same file.
  useEffect(() => {
    if (!state.summary) return;
    const t = setTimeout(() => {
      setCsvText("");
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, 0);
    return () => clearTimeout(t);
  }, [state.summary]);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">Import a spreadsheet</summary>
      <form action={formAction} className="mt-3 flex flex-col items-start gap-2.5 border-t border-border-faint pt-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="csv" value={csvText} />
        <p className="text-xs text-muted">
          In Google Sheets: File → Download → Comma Separated Values (.csv). Columns: Name, Email (optional), Level
          (optional).
        </p>
        <button type="button" onClick={downloadTemplate} className="text-xs font-medium text-primary hover:underline">
          Download a template
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="text-sm text-ink file:mr-3 file:rounded-[6px] file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
        />
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state.summary ? <p className="text-sm text-ink">{state.summary}</p> : null}
        <button
          type="submit"
          disabled={pending || !csvText}
          className="h-10 rounded-[6px] bg-ink-warm px-4 text-sm font-semibold text-card disabled:opacity-60"
        >
          {pending ? `Importing${fileName ? ` ${fileName}` : ""}…` : "Import"}
        </button>
      </form>
    </details>
  );
}

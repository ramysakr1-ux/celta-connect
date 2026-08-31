"use client";

import { useActionState } from "react";
import { uploadCambridgeDocument, type CambridgeDocState } from "@/app/trainer/(hub)/resource-hub/cambridge-actions";
import type { CambridgeDocumentView } from "@/lib/cambridge-documents";

const initial: CambridgeDocState = { error: null };

interface DocRow extends CambridgeDocumentView {
  signedUrl: string | null;
}

// remaining-compliance.md §5: "One copy, read by every course. Visible to
// candidates, tutors, admins and the assessor alike." editable=false
// (trainee/assessor views) renders read-only; editable=true (staff with
// centre.settings.edit) shows the upload form per slot.
export function CambridgeDocumentsShelf({ docs, editable }: { docs: DocRow[]; editable: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {docs.map((doc) => (
        <DocCard key={doc.docType} doc={doc} editable={editable} />
      ))}
    </div>
  );
}

function DocCard({ doc, editable }: { doc: DocRow; editable: boolean }) {
  const [state, action, pending] = useActionState(uploadCambridgeDocument, initial);
  const hasDoc = Boolean(doc.signedUrl || doc.url);

  return (
    <div className="trainer-hover rounded-[6px] border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{doc.label}</p>
          <p className="text-xs text-muted">{doc.orgLevel && doc.scopeIsOrg ? "Organisation-wide -- one copy, every branch" : "This centre"}</p>
          {/* Where the answer actually came from. A slot filled by a hub
              upload, or by a section of another document, should say so --
              otherwise "Open" on the Appeals slot silently hands you the
              Handbook and looks like the wrong file. */}
          {doc.withinDocumentNote ? (
            <p className="mt-0.5 text-[11px] text-muted">{doc.withinDocumentNote}</p>
          ) : doc.fromHubTitle ? (
            <p className="mt-0.5 text-[11px] text-muted">{doc.fromHubTitle}</p>
          ) : null}
        </div>
        {hasDoc ? (
          <a
            href={doc.signedUrl ?? doc.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Open →
          </a>
        ) : (
          <span className="shrink-0 text-xs text-muted">Not uploaded</span>
        )}
      </div>
      {editable ? (
        <form action={action} className="mt-3 flex flex-col gap-2 border-t border-border-faint pt-3">
          <input type="hidden" name="doc_type" value={doc.docType} />
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" name="file" accept="application/pdf,image/*" className="text-xs text-muted" />
            <span className="text-xs text-muted">or</span>
            <input name="link" type="url" placeholder="Paste a link instead" className="h-8 min-w-[180px] flex-1 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary" />
            <button type="submit" disabled={pending} className="h-8 shrink-0 rounded-[6px] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">
              {pending ? "Saving…" : hasDoc ? "Replace" : "Upload"}
            </button>
          </div>
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { undoVolunteerImport, type UndoVolunteerImportState } from "@/app/centre/import/volunteer-actions";

const initial: UndoVolunteerImportState = {};

export function UndoVolunteerImportButton({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(undoVolunteerImport, initial);

  if (state.removed) {
    return <span className="text-xs text-muted">Removed {state.removed}</span>;
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove every volunteer this import created? Anyone who has already signed up is kept.")) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="import_id" value={importId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-xs font-medium text-ink hover:border-destructive hover:text-destructive disabled:opacity-60"
      >
        {pending ? "Undoing..." : "Undo this import"}
      </button>
      {state.error ? <p className="max-w-xs text-right text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

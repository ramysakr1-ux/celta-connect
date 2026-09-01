"use client";

import { useActionState } from "react";
import { undoImport, type UndoImportState } from "@/components/import/actions";

const initial: UndoImportState = {};

// Undo is destructive and bulk, so it asks first. The server re-checks the
// seven-day window and the invited/paid conditions regardless of what the
// button thinks -- this is a courtesy, not the guard.
export function UndoImportButton({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(undoImport, initial);

  if (state.removed) {
    return <span className="text-xs text-muted">Removed {state.removed}</span>;
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove everyone this import created? People invited or paid since are kept.")) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="import_id" value={importId} />
      <button
        type="submit"
        disabled={pending}
        className="admin-hover-fill rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-xs font-medium text-ink hover:border-destructive hover:text-destructive disabled:opacity-60"
      >
        {pending ? "Undoing..." : "Undo this import"}
      </button>
      {state.error ? <p className="max-w-xs text-right text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

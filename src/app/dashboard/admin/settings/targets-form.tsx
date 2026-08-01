"use client";

import { useActionState } from "react";
import { updateGoogleDriveTargets, type FormState } from "@/app/dashboard/admin/settings/actions";

const initialState: FormState = { error: null };

export function GoogleDriveTargetsForm({
  templateDocId,
  outputFolderId,
}: {
  templateDocId: string | null;
  outputFolderId: string | null;
}) {
  const [state, action, pending] = useActionState(updateGoogleDriveTargets, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="template_doc_id" className="text-sm text-muted">
          Template Google Doc ID
        </label>
        <input
          id="template_doc_id"
          name="template_doc_id"
          type="text"
          defaultValue={templateDocId ?? ""}
          placeholder="The long ID from the template doc's URL"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="output_folder_id" className="text-sm text-muted">
          Output Drive folder ID
        </label>
        <input
          id="output_folder_id"
          name="output_folder_id"
          type="text"
          defaultValue={outputFolderId ?? ""}
          placeholder="The folder where per-trainee CELTA5 copies will be created"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

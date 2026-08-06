"use client";

import { useActionState } from "react";
import { updateAdminGrant, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

export function AdminGrantForm({ record }: { record: Celta5Record }) {
  const [state, action, pending] = useActionState(updateAdminGrant, initialState);
  const granted = !!record.admin_access_granted_at;

  return (
    <form action={action} className="sheet flex flex-col gap-3 p-6">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <h2 className="font-serif text-lg text-ink">Admin access</h2>
      <p className="text-sm text-muted">
        Admin (centre business/admissions staff) has no access to this record by default.
        Grant it here only if there&apos;s a specific business reason to.
      </p>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="granted" defaultChecked={granted} />
        Grant admin access to this record
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Access level</label>
        <select
          name="access_level"
          defaultValue={record.admin_access_level ?? "read"}
          className="w-40 appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-center text-sm text-ink outline-none focus:border-primary"
        >
          <option value="read">Read-only</option>
          <option value="edit">Read and edit</option>
        </select>
      </div>

      {granted && record.admin_access_granted_at ? (
        <p className="text-xs text-muted">
          Granted {new Date(record.admin_access_granted_at).toLocaleString()}.
        </p>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

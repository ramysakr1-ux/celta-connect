"use client";

import { useState } from "react";
import { updateTpMaterialPoolEnabled } from "@/app/dashboard/admin/courses/[id]/roster-actions";

export function MaterialPoolToggleCard({ courseId, enabled }: { courseId: string; enabled: boolean }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        await updateTpMaterialPoolEnabled(formData);
        setPending(false);
      }}
      className="card flex items-center justify-between gap-4 p-6"
    >
      <div>
        <h2 className="font-serif text-lg text-ink">TP7/8 material pool</h2>
        <p className="mt-1 text-sm text-muted">
          {enabled
            ? "On -- TP7 and TP8 draw from the separate material pool instead of the main coursebook."
            : "Off -- candidates keep using the main coursebook for TP7 and TP8, same as every other round."}
        </p>
      </div>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Saving…" : enabled ? "Turn off" : "Turn on"}
      </button>
    </form>
  );
}

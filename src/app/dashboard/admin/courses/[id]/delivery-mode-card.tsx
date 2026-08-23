"use client";

import { useState } from "react";
import { updateDeliveryMode } from "@/app/dashboard/admin/courses/[id]/roster-actions";
import { DeliveryModePicker } from "@/components/delivery-mode-picker";
import { DELIVERY_MODE_LABEL, type DeliveryMode } from "@/lib/delivery-mode";

export function DeliveryModeCard({ courseId, savedMode }: { courseId: string; savedMode: DeliveryMode }) {
  const [mode, setMode] = useState<DeliveryMode>(savedMode);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="card card-gold flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-serif text-lg text-ink">Delivery mode</h2>
          <p className="mt-1 text-muted">{DELIVERY_MODE_LABEL[savedMode]}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <form action={updateDeliveryMode} className="card card-gold flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Delivery mode</h2>
        <p className="mt-1 text-sm text-muted">
          Asked once, read everywhere -- the timetable, observation log and pre-course task all read this
          field. Changing it after setup is a real change, not a cosmetic edit.
        </p>
      </div>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="delivery_mode" value={mode} />
      <DeliveryModePicker value={mode} onChange={setMode} />
      <div className="flex gap-3">
        <button type="submit" className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card">
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(savedMode);
            setEditing(false);
          }}
          className="self-start rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

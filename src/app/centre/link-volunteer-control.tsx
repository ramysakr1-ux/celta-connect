"use client";

import { useState, useTransition } from "react";
import { linkVolunteerAction } from "@/app/centre/actions";

export function LinkVolunteerControl({
  volunteerStudentId,
  options,
}: {
  volunteerStudentId: string;
  options: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (options.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-primary hover:underline">
        Same person as…
      </button>
    );
  }

  return (
    <select
      autoFocus
      disabled={pending}
      defaultValue=""
      onChange={(e) => {
        const otherId = e.target.value;
        if (!otherId) return;
        const fd = new FormData();
        fd.set("volunteer_student_id_a", volunteerStudentId);
        fd.set("volunteer_student_id_b", otherId);
        startTransition(async () => {
          await linkVolunteerAction(fd);
          setOpen(false);
        });
      }}
      onBlur={() => setOpen(false)}
      className="h-7 rounded-[6px] border border-border bg-card px-1.5 text-[11px] text-ink outline-none focus:border-primary"
    >
      <option value="" disabled>
        {pending ? "Linking…" : "Choose who…"}
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

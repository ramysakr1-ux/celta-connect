"use client";

import { useState, useTransition } from "react";
import { unlinkVolunteerAction } from "@/app/centre/actions";
import { LinkVolunteerControl } from "@/app/centre/link-volunteer-control";

export function VolunteerPoolRow({
  name,
  hours,
  members,
  canEdit,
  linkOptions,
}: {
  name: string;
  hours: number;
  members: { id: string; courseName: string }[];
  canEdit: boolean;
  linkOptions: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-b border-border-faint px-5 py-2.5 last:border-none">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-ink">{name}</span>
          {members.length > 1 ? (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-left text-[11px] text-primary hover:underline">
              Linked &middot; {members.length} courses {expanded ? "▲" : "▼"}
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-muted tabular-nums">{hours.toFixed(1)} hrs</span>
          {canEdit && members.length === 1 ? (
            <LinkVolunteerControl volunteerStudentId={members[0].id} options={linkOptions} />
          ) : null}
        </div>
      </div>

      {expanded && members.length > 1 ? (
        <div className="mt-2 flex flex-col gap-1 border-l-2 border-border-faint pl-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">{m.courseName}</span>
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("volunteer_student_id", m.id);
                    startTransition(async () => {
                      await unlinkVolunteerAction(fd);
                    });
                  }}
                  className="text-[11px] text-destructive hover:underline disabled:opacity-50"
                >
                  {pending ? "…" : "Unlink"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { unlinkVolunteerAction } from "@/app/centre/actions";
import { LinkVolunteerControl } from "@/app/centre/link-volunteer-control";
import { extractLevelCode, levelPillClass } from "@/lib/levels";

export function VolunteerPoolRow({
  name,
  hours,
  members,
  canEdit,
  linkOptions,
}: {
  name: string;
  hours: number;
  members: { id: string; courseName: string; level: string | null }[];
  canEdit: boolean;
  linkOptions: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  // Matches Volunteer Pool.dc.html exactly: the collapsed row always shows
  // one level tag + course code (the first/primary registration), never
  // every distinct level the person has -- per-member detail only appears
  // once expanded.
  const primary = members[0];

  return (
    <div className="border-b border-border-faint px-5 py-2.5 last:border-none">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <span className="text-sm text-ink">{name}</span>
          <LevelTag level={primary.level} courseName={primary.courseName} />
          {members.length > 1 ? (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-left text-[11px] font-semibold text-primary hover:underline">
              Linked &middot; {members.length} courses {expanded ? "▲" : "▼"}
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3.5">
          <span className="text-xs text-muted tabular-nums">{hours.toFixed(1)} hrs</span>
          {canEdit && members.length === 1 ? (
            <LinkVolunteerControl volunteerStudentId={members[0].id} options={linkOptions} />
          ) : null}
        </div>
      </div>

      {expanded && members.length > 1 ? (
        <div className="mt-1.5 flex flex-col gap-1.5 pl-[34px]">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <LevelTag level={m.level} courseName={m.courseName} />
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
                  className="text-[11px] font-semibold text-destructive hover:underline disabled:opacity-50"
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

function LevelTag({ level, courseName }: { level: string | null; courseName: string }) {
  return (
    <div className="flex items-center gap-[7px]">
      {level ? (
        <span className={`rounded-[4px] px-1.5 py-px text-[10px] font-bold ${levelPillClass(level)}`}>{extractLevelCode(level)}</span>
      ) : null}
      <span className="text-[11px] text-muted">{courseName}</span>
    </div>
  );
}

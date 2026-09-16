"use client";

import { useState, useTransition } from "react";
import { unlinkVolunteerAction } from "@/app/centre/actions";
import { LinkVolunteerControl } from "@/app/centre/link-volunteer-control";
import { extractLevelCode, levelPillClass } from "@/lib/levels";
import { Avatar } from "@/components/avatar";
import { ChevronDown } from "lucide-react";

export function VolunteerPoolRow({
  name,
  hours,
  active,
  members,
  canEdit,
  linkOptions,
}: {
  name: string;
  hours: number;
  // for-claude-code-volunteer-pool-header.md: the room's own colour while at
  // least one linked course is still running, muted grey once every one has
  // ended. Remainder pass A7: this was an inline oklch(35% 0.075 155) -- a
  // green that was neither the volunteer room's accent nor the platform's
  // teal, and the only place in the app it appeared.
  active: boolean;
  members: { id: string; courseName: string; level: string | null; nextClassStatus: "coming" | "declined" | "no_reply" | null }[];
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
    <div className="hover-ring border-b border-border-faint px-5 py-4 last:border-none">
      <div className="flex items-center justify-between gap-3">
        <Avatar name={name} size="sm" className="self-start" />
        <div className="flex flex-1 flex-col gap-[3px]">
          <span className="text-body text-ink">{name}</span>
          <div className="flex items-center gap-2">
            <LevelTag level={primary.level} courseName={primary.courseName} />
            <NextClassStatusTag status={primary.nextClassStatus} />
          </div>
          {members.length > 1 ? (
            // Remainder pass B7: the affordance was a "▲"/"▼" glyph at 11px,
            // the only text-arrow disclosure in the app. The shared chevron,
            // like every other one.
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex items-center gap-1 text-left text-label font-semibold text-primary hover:underline"
            >
              Linked &middot; {members.length} courses
              <ChevronDown
                aria-hidden="true"
                className={`size-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3.5">
          <span
            className="text-label font-semibold tabular-nums"
            style={{ color: active ? "var(--area-accent, var(--color-primary))" : "var(--color-muted)" }}
          >
            {hours.toFixed(1)} hrs
          </span>
          {canEdit && members.length === 1 ? (
            <LinkVolunteerControl volunteerStudentId={members[0].id} options={linkOptions} />
          ) : null}
        </div>
      </div>

      {expanded && members.length > 1 ? (
        <div className="mt-1.5 flex flex-col gap-1.5 pl-[34px]">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LevelTag level={m.level} courseName={m.courseName} />
                <NextClassStatusTag status={m.nextClassStatus} />
              </div>
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
                  className="text-label font-semibold text-destructive hover:underline disabled:opacity-50"
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
        <span className={`rounded-[4px] px-1.5 py-px text-micro font-bold ${levelPillClass(level)}`}>{extractLevelCode(level)}</span>
      ) : null}
      <span className="text-label text-muted">{courseName}</span>
    </div>
  );
}

// Ramy, 25 Aug 2026: "for the center, the names will be attached as well"
// -- the only place in the app that shows a per-volunteer name next to
// their next-class attendance status, rather than the trainer/trainee
// aggregate-only count.
function NextClassStatusTag({ status }: { status: "coming" | "declined" | "no_reply" | null }) {
  if (!status) return null;
  const colour =
    status === "coming"
      ? "var(--color-status-on-track-text)"
      : status === "declined"
        ? "var(--color-status-at-risk-text)"
        : "var(--color-muted)";
  return (
    <span className="text-label font-semibold" style={{ color: colour }}>
      {status === "coming" ? "Coming next class" : status === "declined" ? "Can't make next class" : "No reply yet"}
    </span>
  );
}

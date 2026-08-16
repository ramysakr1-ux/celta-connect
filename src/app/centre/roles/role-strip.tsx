"use client";

import { useState } from "react";
import { CENTRE_ROLES, CENTRE_ROLE_LABELS, type CentreRole } from "@/lib/auth/centre-permissions";

// The layout spec's role selector: one card-backed row of four equal segments,
// each with a 3px coloured top spine, and a permission list below for whichever
// is selected. Selecting is a visual state, not a route change.
type Grant = "yes" | "read" | "no";

interface RoleDetail {
  who: string;
  summary: string;
  tone: string; // text colour class
  spine: string; // top-spine background class
  band: string; // callout tint
  perms: { grant: Grant; text: string; note?: string }[];
  rule: string;
}

// Transcribed from the spec's own ROLES array rather than paraphrased.
const DETAIL: Record<CentreRole, RoleDetail> = {
  centre_administrator: {
    who: "runs admissions, payments and course setup",
    summary:
      "The working role. Creates courses, invites people, chases money, forms groups. Everything except grading and anything a tutor does inside a course.",
    tone: "text-primary",
    spine: "bg-primary",
    band: "bg-primary/8 border-primary/25",
    perms: [
      { grant: "yes", text: "Create and edit courses" },
      { grant: "yes", text: "Invite tutors, candidates, volunteers" },
      { grant: "yes", text: "See and edit fees, deposits, payments" },
      { grant: "yes", text: "Form groups and publish timetables" },
      { grant: "yes", text: "Export the assessor pack" },
      { grant: "no", text: "Course chat", note: "trainer-only, no admin exception" },
      { grant: "no", text: "Grade or mark anything" },
      { grant: "no", text: "See lesson feedback or CELTA 5 records" },
    ],
    rule: "A centre administrator who is also a registered tutor on a course gets that course's chat and grading — as a tutor, on that course. The two roles never merge into one set of powers.",
  },
  centre_manager: {
    who: "wants the numbers, changes nothing",
    summary:
      "Read-only across the whole centre. Built for the person who asks how many are enrolled and whether the January course will fill — so they can look instead of asking.",
    tone: "text-gold",
    spine: "bg-gold",
    band: "bg-gold/10 border-gold/30",
    perms: [
      { grant: "read", text: "Every course and its state" },
      { grant: "read", text: "The admissions pipeline" },
      { grant: "read", text: "Fees, deposits and outstanding balances" },
      { grant: "read", text: "Enrolment and completion figures" },
      { grant: "no", text: "Edit anything at all" },
      { grant: "no", text: "Invite or remove people" },
      { grant: "no", text: "Course chat" },
      { grant: "no", text: "Candidate work, feedback or grades" },
    ],
    rule: "The absence of an edit button everywhere is the whole design. A read-only role that hides its restrictions behind error messages is worse than no role at all — the buttons simply are not there.",
  },
  course_administrator: {
    who: "one or two courses, not the centre",
    summary:
      "Everything a centre administrator can do, scoped to named courses. Cambridge-approved — in practice the main course tutor or the course coordinator.",
    tone: "text-muted",
    spine: "bg-border",
    band: "bg-surface-muted border-border",
    perms: [
      { grant: "yes", text: "Edit their own courses" },
      { grant: "yes", text: "Invite people to their own courses" },
      { grant: "yes", text: "Chase payment on their own courses" },
      { grant: "read", text: "Other courses, in outline only" },
      { grant: "no", text: "Create a new course" },
      { grant: "no", text: "Change centre settings" },
      { grant: "no", text: "Course chat" },
      { grant: "no", text: "Grade or mark anything" },
    ],
    rule: "Scope is a list of courses, not a date range or a category. When somebody leaves, their courses are reassigned individually — which is deliberately a small chore, because it forces someone to notice what was theirs.",
  },
  centre_owner: {
    who: "the centre's own way back in",
    summary:
      "Oversight of everything in this centre, and nothing outside it. Held by the director, for when an administrator leaves without handing over or a course ends up with nobody attached to it.",
    tone: "text-destructive",
    spine: "bg-destructive",
    band: "bg-destructive/8 border-destructive/25",
    perms: [
      { grant: "yes", text: "Restore a deleted course within 30 days" },
      { grant: "yes", text: "Reassign a course with no administrator" },
      { grant: "yes", text: "Appoint and remove administrators" },
      { grant: "yes", text: "Centre settings, payments, admissions, volunteers", note: "every intervention is logged" },
      { grant: "read", text: "Course administration", note: "sees it, never changes it" },
      { grant: "no", text: "Create or edit a course", note: "that is course administration" },
      { grant: "no", text: "The course itself", note: "needs an invite from the course MCT" },
      { grant: "no", text: "Grade or mark anything" },
    ],
    rule: "The reach stops at the centre boundary. Nobody at Connect holds a key to a centre's courses, and there is no role above this one — a centre that hands over its grading needs to know the platform cannot quietly read it.",
  },
};

function Mark({ grant }: { grant: Grant }) {
  if (grant === "yes") return <span className="text-[oklch(48%_0.09_150)]">✓</span>;
  if (grant === "read") return <span className="text-muted">◑</span>;
  return <span className="text-muted">—</span>;
}

export function RoleStrip({ holders }: { holders: Record<string, { id: string; name: string }[]> }) {
  const [selected, setSelected] = useState<CentreRole>("centre_administrator");
  const detail = DETAIL[selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-border bg-card lg:grid-cols-4">
        {CENTRE_ROLES.map((role, i) => {
          const d = DETAIL[role];
          const active = role === selected;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelected(role)}
              className={`relative px-5 py-4 text-left ${i < CENTRE_ROLES.length - 1 ? "lg:border-r lg:border-border" : ""} ${
                active ? "bg-card" : "bg-surface-muted/40 hover:bg-card"
              }`}
            >
              <span className={`absolute inset-x-0 top-0 h-[3px] ${active ? d.spine : "bg-transparent"}`} aria-hidden="true" />
              <span className={`block text-[13.5px] font-bold ${d.tone}`}>{CENTRE_ROLE_LABELS[role]}</span>
              <span className="mt-0.5 block text-xs text-muted">{d.who}</span>
              {(holders[role] ?? []).length > 0 ? (
                <span className="mt-1.5 block text-[11px] text-ink">
                  {(holders[role] ?? []).map((h) => h.name).join(", ")}
                </span>
              ) : (
                <span className="mt-1.5 block text-[11px] text-muted">Nobody yet</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-[10px] border border-border bg-card px-5 py-4">
        <p className="text-sm text-ink">{detail.summary}</p>

        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {detail.perms.map((p) => (
            <div key={p.text} className="flex items-start gap-2.5 rounded-[6px] bg-surface-muted/60 px-3 py-2">
              <span className="mt-px shrink-0 text-sm">
                <Mark grant={p.grant} />
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] text-ink">{p.text}</span>
                {p.note ? <span className="text-[11px] text-muted">{p.note}</span> : null}
              </span>
            </div>
          ))}
        </div>

        <div className={`mt-4 rounded-[6px] border px-4 py-3 ${detail.band}`}>
          <p className="text-xs leading-relaxed text-ink">{detail.rule}</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { updateProvisionalGrade, approveProvisionalGrade, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { PROVISIONAL_SLOTS } from "@/lib/provisional-grade";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

// Derived, not re-listed: PROVISIONAL_SLOTS stays the one place a valid slot
// is defined, and is what the server action validates against. A slot added
// there lands in the right group here without anyone remembering to.
const STRAIGHT_GRADES = PROVISIONAL_SLOTS.filter((o) => !o.includes("/") && o !== "Withdrawn");
const BORDERLINE_GRADES = PROVISIONAL_SLOTS.filter((o) => o.includes("/"));

function Divider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />;
}

function SlotPill({
  opt,
  slot,
  setSlot,
  blockedReason,
}: {
  opt: string;
  slot: string;
  setSlot: (fn: (prev: string) => string) => void;
  blockedReason?: string | null;
}) {
  const selected = slot === opt;
  const blocked = Boolean(blockedReason);
  const [lower, upper] = opt.includes("/") ? opt.split("/") : [opt, null];
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={blocked}
      title={blockedReason ?? undefined}
      onClick={() => setSlot((prev) => (prev === opt ? "" : opt))}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
        blocked
          ? "cursor-not-allowed border-border-faint text-muted/50 line-through"
          : selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted trainer-hover-fill hover:text-ink"
      }`}
    >
      {lower}
      {upper ? (
        <>
          <span className={selected ? "mx-[3px] opacity-60" : "mx-[3px] opacity-45"}>/</span>
          {upper}
        </>
      ) : null}
    </button>
  );
}

function slotFromRecord(record: Celta5Record | null): string {
  if (!record?.provisional_grade) return "";
  return record.provisional_grade_upper
    ? `${record.provisional_grade}/${record.provisional_grade_upper}`
    : record.provisional_grade;
}

export function ProvisionalGradeForm({
  traineeId,
  record,
  proposedByName,
  proposedByMeta,
  isMct,
  eligibility,
}: {
  traineeId: string;
  record: Celta5Record | null;
  proposedByName: string | null;
  /**
   * The level this candidate's half is teaching now. Ramy, 30 Aug 2026:
   * "there's no group naming, there's the level of the group and the tutor
   * name" -- and "there's no group ABC, it's half a group."
   */
  proposedByMeta?: string | null;
  isMct: boolean;
  /** Grades this candidate's written assignments have ruled out, and why. */
  eligibility?: { blocked: string[]; reason: string | null };
}) {
  const [state, action, pending] = useActionState(updateProvisionalGrade, initialState);
  const [slot, setSlot] = useState(() => slotFromRecord(record));
  const [approvePending, startApprove] = useTransition();
  const approved = Boolean(record?.provisional_approved_at);

  return (
    <div className="flex flex-col gap-2 rounded-[6px] border border-border-faint p-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="trainee_id" value={traineeId} />
        <input type="hidden" name="provisional_slot" value={slot} />
        {/* Eight options in one undifferentiated row wrapped onto two lines
            and read as mush -- Ramy, 30 Aug 2026, reciting it back: "fail
            pass, fail pass pass, pass b pass pass a withdrawn. Why is it
            messy?"

            They are not eight equal things. Four are grades, three are the
            borderlines BETWEEN consecutive grades, and Withdrawn is not a
            grade at all. So the row is grouped that way, the label moves out
            of the row to give the options the full width, and the slash in a
            paired option is dimmed so "Pass B/Pass A" reads as one token
            rather than two grades sitting next to each other. */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Provisional grade</span>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] border border-border px-3 py-1 text-[13px] text-ink trainer-hover-fill disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          {STRAIGHT_GRADES.map((opt) => (
            <SlotPill key={opt} opt={opt} slot={slot} setSlot={setSlot} blockedReason={eligibility?.blocked.includes(opt) ? eligibility.reason : null} />
          ))}
          <Divider />
          {BORDERLINE_GRADES.map((opt) => (
            <SlotPill key={opt} opt={opt} slot={slot} setSlot={setSlot} blockedReason={eligibility?.blocked.includes(opt) ? eligibility.reason : null} />
          ))}
          <Divider />
          <SlotPill opt="Withdrawn" slot={slot} setSlot={setSlot} blockedReason={eligibility?.blocked.includes("Withdrawn") ? eligibility.reason : null} />
        </div>
        {/* Says WHY, rather than leaving a struck-through pill unexplained.
            Cambridge's rule caps what may be recommended; it never says which
            grade is right, so nothing is chosen here -- the options that are
            not available are simply not available, and the reason is on the
            screen rather than in a tooltip alone. */}
        {eligibility?.reason ? (
          <p className="text-[11.5px] leading-relaxed text-status-warning-text">{eligibility.reason}</p>
        ) : null}
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>

      {record?.provisional_grade ? (
        <div className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint bg-surface-muted/40 px-3 py-2">
          <span className="text-xs text-ink">
            {proposedByName ? `Proposed by ${proposedByName}` : "Proposed"}
            {proposedByMeta ? ` · ${proposedByMeta}` : ""}
          </span>
          {isMct ? (
            <button
              type="button"
              disabled={approved || approvePending}
              onClick={() => {
                const fd = new FormData();
                fd.set("trainee_id", traineeId);
                startApprove(async () => {
                  await approveProvisionalGrade(fd);
                });
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold disabled:cursor-default ${
                approved ? "bg-primary/10 text-primary" : "bg-status-warning-bg text-status-warning-text hover:bg-status-warning-bg/80"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {approvePending ? "Confirming…" : approved ? "Confirmed by the MCT" : "Awaiting MCT confirmation — confirm"}
            </button>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                approved ? "bg-primary/10 text-primary" : "bg-status-warning-bg text-status-warning-text"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {approved ? "Confirmed by the MCT" : "Awaiting MCT confirmation"}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createCourse, type FormState } from "@/app/dashboard/admin/actions";
import { DeliveryModePicker } from "@/components/delivery-mode-picker";
import { TUTOR_ROLE_LABEL, DEFAULT_INVITE_TUTOR_ROLE } from "@/lib/tutor-roles";
import type { DeliveryMode } from "@/lib/delivery-mode";

const initialState: FormState = { error: null };

const field =
  "h-10 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const MODE_LABEL: Record<DeliveryMode, string> = {
  f2f: "Face-to-face",
  online: "Fully online",
  mixed: "Mixed — input online, TP in person",
};

/**
 * The new-course wizard -- exactly 5 steps
 * (for-claude-code-course-admin-final-scope.md): course details, delivery
 * mode, confirm dates/pattern, assign your first tutor (+ optionally name
 * an assessor), review and launch.
 *
 * "Capacity and pricing" (the old step 4) is cut entirely -- pricing is a
 * centre-level concern per that spec, not something set per course while
 * setting one up. courses.fee_amount etc. still exist and still feed the
 * offer email, but they're now set from Centre Admin's own per-course view
 * (see src/app/centre/courses/[id]/pricing-form.tsx), not gathered here.
 *
 * One <form>, five panels. Every field stays mounted while other steps show,
 * so moving back and forth never loses anything and the whole course is
 * created in a single submit at step 5 — "Launch course" is the submit, and
 * launching is what opens the course to invites.
 *
 * The design's own escape hatches are kept: tutors (and the assessor) can
 * be skipped at step 4. Only step 1's name and dates are required, because
 * a course record without them is not a course.
 */
export function CreateCourseForm({ centerNumber }: { centerNumber?: string | null }) {
  const [state, action, pending] = useActionState(createCourse, initialState);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("f2f");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [daysOff, setDaysOff] = useState<string[]>([]);

  // Step 5's review reads live field values without controlled inputs
  // everywhere: cheap summary state, set as the user leaves each step.
  const [summary, setSummary] = useState<Record<string, string>>({});

  function captureStep(form: HTMLFormElement | null) {
    if (!form) return;
    const g = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
    setSummary({
      code: g("course_code"),
      name: g("name"),
      dates: g("start_date") && g("end_date") ? `${g("start_date")} – ${g("end_date")}` : "",
      cohort: g("cohort_size"),
      inviteEmail: g("invite_email"),
      assessorName: g("assessor_name"),
    });
  }

  const eyebrow = `New course${centerNumber ? ` · ${centerNumber}` : ""}`;

  // Element helpers, not components -- lint is right that defining components
  // inside render recreates their type every pass, which remounts the subtree.
  // These return elements directly, so nothing remounts.
  const stepHeader = (n: number, title: string, blurb: string) => (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
        {eyebrow} · step {n} of 5
      </p>
      <h3 className="font-serif text-[22px] font-semibold text-ink">{title}</h3>
      <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-muted">{blurb}</p>
    </div>
  );

  const nav = (next: 1 | 2 | 3 | 4 | 5, label: string) => (
    <button
      type="button"
      onClick={(e) => {
        captureStep(e.currentTarget.form);
        setStep(next);
      }}
      className="self-start rounded-[6px] bg-primary px-[15px] py-2 text-[13px] font-semibold text-primary-foreground"
    >
      {label}
    </button>
  );

  const back = (prev: 1 | 2 | 3 | 4) => (
    <button type="button" onClick={() => setStep(prev)} className="text-sm text-muted underline">
      Back
    </button>
  );

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      {/* Step 1 — course details */}
      <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
        {stepHeader(1, "Course details", "The centre number and course code print on every certificate and report — get them right here.")}

        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-ink">Cambridge centre number</label>
          <p className="text-sm text-ink">{centerNumber ?? "Not set"}</p>
          <p className="text-xs text-muted">
            Prefilled from the centre profile and locked here — change it in Centre Management, not per course.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="course_code" className="text-[13px] font-semibold text-ink">
            Course code
          </label>
          <input id="course_code" name="course_code" type="text" placeholder="C3/2024" className={field} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-[13px] font-semibold text-ink">
            Course name (internal, candidates don&apos;t see this)
          </label>
          <input id="name" name="name" type="text" required placeholder="January intensive 2024" className={field} />
        </div>

        <div className="grid grid-cols-2 gap-[14px]">
          <div className="flex flex-col gap-1">
            <label htmlFor="start_date" className="text-[13px] font-semibold text-ink">
              Start date
            </label>
            <input id="start_date" name="start_date" type="date" required className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="end_date" className="text-[13px] font-semibold text-ink">
              End date
            </label>
            <input id="end_date" name="end_date" type="date" required className={field} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cohort_size" className="text-[13px] font-semibold text-ink">
            Maximum cohort size
          </label>
          <input
            id="cohort_size"
            name="cohort_size"
            type="number"
            min="1"
            placeholder="12 candidates"
            className={`${field} w-40`}
          />
        </div>

        {nav(2, "Continue to delivery mode")}
      </div>

      {/* Step 2 — delivery mode */}
      <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
        {stepHeader(2, "How is teaching practice delivered?", "The mode is defined by where teaching practice happens, not where input happens. A course can deliver input online and still be face-to-face.")}
        <input type="hidden" name="delivery_mode" value={deliveryMode} />
        <DeliveryModePicker value={deliveryMode} onChange={setDeliveryMode} />
        <div className="flex items-center gap-3">
          {nav(3, "Continue to dates and pattern")}
          {back(1)}
        </div>
      </div>

      {/* Step 3 — dates and timetable pattern */}
      <div className={step === 3 ? "flex flex-col gap-4" : "hidden"}>
        {stepHeader(3, "Confirm dates and weekly pattern", "This pattern seeds the timetable-tile system — the same tiles trainers drag and admins edit later in Run a course.")}

        <div className="grid grid-cols-2 gap-[14px]">
          <div className="flex flex-col gap-1">
            <label htmlFor="input_start_time" className="text-[13px] font-semibold text-ink">
              Weekday input starts
            </label>
            <input id="input_start_time" name="input_start_time" type="time" defaultValue="09:30" className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tp_start_time" className="text-[13px] font-semibold text-ink">
              TP block starts
            </label>
            <input id="tp_start_time" name="tp_start_time" type="time" defaultValue="13:00" className={field} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">Days off</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = daysOff.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysOff((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {daysOff.map((d) => (
            <input key={d} type="hidden" name="days_off" value={d} />
          ))}
        </div>

        {/* Informational notice, not urgent -- muted per the colour legend. */}
        <div className="rounded-[6px] border border-border bg-surface-muted px-[15px] py-[13px]">
          <p className="text-[13px] font-semibold text-muted">Tiles, not a blank calendar</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink">
            Confirming here generates the timetable tiles automatically. Tiles can be moved individually
            afterwards without altering the pattern.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {nav(4, "Continue to tutors")}
          {back(2)}
        </div>
      </div>

      {/* Step 4 — assign tutors + optionally name an assessor */}
      <div className={step === 4 ? "flex flex-col gap-4" : "hidden"}>
        {stepHeader(4, "Assign your first tutor", "Every course needs a Main Course Tutor before it can launch. Add more tutors any time afterwards from the roster.")}

        <div className="grid grid-cols-[1fr_auto] gap-[14px]">
          <div className="flex flex-col gap-1">
            <label htmlFor="invite_email" className="text-[13px] font-semibold text-ink">
              Email
            </label>
            <input id="invite_email" name="invite_email" type="email" placeholder="tutor@email.com" className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="invite_tutor_role" className="text-[13px] font-semibold text-ink">
              Role
            </label>
            <select id="invite_tutor_role" name="invite_tutor_role" defaultValue={DEFAULT_INVITE_TUTOR_ROLE} className={field}>
              {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">Same role picker as the roster — the role travels with the invitation.</p>

        {/* for-claude-code-course-admin-refinements.md: "name the assessor
            now, or decide later." Never a hard requirement -- nobody really
            knows the assessment date this early anyway. If named, the MCT
            gets notified with this contact info once they're actually on
            the course. */}
        <div className="grid grid-cols-2 gap-[14px] border-t border-border-faint pt-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="assessor_name" className="text-[13px] font-semibold text-ink">
              Assessor (optional)
            </label>
            <input id="assessor_name" name="assessor_name" type="text" placeholder="Name" className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="assessor_email" className="text-[13px] font-semibold text-ink">
              Assessor email
            </label>
            <input id="assessor_email" name="assessor_email" type="email" placeholder="assessor@cambridge.org" className={field} />
          </div>
        </div>
        <p className="text-xs text-muted">Leave blank to decide later -- the MCT can set this themselves once known.</p>

        <div className="flex items-center gap-3">
          {nav(5, "Continue to review")}
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.form;
              const el = form?.elements.namedItem("invite_email") as HTMLInputElement | null;
              if (el) el.value = "";
              captureStep(form);
              setStep(5);
            }}
            className="text-sm text-muted underline"
          >
            Skip — I&apos;ll assign a tutor later
          </button>
          {back(3)}
        </div>
      </div>

      {/* Step 5 — review and launch */}
      <div className={step === 5 ? "flex flex-col gap-4" : "hidden"}>
        {stepHeader(5, "Review before launch", "Launch opens the course to invites. Once launched, this course moves to Centre home and its Invitations panel becomes active.")}

        <div className="overflow-hidden rounded-[6px] border border-border">
          {[
            ["Course", [centerNumber, summary.code, summary.name].filter(Boolean).join(" · ") || "—"],
            ["Dates", summary.dates || "—"],
            ["Delivery", MODE_LABEL[deliveryMode]],
            ["Capacity", summary.cohort ? `${summary.cohort} candidates` : "—"],
            ["Tutors", summary.inviteEmail ? `${summary.inviteEmail} — invited at launch` : "None yet — assign from the roster"],
            ["Assessor", summary.assessorName || "Not named yet -- the MCT can set this later"],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[128px_1fr] gap-3 border-b border-border-faint px-4 py-3 text-sm last:border-none">
              <span className="font-semibold text-muted">{label}</span>
              <span className="text-ink">{value}</span>
            </div>
          ))}
        </div>

        <input type="hidden" name="launch" value="1" />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] bg-primary px-[15px] py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Launching…" : "Launch course"}
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-sm text-muted underline">
            Back to edit
          </button>
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

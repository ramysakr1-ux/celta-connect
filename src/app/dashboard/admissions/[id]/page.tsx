import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmissionsHandler, canDecideAdmissions } from "@/lib/admissions-access";
import { createClient } from "@/lib/supabase/server";
import { bookInterviewSlot } from "@/app/dashboard/admissions/actions";
import { MarkingForm } from "@/app/dashboard/admissions/[id]/marking-form";
import { InterviewRecordForm } from "@/app/dashboard/admissions/[id]/interview-record-form";
import { RejectForm } from "@/app/dashboard/admissions/[id]/reject-form";
import { OfferForm } from "@/app/dashboard/admissions/[id]/offer-form";
import { FeeTrackingForm } from "@/app/dashboard/admissions/[id]/fee-tracking-form";
import { WaitingListForm } from "@/app/dashboard/admissions/[id]/waiting-list-form";

export default async function ApplicantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireAdmissionsHandler();
  const { id } = await params;
  const supabase = await createClient();

  const { data: applicant } = await supabase.from("applicants").select("*").eq("id", id).maybeSingle();
  if (!applicant || applicant.center_id !== staff.center_id) notFound();

  const [{ data: intake }, { data: prompt }, { data: bookedSlot }, { data: openSlots }, { data: questions }, { data: interviewRecord }] =
    await Promise.all([
      supabase.from("courses").select("name, delivery_mode").eq("id", applicant.intake_course_id).maybeSingle(),
      applicant.writing_task_prompt_id
        ? supabase.from("application_writing_prompts").select("prompt_type, prompt_text").eq("id", applicant.writing_task_prompt_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("interview_slots").select("*").eq("booked_applicant_id", id).maybeSingle(),
      supabase
        .from("interview_slots")
        .select("id, slot_date, slot_time, mode, panel")
        .eq("center_id", staff.center_id)
        .eq("intake_course_id", applicant.intake_course_id)
        .is("booked_applicant_id", null)
        .order("slot_date"),
      supabase.from("interview_questions").select("id, question_text, coverage_area").eq("center_id", staff.center_id).eq("active", true),
      supabase.from("interview_records").select("*").eq("applicant_id", id).maybeSingle(),
    ]);

  const canDecide = canDecideAdmissions(staff);
  const isRejected = applicant.stage === "rejected_before_interview" || applicant.stage === "rejected_after_interview";
  const hasOffer = applicant.stage === "offer_sent" || applicant.stage === "accepted";
  const isWaitingList = applicant.stage === "waiting_list";
  const isSettled = isRejected || hasOffer || isWaitingList || applicant.stage === "not_this_time" || applicant.stage === "withdrawn_application";

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <Link href="/dashboard/admissions" className="text-sm text-muted hover:text-ink">
          &larr; Admissions
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl text-ink">{applicant.full_name}</h1>
            <p className="mt-1 text-sm text-muted">
              {applicant.email} &middot; Applying for {intake?.name ?? "--"}
            </p>
          </div>
          <span className="status-pill status-pill-pending">{applicant.stage.replaceAll("_", " ")}</span>
        </div>
      </div>

      {isRejected ? (
        <div className="card p-6">
          <p className="text-sm font-semibold text-ink">Rejected {applicant.rejected_at?.slice(0, 10)}</p>
          <p className="mt-1 text-sm text-ink">{applicant.rejection_reason}</p>
        </div>
      ) : null}

      <div className="card flex flex-col gap-3 p-6">
        <h2 className="font-serif text-lg text-ink">Application</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Date of birth</dt>
            <dd className="text-sm text-ink">{applicant.date_of_birth ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Phone</dt>
            <dd className="text-sm text-ink">{applicant.phone ?? "--"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Education</dt>
            <dd className="text-sm text-ink whitespace-pre-wrap">{applicant.education_summary ?? "--"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">ELT experience</dt>
            <dd className="text-sm text-ink whitespace-pre-wrap">{applicant.elt_experience_summary ?? "--"}</dd>
          </div>
          {applicant.special_requirements ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Special requirements</dt>
              <dd className="text-sm text-ink whitespace-pre-wrap">{applicant.special_requirements}</dd>
            </div>
          ) : null}
          {applicant.cannot_attend_note ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Can&apos;t attend</dt>
              <dd className="text-sm text-ink whitespace-pre-wrap">{applicant.cannot_attend_note}</dd>
            </div>
          ) : null}
          {applicant.anything_else ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Anything else</dt>
              <dd className="text-sm text-ink whitespace-pre-wrap">{applicant.anything_else}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="card flex flex-col gap-3 p-6">
        <h2 className="font-serif text-lg text-ink">Extended writing task</h2>
        {prompt ? (
          <p className="text-xs text-muted">
            {prompt.prompt_type[0].toUpperCase() + prompt.prompt_type.slice(1)}: {prompt.prompt_text}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm text-ink">{applicant.writing_task_submission ?? "--"}</p>

        <h3 className="mt-2 text-sm font-semibold text-ink">Language awareness</h3>
        {(applicant.language_awareness_submission ?? []).map((qa, i) => (
          <div key={i}>
            <p className="text-xs text-muted">{qa.question}</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{qa.answer}</p>
          </div>
        ))}
      </div>

      <MarkingForm applicant={applicant} />

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Interview</h2>
        {bookedSlot ? (
          <p className="text-sm text-ink">
            Booked: {bookedSlot.slot_date} {bookedSlot.slot_time} ({bookedSlot.mode === "online" ? "Online" : "Face to face"}
            {bookedSlot.panel ? ", panel" : ""})
          </p>
        ) : (openSlots ?? []).length > 0 ? (
          <form action={bookInterviewSlot} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="applicant_id" value={applicant.id} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slot_id" className="text-xs text-muted">
                Book a slot
              </label>
              <select id="slot_id" name="slot_id" required className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink">
                {(openSlots ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.slot_date} {s.slot_time} ({s.mode === "online" ? "Online" : "Face to face"}
                    {s.panel ? ", panel" : ""})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
              Book
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">
            No open slots for this intake yet.{" "}
            <Link href="/dashboard/admissions" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </p>
        )}

        {bookedSlot ? (
          <InterviewRecordForm
            applicantId={applicant.id}
            slotId={bookedSlot.id}
            questions={questions ?? []}
            existingRecord={interviewRecord ?? null}
          />
        ) : null}
      </div>

      {hasOffer ? (
        <>
          <div className="card p-6">
            <h2 className="font-serif text-lg text-ink">Offer</h2>
            <p className="mt-1 text-sm text-ink">
              Sent {applicant.offer_sent_at?.slice(0, 10)}, accept by {applicant.offer_accept_by}.
              {applicant.fee_amount ? ` Fee: ${applicant.fee_amount} ${applicant.fee_currency}.` : ""}
            </p>
          </div>
          <FeeTrackingForm applicant={applicant} />
        </>
      ) : null}

      {isWaitingList ? (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Waiting list</h2>
          <p className="mt-1 text-sm text-ink">
            Position {applicant.waiting_list_position}. Will hear by {applicant.waiting_list_hear_by}.
          </p>
        </div>
      ) : null}

      {canDecide && !isSettled ? (
        <>
          <OfferForm applicantId={applicant.id} />
          <WaitingListForm applicantId={applicant.id} />
          <RejectForm applicantId={applicant.id} />
        </>
      ) : null}
    </div>
  );
}

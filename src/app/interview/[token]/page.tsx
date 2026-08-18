import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import { getPickerTimeOptions, hasBookableOption, flagNoInterviewSlots } from "@/lib/interview-slot-picker";
import { SlotPicker } from "@/app/interview/[token]/slot-picker";

const TERMINAL_STAGES = new Set([
  "rejected_before_interview",
  "rejected_after_interview",
  "waiting_list",
  "not_this_time",
  "withdrawn_application",
]);

// Ramy, 2026-08-18: "every interview invite -- any lane -- sends the same
// picker link... the applicant always picks their own time, nothing is
// auto-booked on their behalf." Public, unauthenticated, keyed by
// interview_invite_token -- same shape as /offer/[token]. "No hard expiry
// on the invite itself; it's always valid. What runs out is which slots
// are still pickable, not the invitation" -- so this never checks a
// deadline, only whether there's anything left to pick.
export default async function InterviewPickerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: applicant } = await admin
    .from("applicants")
    .select("id, full_name, center_id, intake_course_id, stage")
    .eq("interview_invite_token", token)
    .maybeSingle();

  if (!applicant || TERMINAL_STAGES.has(applicant.stage)) {
    return (
      <Shell>
        <p className="mt-4 text-sm text-destructive">
          This link is invalid, or is no longer active. Contact the centre if you believe this is a mistake.
        </p>
      </Shell>
    );
  }

  const [{ data: course }, { data: center }] = await Promise.all([
    admin.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle(),
    admin.from("centers").select("name").eq("id", applicant.center_id).maybeSingle(),
  ]);

  if (applicant.stage === "interview_booked") {
    const { data: bookedSlot } = await admin
      .from("interview_slots")
      .select("slot_date, slot_time, mode")
      .eq("booked_applicant_id", applicant.id)
      .maybeSingle();
    return (
      <Shell>
        <p className="mt-4 text-sm text-ink">
          {applicant.full_name}, you&apos;re booked in{bookedSlot ? "" : " -- we'll confirm the details by email"}.
        </p>
        {bookedSlot ? (
          <p className="mt-2 text-sm text-ink">
            {new Date(`${bookedSlot.slot_date}T${bookedSlot.slot_time}`).toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            ({bookedSlot.mode === "online" ? "online" : "in person"}).
          </p>
        ) : null}
      </Shell>
    );
  }

  const options = await getPickerTimeOptions(admin, { centerId: applicant.center_id, intakeCourseId: applicant.intake_course_id });
  const bookable = hasBookableOption(options);
  if (!bookable) {
    await flagNoInterviewSlots(admin, { applicantId: applicant.id, centerId: applicant.center_id, applicantName: applicant.full_name });
  }

  return (
    <Shell>
      <p className="mt-4 text-sm text-ink">
        {applicant.full_name}, thank you for the written tasks — we have read them and we would like to meet you
        {course ? ` about ${course.name}` : ""}.
      </p>
      <p className="mt-2 text-sm text-muted">The interview takes about 45 minutes. There is nothing to prepare.</p>

      {bookable ? (
        <SlotPicker token={token} options={options} />
      ) : (
        <p className="mt-4 rounded-[6px] border border-dashed border-border p-4 text-sm text-muted">
          We&apos;re still finding you a time — check back shortly, or reply to the invitation email and we&apos;ll
          write as soon as one opens up.
        </p>
      )}
      {center ? <p className="mt-6 text-xs text-muted">{center.name}</p> : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="sheet-gold w-full max-w-sm p-8">
        <Wordmark size="hero" />
        {children}
      </div>
    </div>
  );
}

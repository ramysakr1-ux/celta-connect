import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmissionsHandler, canDecideAdmissions } from "@/lib/admissions-access";
import { createClient } from "@/lib/supabase/server";
import { bookInterviewSlot, sendInterviewInviteManually } from "@/app/dashboard/admissions/actions";
import { MarkingForm } from "@/app/dashboard/admissions/[id]/marking-form";
import { AiReadingPanel } from "@/app/dashboard/admissions/[id]/ai-reading-panel";
import { InterviewRecordForm } from "@/app/dashboard/admissions/[id]/interview-record-form";
import { RejectForm } from "@/app/dashboard/admissions/[id]/reject-form";
import { OfferForm } from "@/app/dashboard/admissions/[id]/offer-form";
import { PaymentsPanel } from "@/app/dashboard/admissions/[id]/payments-panel";
import { EmailHistoryPanel } from "@/app/dashboard/admissions/[id]/email-history-panel";
import { DepositForm } from "@/app/dashboard/admissions/[id]/deposit-form";
import { ReleaseWorkspaceForm } from "@/app/dashboard/admissions/[id]/release-workspace-form";
import { computeApplicantPaymentState } from "@/lib/payments/applicant-payment-state";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { areaVerdict } from "@/lib/auth/areas";
import { getAreaHolders } from "@/lib/auth/area-holders";
import { AreaAction } from "@/components/area-action";
import { WaiverForm } from "@/app/dashboard/admissions/[id]/waiver-form";
import { WaitingListForm } from "@/app/dashboard/admissions/[id]/waiting-list-form";
import { ReferForm, type ReferDestination } from "@/app/dashboard/admissions/[id]/refer-form";
import { RequestReferralForm } from "@/app/dashboard/admissions/[id]/request-referral-form";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ApplicantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireAdmissionsHandler();
  const { id } = await params;
  const supabase = await createClient();

  const { data: applicant } = await supabase.from("applicants").select("*").eq("id", id).maybeSingle();
  if (!applicant || applicant.center_id !== staff.center_id) notFound();

  const [
    { data: intake },
    { data: prompt },
    { data: speakingPrompt },
    { data: bookedSlot },
    { data: openSlots },
    { data: questions },
    { data: interviewRecord },
  ] = await Promise.all([
      supabase.from("courses").select("name, delivery_mode").eq("id", applicant.intake_course_id).maybeSingle(),
      applicant.writing_task_prompt_id
        ? supabase.from("application_writing_prompts").select("prompt_type, prompt_text").eq("id", applicant.writing_task_prompt_id).maybeSingle()
        : Promise.resolve({ data: null }),
      applicant.speaking_task_prompt_id
        ? supabase.from("speaking_task_prompts").select("prompt_text").eq("id", applicant.speaking_task_prompt_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("interview_slots").select("*").eq("booked_applicant_id", id).maybeSingle(),
      supabase
        .from("interview_slots")
        .select("id, slot_date, slot_time, mode, panel, interviewer_id")
        .eq("center_id", staff.center_id)
        .eq("intake_course_id", applicant.intake_course_id)
        .is("booked_applicant_id", null)
        .order("slot_date"),
      supabase.from("interview_questions").select("id, question_text, coverage_area").eq("center_id", staff.center_id).eq("active", true),
      supabase.from("interview_records").select("*").eq("applicant_id", id).maybeSingle(),
    ]);

  const speakingAudioSignedUrl = applicant.speaking_task_audio_url
    ? (await supabase.storage.from("applicant-speaking-task-audio").createSignedUrl(applicant.speaking_task_audio_url, 3600)).data?.signedUrl ?? null
    : null;

  const { data: paymentPlan } = await supabase.from("payment_plans").select("id, total_amount").eq("applicant_id", id).maybeSingle();
  const { data: payments } = paymentPlan
    ? await supabase.from("payments").select("*").eq("payment_plan_id", paymentPlan.id)
    : { data: [] };

  // All Emails.dc.html: applicant_emails already tracks all 19 email types
  // with real delivery state (migration 0108/0113, populated by the Resend
  // webhook) -- nothing on this page read it. First real surface for it.
  const { data: emailHistory } = await supabase
    .from("applicant_emails")
    .select("*")
    .eq("applicant_id", id)
    .order("created_at", { ascending: false });

  // The four states: not paid / deposit paid / paying instalments / paid in
  // full. Derived from the deposit plus the plan, never stored -- a stored
  // status is a second source of truth that drifts the moment an instalment is
  // marked paid somewhere else.
  const paymentState = computeApplicantPaymentState({
    depositPaidAt: applicant.deposit_paid_at,
    depositAmount: applicant.deposit_amount,
    instalments: (payments ?? []).map((p) => ({ amount: Number(p.amount), status: p.status })),
    planTotal: paymentPlan ? Number(paymentPlan.total_amount) : null,
  });
  const { data: depositMarkedBy } = applicant.deposit_marked_by
    ? await supabase.from("profiles").select("full_name").eq("id", applicant.deposit_marked_by).maybeSingle()
    : { data: null };
  const depositMarkedByName = depositMarkedBy?.full_name ?? null;

  const { data: releasedBy } = applicant.workspace_released_by
    ? await supabase.from("profiles").select("full_name").eq("id", applicant.workspace_released_by).maybeSingle()
    : { data: null };
  const releasedByName = releasedBy?.full_name ?? null;

  // build-spec.md §11: whose job this actually is. Areas only apply to the
  // admin family -- a trainer handling admissions isn't in the area model at
  // all, so they see the controls their role already allows.
  const centreCtx = staff.role === "admin" ? await getCentreRoleContext(staff) : null;
  const areaHolders = centreCtx ? await getAreaHolders(centreCtx.activeCenterId ?? staff.center_id) : new Map();
  const offerVerdict = centreCtx
    ? areaVerdict({ area: "admissions", viewerProfileId: staff.id, roles: centreCtx.roles, holders: areaHolders })
    : ({ kind: "act" } as const);
  const paymentVerdict = centreCtx
    ? areaVerdict({ area: "payments", viewerProfileId: staff.id, roles: centreCtx.roles, holders: areaHolders })
    : ({ kind: "act" } as const);

  // build-spec.md §14 -- only offered when the viewer already holds
  // admissions (centre_administrator or centre_owner) at a sibling branch
  // in the same organisation. Nothing here is trusted by the action itself
  // (referApplicantAction re-checks), this only decides what's shown.
  //
  // "One person holding admissions at both branches refers in a single
  // action. Where nobody spans the two, it becomes a request the receiving
  // branch accepts." requestDestinations names the sibling branches the
  // viewer does NOT already qualify for direct referral to -- those get the
  // request form (RequestReferralForm) instead of the instant one.
  let referDestinations: ReferDestination[] = [];
  let requestDestinations: { centerId: string; centerName: string }[] = [];
  let existingRequest: {
    id: string;
    status: string;
    toCenterName: string;
    requestedAt: string;
    declineReason: string | null;
  } | null = null;
  if (staff.role === "admin" && !applicant.referred_to_center_id) {
    const admin = createAdminClient();
    const { data: ownCentre } = await admin.from("centers").select("organisation_id").eq("id", staff.center_id).maybeSingle();
    if (ownCentre?.organisation_id) {
      const [{ data: grants }, { data: siblingCentres }] = await Promise.all([
        admin
          .from("centre_roles")
          .select("center_id")
          .eq("profile_id", staff.id)
          .is("revoked_at", null)
          .in("role", ["centre_administrator", "centre_owner"])
          .neq("center_id", staff.center_id),
        admin.from("centers").select("id, name").eq("organisation_id", ownCentre.organisation_id).neq("id", staff.center_id),
      ]);
      const siblingNameById = new Map((siblingCentres ?? []).map((c) => [c.id, c.name]));
      const qualifyingCenterIds = [...new Set((grants ?? []).map((g) => g.center_id))].filter((id) => siblingNameById.has(id));
      if (qualifyingCenterIds.length > 0) {
        const { data: siblingCourses } = await admin.from("courses").select("id, name, center_id").in("center_id", qualifyingCenterIds).order("start_date", { ascending: false });
        referDestinations = (siblingCourses ?? []).map((c) => ({
          centerId: c.center_id,
          centerName: siblingNameById.get(c.center_id) ?? "Unknown branch",
          courseId: c.id,
          courseName: c.name,
        }));
      }

      const { data: existing } = await admin
        .from("branch_referral_requests")
        .select("id, status, to_center_id, requested_at, decline_reason")
        .eq("applicant_id", applicant.id)
        .maybeSingle();
      if (existing) {
        existingRequest = {
          id: existing.id,
          status: existing.status,
          toCenterName: siblingNameById.get(existing.to_center_id) ?? "another branch",
          requestedAt: existing.requested_at,
          declineReason: existing.decline_reason,
        };
      } else {
        requestDestinations = (siblingCentres ?? [])
          .filter((c) => !qualifyingCenterIds.includes(c.id))
          .map((c) => ({ centerId: c.id, centerName: c.name }));
      }
    }
  }

  // Admin client for both -- the destination centre and its staff are a
  // sibling branch's own data, outside this session's ordinary RLS scope,
  // and the spec calls this audit line "readable at both ends."
  const referralAdmin = createAdminClient();
  const { data: referredToCentre } = applicant.referred_to_center_id
    ? await referralAdmin.from("centers").select("name").eq("id", applicant.referred_to_center_id).maybeSingle()
    : { data: null };
  const { data: referredByProfile } = applicant.referred_by
    ? await referralAdmin.from("profiles").select("full_name").eq("id", applicant.referred_by).maybeSingle()
    : { data: null };

  // Interview Availability.dc.html: "the applicant sees one time, not two
  // names." Grouped by (date, time, mode) for the default auto-assign
  // picker; the raw per-slot list stays available underneath as a named
  // override for a staff member who wants to choose the interviewer.
  const interviewerIds = [...new Set((openSlots ?? []).map((s) => s.interviewer_id))];
  const { data: interviewerProfiles } = interviewerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", interviewerIds)
    : { data: [] };
  const interviewerNameById = new Map((interviewerProfiles ?? []).map((p) => [p.id, p.full_name]));

  const groupedSlotMap = new Map<string, { slotDate: string; slotTime: string; mode: string; panel: boolean; count: number }>();
  for (const s of openSlots ?? []) {
    const key = `${applicant.intake_course_id}::${s.slot_date}::${s.slot_time}`;
    const existing = groupedSlotMap.get(key);
    groupedSlotMap.set(key, {
      slotDate: s.slot_date,
      slotTime: s.slot_time,
      mode: s.mode,
      panel: s.panel,
      count: (existing?.count ?? 0) + 1,
    });
  }
  const groupedSlots = [...groupedSlotMap.entries()].sort(([, a], [, b]) => (a.slotDate + a.slotTime).localeCompare(b.slotDate + b.slotTime));

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
        {applicant.referred_to_center_id ? (
          <p className="mt-2 text-xs text-muted">
            Referred to {referredToCentre?.name ?? "another branch"}
            {referredByProfile ? ` by ${referredByProfile.full_name}` : ""}
            {applicant.referred_at ? ` · ${new Date(applicant.referred_at).toLocaleString("en-GB")}` : ""}
          </p>
        ) : null}
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

        {speakingPrompt || speakingAudioSignedUrl ? (
          <>
            <h3 className="mt-2 text-sm font-semibold text-ink">Speaking task</h3>
            {speakingPrompt ? <p className="text-xs text-muted">{speakingPrompt.prompt_text}</p> : null}
            {speakingAudioSignedUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio src={speakingAudioSignedUrl} controls className="w-full" />
            ) : (
              <p className="text-sm text-muted">No recording submitted.</p>
            )}
            {applicant.speaking_task_transcript ? (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer select-none">Transcript</summary>
                <p className="mt-1 whitespace-pre-wrap">{applicant.speaking_task_transcript}</p>
              </details>
            ) : null}
            {/* Standalone AI suggestion, not part of the writing/language-
                awareness AiReadingPanel below -- never affects that panel's
                lane or the autobook/notification it drives. */}
            {applicant.speaking_task_ai_suggestion ? (
              <div className="rounded-[6px] border border-dashed border-border p-3">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">AI reading -- suggested, not sent</p>
                <p className="mt-1 text-sm text-ink">{applicant.speaking_task_ai_suggestion}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="card flex flex-col gap-2 p-6">
        <h2 className="font-serif text-lg text-ink">Course commitments and code of conduct</h2>
        {applicant.commitments_accepted_at ? (
          <>
            <p className="text-sm text-ink">
              Accepted {new Date(applicant.commitments_accepted_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {applicant.commitments_snapshot ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-semibold text-primary hover:underline">View the exact text they accepted</summary>
                <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[6px] bg-surface-muted/40 p-3 font-sans text-xs leading-relaxed text-muted">
                  {applicant.commitments_snapshot}
                </pre>
              </details>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Not yet accepted -- this applicant predates the commitments requirement.</p>
        )}
      </div>

      <AiReadingPanel applicant={applicant} />

      <MarkingForm applicant={applicant} />

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Interview</h2>
        {bookedSlot ? (
          <p className="text-sm text-ink">
            Booked: {bookedSlot.slot_date} {bookedSlot.slot_time} ({bookedSlot.mode === "online" ? "Online" : "Face to face"}
            {bookedSlot.panel ? ", panel" : ""})
          </p>
        ) : (
          <>
            {/*
              "Every interview invite -- any lane -- sends the same picker
              link... the applicant always picks their own time." This is
              the primary path; the direct-booking form below stays as a
              manual override (e.g. a time agreed by phone), not the
              standard flow.
            */}
            <div className="flex items-center justify-between gap-3 rounded-[6px] border border-border p-3">
              <div>
                <p className="text-sm text-ink">
                  {applicant.interview_invite_sent_at
                    ? `Invite sent ${new Date(applicant.interview_invite_sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} -- no time picked yet`
                    : "Send the applicant a link to pick their own time"}
                </p>
                <p className="text-xs text-muted">Same link every time -- reply to admissions if none of the times suit.</p>
              </div>
              <form action={sendInterviewInviteManually}>
                <input type="hidden" name="applicant_id" value={applicant.id} />
                <button type="submit" className="shrink-0 rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
                  {applicant.interview_invite_sent_at ? "Resend invite" : "Send interview invite"}
                </button>
              </form>
            </div>
          </>
        )}
        {!bookedSlot && (openSlots ?? []).length > 0 ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-semibold text-primary hover:underline">
              Or book a specific time on their behalf (e.g. agreed by phone)
            </summary>
            <form action={bookInterviewSlot} className="mt-2 flex flex-wrap items-end gap-3">
              <input type="hidden" name="applicant_id" value={applicant.id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="time_key" className="text-xs text-muted">
                  Book a time -- assigned to whoever has interviewed least this intake
                </label>
                <select id="time_key" name="time_key" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink">
                  {groupedSlots.map(([key, g]) => (
                    <option key={key} value={key}>
                      {g.slotDate} {g.slotTime.slice(0, 5)} ({g.mode === "online" ? "Online" : "Face to face"}
                      {g.panel ? ", panel" : ""}
                      {g.count > 1 ? ` -- ${g.count} interviewers free` : ""})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
                Book
              </button>
            </form>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-semibold text-primary hover:underline">Or choose a specific interviewer instead</summary>
              <form action={bookInterviewSlot} className="mt-2 flex flex-wrap items-end gap-3">
                <input type="hidden" name="applicant_id" value={applicant.id} />
                <select name="slot_id" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink">
                  {(openSlots ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.slot_date} {s.slot_time.slice(0, 5)} -- {interviewerNameById.get(s.interviewer_id) ?? "Unknown"} (
                      {s.mode === "online" ? "Online" : "Face to face"}
                      {s.panel ? ", panel" : ""})
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary">
                  Book with this interviewer
                </button>
              </form>
            </details>
          </details>
        ) : !bookedSlot ? (
          <p className="text-sm text-muted">
            No open slots for this intake yet.{" "}
            <Link href="/dashboard/admissions" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : null}

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
              {applicant.fee_amount ? ` Fee: ${applicant.fee_amount}${applicant.fee_currency ? ` ${applicant.fee_currency}` : ""}.` : ""}
            </p>
          </div>
          <div className="card p-6">
            <h2 className="font-serif text-lg text-ink">Deposit</h2>
            <p className="mt-1 text-sm text-muted">
              {paymentState.label}
              {paymentState.outstanding !== null ? ` \u00b7 ${paymentState.outstanding} outstanding` : ""}
            </p>
            <div className="mt-3">
              <AreaAction verdict={paymentVerdict}>
              <DepositForm
                applicantId={applicant.id}
                depositAmount={applicant.deposit_amount}
                depositCurrency={applicant.deposit_currency}
                depositPaidAt={applicant.deposit_paid_at}
                markedByName={depositMarkedByName}
                note={applicant.deposit_note}
              />
              </AreaAction>
            </div>
          </div>
          <PaymentsPanel applicant={applicant} payments={payments ?? []} />
          <EmailHistoryPanel emails={emailHistory ?? []} />
          {/* The green light sits with the money, because that is what informs
              it -- but it is a separate decision, which is the whole point of
              the gate. */}
          <AreaAction verdict={paymentVerdict}>
            <ReleaseWorkspaceForm
              applicantId={applicant.id}
              releasedAt={applicant.workspace_released_at}
              releasedReason={applicant.workspace_released_reason}
              releasedByName={releasedByName}
              hasDeposit={Boolean(applicant.deposit_paid_at)}
              specialRequirements={applicant.special_requirements}
            />
          </AreaAction>
          <WaiverForm applicant={applicant} />
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
          <AreaAction verdict={offerVerdict}>
            <OfferForm applicantId={applicant.id} hasDeposit={Boolean(applicant.deposit_paid_at)} />
          </AreaAction>
          <WaitingListForm applicantId={applicant.id} />
          <RejectForm applicantId={applicant.id} />
          <ReferForm applicantId={applicant.id} destinations={referDestinations} />
          {existingRequest ? (
            <div className="card flex flex-col gap-1 p-6">
              <h2 className="font-serif text-lg text-ink">Referral request</h2>
              <p className="text-sm text-ink">
                {existingRequest.status === "pending"
                  ? `Waiting on ${existingRequest.toCenterName} to accept or decline.`
                  : existingRequest.status === "accepted"
                    ? `${existingRequest.toCenterName} accepted this request.`
                    : `${existingRequest.toCenterName} declined this request${existingRequest.declineReason ? `: ${existingRequest.declineReason}` : "."}`}
              </p>
              <p className="text-xs text-muted">
                Sent {new Date(existingRequest.requestedAt).toLocaleString("en-GB")}
              </p>
            </div>
          ) : (
            <RequestReferralForm applicantId={applicant.id} destinations={requestDestinations} />
          )}
        </>
      ) : null}
    </div>
  );
}

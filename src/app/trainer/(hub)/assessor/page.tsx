import { hubReadClient } from "@/lib/supabase/hub-read";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRosterRows } from "@/lib/roster";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { AssessorCard } from "@/app/trainer/(hub)/assessor-card";
import { AssessorLinkButton } from "@/app/trainer/assessor-link-button";
import { AssessorSelectionButton } from "@/app/trainer/(hub)/roster/assessor-selection-button";
import { buildCentrePreparationList, centrePreparationDeadline, type AssessmentKind } from "@/lib/assessor-requirements";
import { assessorVisitDayProblem, assessorVisitDayNote } from "@/lib/assessor-day";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { visitTeachingOrder } from "@/lib/assessor-wall";
import { buildAssessorRecommendation } from "@/lib/assessor-recommendation";
import { RecommendationPanel } from "@/app/trainer/(hub)/assessor/recommendation-panel";
import { appianHref } from "@/lib/appian";
import { buildPrepSummary } from "@/lib/assessor-prep-state";
import { PrepList } from "@/app/trainer/(hub)/assessor/prep-list";
import { tintModeration } from "@/lib/tint-moderation";
import { TintBlock } from "@/app/trainer/(hub)/assessor/tint-block";

// The assessor's room. MCT only.
//
// Ramy, 5 Sep 2026, on Today: "where is the end of the landing page?" It
// trailed into the assessor card and the Handbook §14.1 list because they
// had nowhere else to live. This tab is that somewhere -- one door for
// everything about the visit: who is coming and when, which candidates
// they will see, the link and the email that hand them the pack, and what
// the centre owes them before they arrive. Today keeps only a summary card
// that points here.
//
// The three controls that used to sit in Roster's header (share link,
// email, candidate selection) moved here too -- one room, one door.

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", opts);
}

export default async function AssessorPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const trainer =
    session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner"
      ? session.profile
      : null;
  if (!trainer) redirect("/login");
  const courseId = trainer.course_id;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  // Same live source Today uses: course_tutors for the course actually
  // open, not the once-at-signup profiles.tutor_role.
  let isMct = trainer.role === "admin";
  if (!isMct) {
    const { data: tutorLink } = await createAdminClient()
      .from("course_tutors")
      .select("tutor_role")
      .eq("course_id", courseId)
      .eq("profile_id", trainer.id)
      .is("left_at", null)
      .maybeSingle();
    isMct = tutorLink?.tutor_role === "main_course_tutor";
  }
  if (!isMct) redirect("/trainer");
  // MCT → ACT preview: the tab is hidden and the direct URL bounces, same
  // as for a real ACT. Display only -- nothing below writes.
  const { isActPreview } = await import("@/lib/act-preview");
  if (await isActPreview()) redirect("/trainer");

  const supabase = hubReadClient(trainer, courseId);
  const timeZone = (trainer.center_id ? (await getCachedCenter(trainer.center_id))?.time_zone : null) ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  // `select("*")` for the same reason Today gives: assessment_kind (0254)
  // and appian_notification_reference (0256) are migration-added columns,
  // and naming an absent one poisons the row's generated type.
  const [{ data: courseRow }, rows, { count: withdrawnCount }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
    fetchRosterRows(supabase, courseId),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("role", "trainee").eq("course_status", "withdrawn"),
  ]);
  const course = courseRow as
    | {
        name: string;
        assessor_name: string | null;
        assessor_email: string | null;
        assessor_visit_date: string | null;
        delivery_mode: "f2f" | "online" | "blended" | null;
        assessment_kind?: string;
        appian_notification_reference?: string | null;
        grade_form_submitted_at?: string | null;
        grade_form_submitted_by?: string | null;
        center_id: string;
      }
    | null;

  const visitDate = course?.assessor_visit_date ?? null;
  const assessmentKind = (course?.assessment_kind ?? "regular") as AssessmentKind;
  const preparationDeadline = centrePreparationDeadline(visitDate);
  // Handbook 14.1's counts are of candidates being assessed. fetchRosterRows
  // returns the withdrawn too (they still belong on the roster), but a
  // withdrawn candidate has no portfolio to hand over -- their paperwork is
  // the separate withdrawal-documentation item -- and the readiness figures
  // this list is compared against count only the active. "All 12 ... 0 of 12
  // complete" against "11 active" was the same denominator bug the assessor
  // pack had, fixed there the same day (11 Sep 2026).
  const activeCandidateCount = rows.filter((r) => r.courseStatus !== "withdrawn").length;
  const centrePreparation = buildCentrePreparationList({
    assessmentKind,
    deliveryMode: course?.delivery_mode ?? "f2f",
    candidateCount: activeCandidateCount,
    withdrawnCount: withdrawnCount ?? 0,
  });
  const [visitDayProblem, visitDayNote, readiness, { data: liveToken }] = await Promise.all([
    assessorVisitDayProblem(supabase, courseId, visitDate),
    assessorVisitDayNote(supabase, courseId, visitDate),
    computeAssessorReadiness(supabase, courseId),
    supabase
      .from("course_access_tokens")
      .select("token")
      .eq("course_id", courseId)
      .eq("role", "assessor")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle(),
  ]);
  // The readiness gate applies to MINTING a link (getOrCreateAssessorToken).
  // Once one exists the pack is out -- copying, emailing and previewing all
  // reuse it -- so the page says so rather than showing a "not ready" the
  // buttons would contradict.
  const packOpens = readiness.ready || Boolean(liveToken);

  // Perf, 6 Sep 2026: the slowest page in the hub at ~840 ms, and ten of its
  // round trips ran one after another although only three needed a previous
  // answer. Same three-wave shape as the rest of the hub.
  //
  // Wave A -- answerable from courseId / center_id / the roster already read.
  const [
    { data: selectionRows },
    cards,
    { data: visitDayTp },
    { data: lastChoice },
    { data: tintRow },
    { count: previousReports },
  ] = await Promise.all([
    rows.length > 0 ? supabase.from("profiles").select("id, selected_for_assessor_visit").in("id", rows.map((r) => r.id)) : Promise.resolve({ data: [] }),
    // The candidate wall, and Connect's own recommendation above it. Ramy, 6
    // Sep 2026: the banner stays, this goes underneath. "Who is coming" is
    // already answered up there, so this answers "which candidates they will
    // see" -- the other half of what the tab is for.
    buildCandidateCards(supabase, courseId),
    // Lesson start times for the visit day, so a suggested candidate can be
    // named with the slot the assessor would sit in. The nth TP event of the
    // day belongs to the nth candidate in the rotation order -- the same
    // derivation the assessor's own lesson-plans page uses.
    visitDate
      ? supabase
          .from("course_timetable_events")
          .select("event_time")
          .eq("course_id", courseId)
          .eq("event_date", visitDate)
          .eq("type", "tp")
          .order("event_time")
      : Promise.resolve({ data: [] as { event_time: string | null }[] }),
    // The centre's last recorded proposal, if any. Append-only, so the newest
    // row is the current one (migration 0279).
    supabase
      .from("assessor_observation_choices")
      .select("trainee_ids, source, reason, chosen_by, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // The course's trainer-in-training, if it has one. Two facts decide what
    // the assessor owes them, and neither is inferable: the centre's Cambridge
    // scheme, and who nominated the trainer (TinT Handbook 5.1, steps 6a/6b).
    supabase
      .from("course_tutors")
      .select("id, profile_id, supervisor_profile_id")
      .eq("course_id", courseId)
      .eq("is_trainer_in_training", true)
      .is("left_at", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("resources")
      .select("id", { count: "exact", head: true })
      .eq("center_id", trainer.center_id ?? "")
      .eq("category", "centre_documents")
      .ilike("title", "%previous assessor%"),
  ]);
  const previousReportOnFile = (previousReports ?? 0) > 0;

  // Wave B -- the four that need a wave-A answer.
  const [{ slots: teachingSlots, tpNumber: visitDayTpNumber }, { data: titRecord }, { data: tintPeople }, { data: chooser }] = await Promise.all([
    visitTeachingOrder(supabase, courseId, visitDate, cards),
    // The scheme and the nominating centre live on tit_records (migrations
    // 0148 and 0234), set on the Trainer-in-Training screen -- the same two
    // fields workspace.tsx has used for requiresAssessorDay since 28 Aug 2026.
    tintRow
      ? supabase.from("tit_records").select("scheme, trains_at_nominating_centre").eq("course_tutors_id", tintRow.id).maybeSingle()
      : Promise.resolve({ data: null }),
    tintRow
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [tintRow.profile_id, tintRow.supervisor_profile_id].filter((x): x is string => Boolean(x)))
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    // The chooser is a tutor, not a candidate, so it is not in `rows`.
    lastChoice ? supabase.from("profiles").select("full_name").eq("id", lastChoice.chosen_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const selectedById = new Map((selectionRows ?? []).map((r) => [r.id, r.selected_for_assessor_visit]));
  const candidates = rows.map((r) => ({ id: r.id, name: r.name, selected: selectedById.get(r.id) ?? true }));
  const selectedCount = candidates.filter((c) => c.selected).length;

  const daysToVisit = visitDate ? Math.ceil((Date.parse(`${visitDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;

  // Both TP groups teach the SAME three slots at the same times, in their own
  // rooms -- the letters on the timetable are positions within a group, not
  // across the course. So the time comes from a candidate's place in their own
  // group's running order, not from a flat index across everyone teaching:
  // group A's first lesson and group B's first lesson are both at 10:00.
  const seenPerGroup = new Map<string, number>();
  const slotTimeById = new Map(
    teachingSlots.map((slot) => {
      const key = slot.groupName ?? "";
      const i = seenPerGroup.get(key) ?? 0;
      seenPerGroup.set(key, i + 1);
      const time = (visitDayTp ?? [])[i]?.event_time?.slice(0, 5) ?? null;
      return [slot.traineeId, time ? `teaches ${time}` : "teaches on the day"];
    })
  );

  const recommendation = buildAssessorRecommendation({
    candidates: cards,
    teachingSlots,
    slotTimeById,
    twoYearly: assessmentKind === "two_yearly",
  });

  const tintNameById = new Map((tintPeople ?? []).map((p) => [p.id, p.full_name]));

  // Ramy, 6 Sep 2026: "a long line of names saying the pack cannot open yet --
  // what is this?" It was one line per issue, and on a mid-course cohort that
  // is eleven near-identical lines of "Stage 2 record not signed off". Grouped
  // by reason instead: the reason is the thing you act on, the names are the
  // detail. Ordered by how many candidates each reason holds, so the one
  // blocking the most reads first.
  const issuesByReason = new Map<string, string[]>();
  for (const issue of readiness.issues) {
    issuesByReason.set(issue.reason, [...(issuesByReason.get(issue.reason) ?? []), issue.traineeName]);
  }
  const groupedIssues = [...issuesByReason.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([reason, names]) => ({
      reason,
      names,
      // Past four, the names stop being readable and the count is the point.
      label: names.length > 4 ? `${names.length} candidates` : names.join(", "),
    }));

  // Ramy, 6 Sep 2026: "maybe you should have an enforced checklist... a
  // warning that so and so is still missing, with a potential override."
  // A third of 14.1's list Connect can answer for itself; these are the reads
  // that let it, gathered here rather than inside the lib so the page keeps
  // one wave of queries instead of two.
  const [{ count: timetableEvents }, { count: publishedBriefs }, { count: attendanceRows }, { count: visitDayPlans }, { count: withdrawalsWithoutLetter }] =
    await Promise.all([
      supabase.from("course_timetable_events").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      supabase
        .from("assignment_templates")
        .select("id", { count: "exact", head: true })
        .eq("center_id", trainer.center_id ?? "")
        .not("published_at", "is", null),
      // volunteer_attendance hangs off a timetable event, not a course, so
      // the register's existence is asked of this course's own TP events.
      supabase
        .from("volunteer_attendance")
        .select("id, course_timetable_events!inner(course_id)", { count: "exact", head: true })
        .eq("course_timetable_events.course_id", courseId),
      // 14.1's "lesson plans for the day" are the CANDIDATES' plans -- tp_plans,
      // the document a trainee submits -- not plan_assignments, which is the
      // tutor's TP-point record (rotation, aims, procedure). This counted the
      // wrong table until 11 Sep 2026 and read "1 of 6 plans in" against six
      // submitted plans. Scoped to whoever teaches on the visit day, so a plan
      // from someone not teaching cannot stand in for one who is.
      visitDayTpNumber > 0 && teachingSlots.length > 0
        ? supabase
            .from("tp_plans")
            .select("id", { count: "exact", head: true })
            .eq("course_id", courseId)
            .eq("tp_number", visitDayTpNumber)
            .in("trainee_id", teachingSlots.map((s) => s.traineeId))
            .not("submitted_at", "is", null)
        : Promise.resolve({ count: 0 }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId)
        .eq("course_status", "withdrawn")
        .is("withdrawal_letter_generated_at", null),
    ]);

  // Who marked the Centre Grade form as submitted, for the 14.1 list's
  // evidence line. The MCT or Course Admin -- so not necessarily in `rows`.
  const { data: gradeFormMarker } = course?.grade_form_submitted_by
    ? await supabase.from("profiles").select("full_name").eq("id", course.grade_form_submitted_by).maybeSingle()
    : { data: null };
  const gradeFormSubmittedLabel = course?.grade_form_submitted_at
    ? `${formatDate(course.grade_form_submitted_at, timeZone, { year: "numeric" })}${gradeFormMarker?.full_name ? ` by ${gradeFormMarker.full_name}` : ""}`
    : null;

  // §14.1 "application files" -- what selection left on record for this
  // intake. Decided stages only: someone still being interviewed is not a
  // file the assessor checks. Read through the admin client because the
  // MCT's own RLS sees applicants at their home centre only.
  const applicationFiles = await countApplicationFiles(createAdminClient(), courseId);

  const prep = await buildPrepSummary(supabase, centrePreparation, {
    applicationFiles,
    courseId,
    candidateCount: activeCandidateCount,
    portfoliosComplete: readiness.portfoliosCompleteCount,
    hasTimetable: (timetableEvents ?? 0) > 0,
    publishedAssignmentTitles: (publishedBriefs ?? 0) > 0,
    appianReference: course?.appian_notification_reference ?? null,
    gradeFormSubmittedLabel,
    previousReportOnFile,
    attendanceRegisterRows: attendanceRows ?? 0,
    // Capped at the slots: a trainee with a draft and a resubmission would
    // otherwise count twice and read "7 of 6".
    lessonPlansForVisitDay: Math.min(visitDayPlans ?? 0, teachingSlots.length),
    visitDayTeachingSlots: teachingSlots.length,
    withdrawalLettersOutstanding: withdrawalsWithoutLetter ?? 0,
  });

  // What became of the last pack email. "Sent." on the button is true at the
  // moment of sending and stays on screen; a bounce arrives seconds later by
  // webhook and, until 11 Sep 2026, surfaced only on the Centre landing and
  // the admissions email log -- never here, where the MCT pressed Send. The
  // demo's own assessor address bounced exactly like that while the tab still
  // said "Sent." The centre's own log, read through the admin client as the
  // rest of this page's centre-level reads are; authorisation is the
  // trainer's role and centre, already established above.
  const { data: packEmailRows } = await createAdminClient()
    .from("applicant_emails")
    .select("to_email, status, error, created_at, bounced_at, bounce_reason, delivered_at, opened_at")
    .eq("center_id", trainer.center_id ?? "")
    .eq("type", "assessor_pack")
    .order("created_at", { ascending: false })
    .limit(1);
  const packEmail = packEmailRows?.[0] ?? null;
  const packEmailTz = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;

  const nameById = new Map(cards.map((c) => [c.traineeId, c.name]));
  const chooserName = chooser?.full_name ?? null;
  const existingChoice = lastChoice
    ? {
        names: lastChoice.trainee_ids.map((id) => nameById.get(id) ?? "Unknown"),
        source: lastChoice.source,
        reason: lastChoice.reason,
        by: chooserName ?? "the centre",
        // An instant, read in the centre's zone -- .slice(0, 10) was the UTC
        // day, which after 21:00 in Istanbul is yesterday.
        at: formatDate(lastChoice.created_at, timeZone, { day: "numeric", month: "long" }),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">
          {course?.name ?? "Course"} &middot; Assessor visit
        </p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">Assessor</h1>
        <p className="max-w-[62ch] text-sm text-muted">
          Who is coming, which candidates they will see, and what the centre owes them before they arrive. Administration Handbook §14.
        </p>
      </div>

      {visitDayProblem ? (
        <div className="flex items-center gap-3 rounded-[10px] bg-destructive px-4 py-3 text-[13px] text-primary-foreground">
          <span className="rounded-full bg-[color-mix(in_oklab,white_22%,transparent)] px-2 py-[2px] text-[10px] font-bold tracking-[0.08em] uppercase">Visit day</span>
          <span className="flex-1 font-semibold">{visitDayProblem}</span>
          <Link href="/trainer/timetable?mode=edit" className="text-[12px] whitespace-nowrap underline">
            Nothing to observe &middot; §14.2
          </Link>
        </div>
      ) : null}
      {/* A note, not a refusal: lessons but no Feedback session on the visit
          day. 14.2 lets the assessor observe an earlier session's feedback,
          so the visit stands -- it is just better with one (12 Sep 2026). */}
      {!visitDayProblem && visitDayNote ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-3 text-[13px] text-muted">
          <span className="rounded-full bg-frame px-2 py-[2px] text-[10px] font-bold tracking-[0.08em] text-ink uppercase">Visit day</span>
          <span className="flex-1">{visitDayNote}</span>
          <Link href="/trainer/timetable?mode=edit" className="text-[12px] whitespace-nowrap text-primary underline">
            Open the timetable
          </Link>
        </div>
      ) : null}

      {visitDate ? (
        <div
          className="flex flex-wrap items-end justify-between gap-4 rounded-[14px] px-[22px] py-5 text-[oklch(96%_0.008_85)]"
          style={{ background: "var(--color-ink-warm)" }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold tracking-[0.11em] text-gold uppercase">
              {daysToVisit !== null && daysToVisit < 0 ? "Visited" : daysToVisit === 0 ? "Today" : `In ${daysToVisit} day${daysToVisit === 1 ? "" : "s"}`}
            </span>
            <span className="font-serif text-[24px] font-semibold">
              {fmtDate(visitDate, { weekday: "long", day: "numeric", month: "long" })}
              {course?.assessor_name ? ` · ${course.assessor_name}` : ""}
            </span>
            {course?.assessor_email ? <span className="text-[12.5px] opacity-80">{course.assessor_email}</span> : null}
          </div>
          <div className="flex flex-col items-end gap-2.5 text-right text-[12.5px]">
            {/* Ramy, 6 Sep 2026: the Appian link belongs on the banner, in the
                MCT's own garnet rather than a translucent tint -- brown on
                brown had it disappearing. Lifted off --hub-accent so it still
                reads against the dark ground. Handbook 14.1 puts the centre in
                Appian 2-3 days before the visit to submit the grade form, so
                this is a door the MCT actually needs on this screen. */}
            <a
              href={appianHref(null)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-[6px] border px-[13px] text-[12.5px] font-semibold no-underline transition-[filter] duration-150 hover:brightness-125"
              style={{ background: "oklch(46% 0.15 27)", borderColor: "oklch(58% 0.16 27)", color: "oklch(96% 0.008 85)" }}
            >
              Open Appian
            </a>
            <span>
              <span className="font-semibold">{selectedCount}</span> of {candidates.length} candidates selected
            </span>
            {preparationDeadline ? (
              <span className="opacity-80">
                {centrePreparation.length} preparation item{centrePreparation.length === 1 ? "" : "s"} · ready by{" "}
                {fmtDate(preparationDeadline, { day: "numeric", month: "short" })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Ramy, 6 Sep 2026: "I like those dotted borders you have in the
          preview... it could just be a frame that surrounds the entire page,
          around everything until just under the banner."

          One frame, not one per card: he asked first for dashes on each of the
          cards below and then replaced that with this, which is the better of
          the two -- a dashed rule repeated on six cards reads as six warnings,
          while one around the lot reads as a boundary. In the mockup this
          treatment meant "new"; here it means "this is the visit", holding
          everything under the banner together.

          The accent again, so it is garnet for an MCT and gold for an ACT.
          Cards keep their own borders and hovers; this sits outside them. */}
      <div className="group-frame flex flex-col gap-6 p-5 sm:p-6">
      {cards.length > 0 ? (
        <RecommendationPanel
          rec={recommendation}
          visitDateLabel={visitDate ? fmtDate(visitDate, { weekday: "long", day: "numeric", month: "long" }) : null}
          existing={existingChoice}
        />
      ) : null}

      {/* Always rendered: folded to a pill when the course has none, so the
          capability is discoverable rather than invisible (Ramy, 6 Sep 2026). */}
      {(
        <TintBlock
          name={tintRow ? (tintNameById.get(tintRow.profile_id) ?? "Your trainer-in-training") : null}
          supervisorName={tintRow?.supervisor_profile_id ? (tintNameById.get(tintRow.supervisor_profile_id) ?? null) : null}
          moderation={tintModeration({
            scheme: titRecord?.scheme ?? null,
            trainsAtNominatingCentre: titRecord?.trains_at_nominating_centre ?? true,
          })}
        />
      )}

      {/* The candidate wall used to sit here, and Ramy cut it on 6 Sep 2026:
          "starting from which candidates the assessor sees, it just feels
          redundant, is it?" It was -- half of it repeated the recommendation
          above, and the other half were cards whose only sentence was "put
          forward by the centre".

          Checked before removing, and every job it did is done better
          elsewhere on this tab or one tab away: the withdrawn candidate is a
          conditional item on the 14.1 list below, incomplete portfolios are
          named precisely by the hand-over card's blockers, a door into each
          portfolio is Roster, and grades at a glance are the Grade form.

          The wall itself was never wrong -- it was designed for the ASSESSOR's
          own page, where there is no Roster and no Grade form and it is the
          only view of the cohort there is. It is redundant here and nowhere
          else. candidate-wall.tsx and assessor-wall.ts are kept for that. */}

      {/* Ramy, 6 Sep 2026: "why didn't you build this mockup?" -- it WAS built,
          but the mockup drew only the three new things (banner, recommendation,
          wall) and never drew the two sections already on this tab. So the page
          opened on preparation admin and buried the thing you came to see.

          Reordered, not rebuilt: the visit itself first -- who is coming, what
          Connect suggests, which candidates they see -- then everything the
          centre has to get ready before they arrive. The tools are all still
          here, just after the answer instead of in front of it. */}
      <div className="flex flex-col gap-1 pt-2">
        <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Before they arrive</p>
        <p className="max-w-[70ch] text-sm text-muted">
          Setting the visit up, handing the pack over, and the Handbook&apos;s own list of what the centre owes them.
          {prep.outstanding.length > 0 ? (
            <>
              {" "}
              <span className="font-semibold" style={{ color: "oklch(44% 0.1 68)" }}>
                {prep.outstanding.length} of {prep.total} not ready.
              </span>
            </>
          ) : (
            <>
              {" "}
              <span className="font-semibold" style={{ color: "var(--color-primary)" }}>
                All {prep.total} ready.
              </span>
            </>
          )}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AssessorCard
          initialName={course?.assessor_name ?? null}
          initialEmail={course?.assessor_email ?? null}
          initialVisitDate={visitDate}
          initialAssessmentKind={assessmentKind}
          initialAppianReference={course?.appian_notification_reference ?? null}
        />

        <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-card px-[22px] py-5">
            <div className="flex flex-col gap-[3px]">
              <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Hand over the pack</p>
              <p className="text-sm text-muted">
                {/* "every portfolio on the course", not "every selected portfolio":
                    computeAssessorReadiness gates on every active candidate, and
                    rightly -- the selection is only the default view, and "View
                    full cohort" opens any portfolio, so a gap anywhere is a gap
                    the assessor can reach. The sentence said "selected" until
                    11 Sep 2026 while the list beneath it named eleven candidates. */}
                Choose which candidates the assessor sees, then share the read-only link or email it to them. The link refuses to open until every
                portfolio on the course is complete, and names what is missing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AssessorSelectionButton candidates={candidates} />
              <AssessorLinkButton outstanding={prep.outstanding.map((i) => i.label)} />
              {/* Grade form was here as well as in the top nav -- the same
                  duplicate door Ramy took off Teaching Practice on 6 Sep 2026.
                  One room, one door. */}
              {packOpens ? (
                <a
                  href="/trainer/assessor/preview"
                  className="rounded-[6px] px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-[1.12]"
                  style={{ background: "var(--hub-accent)" }}
                >
                  Preview as the assessor
                </a>
              ) : (
                <span className="rounded-[6px] border border-dashed border-border px-3 py-1.5 text-sm text-muted" title="Complete the portfolios first">
                  Preview not ready
                </span>
              )}
            </div>
            {packEmail ? (
              <p className={`text-xs ${packEmail.status === "bounced" || packEmail.status === "failed" ? "font-medium text-destructive" : "text-muted"}`}>
                {packEmail.status === "bounced"
                  ? `The pack email to ${packEmail.to_email} bounced, ${formatDateTime(packEmail.bounced_at ?? packEmail.created_at, packEmailTz)}${
                      packEmail.bounce_reason ? `: ${packEmail.bounce_reason}` : "."
                    } The link still works -- send it another way, or correct the address on the Assessor card.`
                  : packEmail.status === "failed"
                    ? `The pack email to ${packEmail.to_email} could not be sent${packEmail.error ? `: ${packEmail.error}` : "."}`
                    : `Pack emailed to ${packEmail.to_email}, ${formatDateTime(packEmail.created_at, packEmailTz)}${
                        packEmail.opened_at
                          ? ` · opened ${formatDateTime(packEmail.opened_at, packEmailTz)}`
                          : packEmail.delivered_at
                            ? " · delivered"
                            : ""
                      }.`}
              </p>
            ) : null}
            {!packOpens ? (
              <div className={`rounded-[10px] px-4 py-3 text-xs ${preview === "not-ready" ? "bg-card-inset text-ink" : "text-muted"}`}>
                <p className="font-semibold">The pack cannot open yet -- the link, the email and the preview all wait for this:</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {groupedIssues.map((g) => (
                    <li key={g.reason}>
                      <span className="font-semibold">{g.reason}</span> &mdash;{" "}
                      <span title={g.names.join(", ")}>{g.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted">
                {liveToken && !readiness.ready
                  ? `The link is already issued, so it, the email and the preview all open -- but ${readiness.issues.length} portfolio item${readiness.issues.length === 1 ? " is" : "s are"} still incomplete: ${groupedIssues.map((g) => `${g.reason} (${g.label})`).join("; ")}. `
                  : ""}
                The preview opens the pack through the same link the assessor gets, without accepting the terms on their behalf. &ldquo;Exit
                preview&rdquo; at the top brings you back here.
              </p>
            )}
        </section>
      </div>

      <PrepList
        summary={prep}
        deadline={preparationDeadline ? fmtDate(preparationDeadline, { day: "numeric", month: "long" }) : null}
      />
      </div>

    </div>
  );
}

const DECIDED_STAGES = ["accepted", "offer_sent", "rejected_before_interview", "rejected_after_interview", "waiting_list", "not_this_time"] as const;

async function countApplicationFiles(
  admin: ReturnType<typeof createAdminClient>,
  courseId: string
): Promise<{ decided: number; complete: number } | null> {
  const { data: applicants } = await admin
    .from("applicants")
    .select("id, stage, writing_task_submission, marked_at")
    .eq("intake_course_id", courseId)
    .in("stage", [...DECIDED_STAGES]);
  if (!applicants || applicants.length === 0) return null;
  const { data: records } = await admin
    .from("interview_records")
    .select("applicant_id")
    .in("applicant_id", applicants.map((a) => a.id));
  const interviewed = new Set((records ?? []).map((r) => r.applicant_id));
  const complete = applicants.filter(
    (a) =>
      Boolean(a.writing_task_submission) &&
      Boolean(a.marked_at) &&
      (a.stage === "rejected_before_interview" || interviewed.has(a.id))
  ).length;
  return { decided: applicants.length, complete };
}

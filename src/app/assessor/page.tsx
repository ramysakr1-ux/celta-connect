import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus, isAssessorPreview } from "@/lib/auth/portfolio-access";
import { computeAssessorReadiness, buildCandidateCards, type CandidateCardData } from "@/lib/assessor-pack";
import { halfOwningDate, halfTpDates, rotationPosition } from "@/lib/rotation";
import { resolveProvisionalDeadline } from "@/lib/provisional-deadline";
import { hasMarkingGuidance } from "@/lib/marking-guidance";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DesignerCredit } from "@/components/designer-credit";
import { Wordmark } from "@/components/wordmark";
import { CENTRE_DOCUMENTS, COHORT_DOCUMENTS } from "@/lib/assessor-pack-contents";
import { buildAssessorRequirements, doubleMarkingPerAssignment, type AssessmentKind } from "@/lib/assessor-requirements";
import { AppianReference } from "@/app/assessor/appian-reference";
import { appianHref } from "@/lib/appian";
import { CandidateWall, type WallCandidate, type WallSectionId } from "@/app/assessor/candidate-wall";
import { VisitRail, type PackRow, type DayRow } from "@/app/assessor/visit-rail";

// design_handoff_assessor_landing_v2 -- the candidate wall.
//
// Built for the two or three days before the visit, and it answers one
// question: which portfolios do I read, and why that one. Candidates are
// cards grouped in Handbook order with a sentence each; the pack, the day and
// the Handbook sit in the rail. No dashboard figures, no banners, no dark
// header -- the readiness stats and the provisional-grades countdown were the
// centre's business, not the assessor's, and an assessor cannot act on either.
//
// Everything that page carried is still reachable: malpractice cases and the
// self-study input schedule became their own read-only pages (linked from
// "Also on file"), and the requirements list moved into the rail.
//
// Still token-gated and still read-only: every query here runs through the
// admin client scoped to the one course_id the token resolves to, and nothing
// on the page writes.
const BROWN = "oklch(30% 0.042 58)";
const PAPER = "oklch(97.5% 0.008 88)";

const WHY: Record<WallSectionId, string> = {
  observe: "Teaching while you are here. Read this one in full.",
  fail: "Potential Fail. The Handbook asks you to read borderline cases first.",
  passA: "Tutors expect Pass A. Worth reading to confirm the standard.",
  centre: "Put forward by the centre.",
  withdrawn: "Check the letter and the application.",
};

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace("Sept", "Sep");
}

function weekdayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}

export default async function AssessorPage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const { cohort } = await searchParams;
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  const preview = await isAssessorPreview();
  if (!termsStatus.accepted && !preview) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();

  const [{ data: course }, { data: accessToken }, readiness, candidates] = await Promise.all([
    admin.from("courses").select("*, centers(name, center_number, appian_url)").eq("id", courseId).maybeSingle(),
    admin.from("course_access_tokens").select("expires_at").eq("course_id", courseId).eq("role", "assessor").maybeSingle(),
    computeAssessorReadiness(admin, courseId),
    buildCandidateCards(admin, courseId),
  ]);

  if (!course) redirect("/login?error=assessor_link_invalid");

  const center = course.centers as unknown as { name: string; center_number: string; appian_url: string | null } | null;
  const timeZone = (await getCachedCenter(course.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  const visitDate = course.assessor_visit_date ?? null;

  const [
    { data: tutorRows },
    { data: onDayEvents },
    { data: centreDocs },
    { data: malpracticeCases },
    { count: concernsCount },
    { count: asyncInputCount },
    { data: courseTpEvents },
    { data: visitSubgroups },
    markingGuidancePresent,
  ] = await Promise.all([
    admin.from("course_tutors").select("profile_id, tutor_role").eq("course_id", courseId).is("left_at", null),
    visitDate
      ? admin.from("course_timetable_events").select("*").eq("course_id", courseId).eq("event_date", visitDate).order("event_time")
      : Promise.resolve({ data: [] }),
    admin.from("resources").select("id, title, file_url").eq("center_id", course.center_id).eq("category", "centre_documents"),
    admin.from("malpractice_cases").select("id, status, outcome").eq("course_id", courseId).order("opened_at", { ascending: false }),
    // A count of candidates who asked to speak with the assessor -- never the
    // names. Read head-only so the identities do not leave the database.
    admin
      .from("assessor_meeting_requests")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .is("withdrawn_at", null),
    course.delivery_mode !== "f2f"
      ? admin
          .from("course_timetable_events")
          .select("id", { count: "exact", head: true })
          .eq("course_id", courseId)
          .eq("type", "input_session")
          .eq("is_asynchronous", true)
      : Promise.resolve({ count: 0 }),
    admin.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp"),
    admin.from("course_subgroups").select("id, half_order").eq("course_id", courseId),
    hasMarkingGuidance(admin, course.center_id),
  ]);

  const tutorProfileIds = (tutorRows ?? []).map((t) => t.profile_id);
  const [{ data: tutorProfiles }, { data: visitMembers }] = await Promise.all([
    tutorProfileIds.length > 0 ? admin.from("profiles").select("id, full_name").in("id", tutorProfileIds) : Promise.resolve({ data: [] }),
    (visitSubgroups ?? []).length > 0
      ? admin
          .from("course_subgroup_members")
          .select("subgroup_id, trainee_id, base_slot")
          .in("subgroup_id", (visitSubgroups ?? []).map((sg) => sg.id))
      : Promise.resolve({ data: [] }),
  ]);
  const tutorNameById = new Map((tutorProfiles ?? []).map((p) => [p.id, p.full_name]));

  // ---------------------------------------------------------------------
  // Who teaches on the visit day, in teaching order. Same rotation
  // derivation the lesson-plans page uses: the visit date belongs to one
  // half, that half's position in its own list of TP dates gives the TP
  // number, and each member's rotation position for that number gives their
  // place among the day's TP slots, which are already ordered by time.
  const allCourseTpEvents = courseTpEvents ?? [];
  const visitHalf = visitDate ? halfOwningDate(allCourseTpEvents, visitDate) : null;
  const visitTpNumber = visitHalf && visitDate ? halfTpDates(allCourseTpEvents, visitHalf).indexOf(visitDate) + 1 : 0;
  const teachingOrder: { traineeId: string; name: string; groupName: string | null }[] = [];
  if (visitHalf && visitTpNumber > 0) {
    const halfSubgroupIds = (visitSubgroups ?? []).filter((sg) => sg.half_order === visitHalf).map((sg) => sg.id);
    const members = (visitMembers ?? []).filter((m) => halfSubgroupIds.includes(m.subgroup_id));
    const sizeBySubgroup = new Map(halfSubgroupIds.map((id) => [id, members.filter((m) => m.subgroup_id === id).length]));
    teachingOrder.push(
      ...members
        .map((m) => {
          const candidate = candidates.find((c) => c.traineeId === m.trainee_id);
          return {
            traineeId: m.trainee_id,
            name: candidate?.name ?? null,
            groupName: candidate?.groupName ?? null,
            order: rotationPosition(m.base_slot, sizeBySubgroup.get(m.subgroup_id) ?? 1, visitTpNumber) + 1,
          };
        })
        .filter((x): x is { traineeId: string; name: string; groupName: string | null; order: number } => Boolean(x.name))
        .sort((a, b) => a.order - b.order)
        .map(({ traineeId, name, groupName }) => ({ traineeId, name, groupName }))
    );
  }
  const observeIds = new Set(teachingOrder.map((t) => t.traineeId));

  // ---------------------------------------------------------------------
  // The wall. Withdrawn is tested first: a withdrawn candidate has no
  // business appearing under "you will watch these teach" even if the
  // rotation still names them for that day.
  function sectionFor(c: CandidateCardData): WallSectionId {
    if (c.courseStatus === "withdrawn") return "withdrawn";
    if (observeIds.has(c.traineeId)) return "observe";
    // The Handbook's trigger is "Fail or potential Fail", and the only
    // provisional slots carrying Fail at all are Fail and Fail/Pass -- so a
    // substring test on the label is the whole rule, not an approximation.
    if (c.provisionalLabel?.includes("Fail")) return "fail";
    if (c.provisionalLabel === "Pass A") return "passA";
    return "centre";
  }

  const wantsFullCohort = cohort === "full";
  const selectedCount = candidates.filter((c) => c.selectedForAssessorVisit).length;
  const wallCandidates: WallCandidate[] = candidates
    .map((c) => {
      const section = sectionFor(c);
      const why =
        section === "withdrawn"
          ? c.courseStatusSetAt
            ? `Withdrew ${shortDate(c.courseStatusSetAt.slice(0, 10))}. ${WHY.withdrawn}`
            : `Withdrew from the course. ${WHY.withdrawn}`
          : section === "centre" && !c.selectedForAssessorVisit
            ? "Not put forward by the centre."
            : WHY[section];
      return { ...c, section, why };
    })
    // for-claude-code-assessor-pack-decisions.md §1: the centre's selection
    // is the default, never a restriction. Everyone the Handbook names --
    // the ones teaching that day, the Fail cases, the withdrawn -- is on the
    // list whether the centre put them forward or not.
    .filter(
      (c) => wantsFullCohort || c.selectedForAssessorVisit || c.section === "observe" || c.section === "fail" || c.section === "withdrawn"
    );

  const observeHeading =
    teachingOrder.length === 1
      ? "You will watch this candidate teach"
      : teachingOrder.length === 2
        ? "You will watch these two teach"
        : "You will watch two of these teach";
  const observeGroups = [...new Set(teachingOrder.map((t) => t.groupName).filter((g): g is string => Boolean(g)))];
  const observeNote = [
    visitTpNumber > 0 ? `TP${visitTpNumber}` : null,
    observeGroups.length > 0 ? observeGroups.join(" and ") : null,
    "at least one of these portfolios is read in full",
  ]
    .filter(Boolean)
    .join(" · ");

  // ---------------------------------------------------------------------
  // The pack. Cohort documents first, then the centre's, each with the state
  // the app can actually vouch for -- "in" only where something really is on
  // file, never as a default.
  const provisionalDeadline = resolveProvisionalDeadline(course.provisional_grades_due_at ?? null, visitDate);
  const gradesDue = provisionalDeadline.dueDate;
  const gradeFormState = readiness.gradesApprovedCount >= readiness.totalCandidates && readiness.totalCandidates > 0 ? "in" : readiness.gradesApprovedCount > 0 ? "part" : "missing";
  const doubleMarkPerAssignment = doubleMarkingPerAssignment(candidates.length);

  const cohortPackMeta: Record<string, { meta: string; state: PackRow["state"]; href: string }> = {
    "Grade form": {
      meta: `${readiness.gradesApprovedCount} of ${readiness.totalCandidates}${gradesDue ? ` · due ${shortDate(gradesDue)}` : ""}`,
      state: gradeFormState,
      href: "/trainer/grades-report",
    },
    "Course timetable": { meta: "", state: "in", href: "/trainer/timetable" },
    "Assignment titles": { meta: "all four", state: "in", href: "/assessor/assignment-titles" },
    "Tutor list and roles": { meta: `${tutorNameById.size}`, state: tutorNameById.size > 0 ? "in" : "missing", href: "#tutor-list" },
    "Candidate descriptions": { meta: `${candidates.length}`, state: "in", href: "/trainer/roster" },
    // Handbook 14.1: "If not ready in advance, handed over at the start of
    // the lesson." So this one is legitimately not in the pack yet, which is
    // a different thing from missing.
    "Lesson plans for the day": { meta: "on the day", state: "later", href: "/assessor/lesson-plans" },
  };

  const packRows: PackRow[] = COHORT_DOCUMENTS.map((name) => {
    const m = cohortPackMeta[name];
    return { name, meta: m?.meta ?? "", state: m?.state ?? "in", href: m?.href };
  });

  for (const doc of CENTRE_DOCUMENTS) {
    // "Marking guidance" is the one line item that lives in the app itself
    // rather than the uploads table -- see marking-guidance.ts.
    const isMarkingGuidance = doc.name === "Marking guidance";
    const uploaded = isMarkingGuidance ? null : (centreDocs ?? []).find((d) => d.title.trim().toLowerCase() === doc.name.toLowerCase());
    const present = isMarkingGuidance ? markingGuidancePresent : Boolean(uploaded?.file_url);
    const meta =
      doc.name === "Centre authorisation certificate"
        ? (center?.center_number ?? "")
        : doc.name === "Double-marking record" && doubleMarkPerAssignment
          ? `${doubleMarkPerAssignment} per assignment`
          : doc.name === "Application files"
            ? `${candidates.length} accepted`
            : "";
    packRows.push({
      name: doc.name,
      meta: present ? meta : "not uploaded",
      state: present ? "in" : "missing",
      href: present ? (isMarkingGuidance ? "/assessor/marking-guidance" : (uploaded?.file_url ?? undefined)) : undefined,
    });
  }

  // Anything the centre uploaded under a title of its own. Previously these
  // were silently dropped for not matching one of the eight defaults.
  for (const d of (centreDocs ?? []).filter(
    (d) => !CENTRE_DOCUMENTS.some((doc) => doc.name.toLowerCase() === d.title.trim().toLowerCase())
  )) {
    packRows.push({ name: d.title, meta: "added by the centre", state: "in", href: d.file_url ?? undefined });
  }

  // ---------------------------------------------------------------------
  // The day. Narrowed to the sessions the assessor is actually at -- the rest
  // of that day is the candidates' day, not theirs. Every teaching slot is
  // named rather than lettered: "TP7 · A" tells an assessor nothing about who
  // they are about to watch.
  const assessorDayTypes = new Set(["tp", "supervised_session"]);
  const visitDayEvents = (onDayEvents ?? []).filter(
    (e) => assessorDayTypes.has(e.type) || (e.tag === "lunch" && (onDayEvents ?? []).some((x) => x.type === "tp"))
  );
  let tpSeen = 0;
  const dayRows: DayRow[] = visitDayEvents.map((e) => {
    const isTp = e.type === "tp";
    const who = isTp ? (teachingOrder[tpSeen++]?.name ?? null) : null;
    return {
      time: e.event_time?.slice(0, 5) ?? "",
      title: who ? `${e.title} · ${who}` : e.title,
      sub: e.zoom_url ? "Online — joining link opens 10 minutes before" : isTp ? "In person at the centre" : null,
      isTp,
    };
  });

  // Ramy, 30 Aug 2026: "we don't usually include the grades meeting on the
  // timetable, because the timetable is for the trainees and the grades
  // meeting is not for the trainees." It is still a real Handbook 14.3
  // obligation, so it lives here and only here.
  dayRows.push({ time: "—", title: "Grading meeting", sub: "All tutors, time agreed with the MCT. Not on the candidates' timetable.", isTp: false });
  // The candidates' own meeting IS timetabled, so this row only appears when
  // the centre hasn't put it on the day yet.
  if (!(onDayEvents ?? []).some((e) => (e.title ?? "").toLowerCase().includes("assessor"))) {
    dayRows.push({ time: "—", title: "Candidate-concerns meeting", sub: "Private, without tutors present. Not yet on the timetable.", isTp: false });
  }

  // ---------------------------------------------------------------------
  const atRiskCount = candidates.filter((c) => c.provisionalLabel?.includes("Fail")).length;
  const withdrawnCount = candidates.filter((c) => c.courseStatus === "withdrawn").length;
  const requirements = buildAssessorRequirements({
    // Cast rather than a regenerated type: migration 0254 adds this column
    // and `select("*")` simply omits an absent one, so the pack reads
    // correctly either side of the migration running.
    assessmentKind: ((course as { assessment_kind?: string }).assessment_kind ?? "regular") as AssessmentKind,
    candidateCount: candidates.length,
    atRiskCount,
    selectedCount,
    withdrawnCount,
    meetingRequestCount: concernsCount ?? 0,
  });

  const openCases = (malpracticeCases ?? []).filter((c) => c.status === "open").length;
  const alsoOnFile = [
    {
      label: "Malpractice this course",
      value:
        (malpracticeCases ?? []).length === 0
          ? "none raised"
          : `${(malpracticeCases ?? []).length}${openCases > 0 ? ` · ${openCases} open` : ` · ${(malpracticeCases ?? [])[0]?.outcome ?? "decided"}`}`,
      href: "/assessor/malpractice",
    },
    {
      label: "Provisional grades",
      value: `${readiness.gradesApprovedCount} of ${readiness.totalCandidates} confirmed`,
      href: "/trainer/grades-report",
    },
    {
      label: "Input schedule",
      value: course.delivery_mode === "f2f" ? "n/a · face-to-face" : `${asyncInputCount ?? 0} self-study sessions`,
      href: course.delivery_mode === "f2f" ? undefined : "/assessor/input-schedule",
    },
  ];

  // ---------------------------------------------------------------------
  const courseDates =
    course.start_date && course.end_date ? `${shortDate(course.start_date)} – ${shortDate(course.end_date)}` : "";
  const mct = (tutorRows ?? []).find((t) => t.tutor_role === "main_course_tutor");
  const acts = (tutorRows ?? []).filter((t) => t.tutor_role === "assistant_course_tutor");
  const tutorLine = [
    mct ? `MCT ${tutorNameById.get(mct.profile_id) ?? "not named"}` : null,
    acts.length > 0 ? `ACT ${acts.map((a) => tutorNameById.get(a.profile_id) ?? "not named").join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const daysOut = visitDate ? daysBetween(today, visitDate) : null;
  const visitLine = !visitDate
    ? "no visit date set yet"
    : daysOut === 0
      ? "your visit is today"
      : daysOut === 1
        ? `your visit ${weekdayDate(visitDate)}, tomorrow`
        : daysOut && daysOut > 0
          ? `your visit ${weekdayDate(visitDate)}, ${daysOut} days from now`
          : `your visit was ${weekdayDate(visitDate)}`;
  const contextLine = [courseDates, `${candidates.length} candidates`, tutorLine || null, visitLine].filter(Boolean).join(" · ");

  const monthLine = course.start_date
    ? new Date(`${course.start_date}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  const footLine = wantsFullCohort
    ? `All ${candidates.length} candidates. The centre put ${selectedCount} forward; the final selection is yours, in consultation with the centre (§15.1).`
    : `${selectedCount} of ${candidates.length} put forward by the centre. The final selection is yours, in consultation with the centre (§15.1).`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
        <div className="overflow-hidden rounded-[6px] border border-border" style={{ background: PAPER }}>
          <header className="flex flex-col gap-5 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-8 sm:pt-[22px]">
            <div className="flex min-w-0 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <Wordmark size="header-compact" />
                <span
                  className="rounded-[5px] border px-2 py-[3px] text-[10.5px] font-bold tracking-[0.1em] uppercase"
                  style={{ color: BROWN, borderColor: "oklch(80% 0.03 70)" }}
                >
                  Assessor · read-only
                </span>
                <span className="text-[11.5px] text-muted">
                  {preview
                    ? "Preview — this is the pack exactly as the assessor's link opens it. Nothing you do here is recorded."
                    : "Nothing you open here is recorded against a candidate."}
                  {!preview && accessToken ? ` Link works until ${shortDate(accessToken.expires_at.slice(0, 10))}.` : ""}
                </span>
                {/* A route handler that clears the preview cookie and
                    redirects, not a page -- Link's prefetch would fire it. */}
                {preview ? (
                  // eslint-disable-next-line @next/next/no-html-link-for-pages
                  <a href="/assessor/exit" className="text-[11.5px] font-semibold text-primary hover:underline">
                    Exit preview
                  </a>
                ) : null}
              </div>
              <h1 className="font-serif text-[28px] leading-[1.1] font-medium tracking-[-0.01em] text-ink sm:text-[36px]">
                {center?.name ?? "Centre"} <span className="text-muted">·</span> CELTA{monthLine ? `, ${monthLine}` : ""}
              </h1>
              <p className="text-[13px] text-pretty text-muted">{contextLine}</p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* assessor-visit-pack-full-spec.md: links to Appian's login
                    page only -- no deep link, no data ever flows from Connect
                    into Appian. */}
                <a
                  href={appianHref(center?.appian_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[34px] items-center rounded-[6px] px-[14px] text-[12.5px] font-semibold no-underline transition-[filter] duration-150 hover:brightness-125"
                  style={{ background: BROWN, color: PAPER }}
                >
                  Open Appian
                </a>
                <a
                  href="/assessor/pack.pdf"
                  className="trainer-hover inline-flex h-[34px] items-center rounded-[6px] border px-[14px] text-[12.5px] font-semibold text-ink no-underline"
                  style={{ borderColor: "oklch(80% 0.03 70)" }}
                >
                  Download whole pack
                </a>
              </div>
              {/* Handbook 14.1's handover item and 15.2's precondition for the
                  assessor opening their report at all. */}
              <AppianReference
                compact
                reference={(course as { appian_notification_reference?: string | null }).appian_notification_reference ?? null}
              />
            </div>
          </header>

          <div className="grid grid-cols-1 items-start gap-8 px-5 pt-6 pb-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-0">
            <div className="min-w-0 lg:border-r lg:border-border lg:pr-8">
              {candidates.length === 0 ? (
                <p className="text-[13px] text-muted">No candidates on this course yet.</p>
              ) : (
                <CandidateWall
                  candidates={wallCandidates}
                  observeHeading={observeHeading}
                  observeNote={observeNote}
                  footLine={footLine}
                  toggleLabel={wantsFullCohort ? "Back to the selection" : "View the whole cohort"}
                  toggleHref={wantsFullCohort ? "/assessor" : "/assessor?cohort=full"}
                />
              )}
            </div>

            <div className="min-w-0 lg:pl-7">
              <VisitRail
                pack={packRows}
                dayLabel={visitDate ? weekdayDate(visitDate) : null}
                dayRows={dayRows}
                timetableHref="/trainer/timetable"
                requirements={requirements}
                alsoOnFile={alsoOnFile}
                tutors={(tutorRows ?? []).map((t) => ({
                  name: tutorNameById.get(t.profile_id) ?? "Unknown",
                  role: t.tutor_role,
                }))}
              />
            </div>
          </div>
        </div>
      </div>

      <DesignerCredit />
    </div>
  );
}

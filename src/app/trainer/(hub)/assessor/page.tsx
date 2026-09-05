import { hubReadClient } from "@/lib/supabase/hub-read";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRosterRows } from "@/lib/roster";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { AssessorCard } from "@/app/trainer/(hub)/assessor-card";
import { AssessorLinkButton } from "@/app/trainer/assessor-link-button";
import { AssessorSelectionButton } from "@/app/trainer/(hub)/roster/assessor-selection-button";
import { buildCentrePreparationList, centrePreparationDeadline, type AssessmentKind } from "@/lib/assessor-requirements";
import { assessorVisitDayProblem } from "@/lib/assessor-day";
import { computeAssessorReadiness } from "@/lib/assessor-pack";
import { DesignerCredit } from "@/components/designer-credit";

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
      }
    | null;

  const visitDate = course?.assessor_visit_date ?? null;
  const assessmentKind = (course?.assessment_kind ?? "regular") as AssessmentKind;
  const preparationDeadline = centrePreparationDeadline(visitDate);
  const centrePreparation = buildCentrePreparationList({
    assessmentKind,
    deliveryMode: course?.delivery_mode ?? "f2f",
    candidateCount: rows.length,
    withdrawnCount: withdrawnCount ?? 0,
  });
  const [visitDayProblem, readiness, { data: liveToken }] = await Promise.all([
    assessorVisitDayProblem(supabase, courseId, visitDate),
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

  const { data: selectionRows } =
    rows.length > 0 ? await supabase.from("profiles").select("id, selected_for_assessor_visit").in("id", rows.map((r) => r.id)) : { data: [] };
  const selectedById = new Map((selectionRows ?? []).map((r) => [r.id, r.selected_for_assessor_visit]));
  const candidates = rows.map((r) => ({ id: r.id, name: r.name, selected: selectedById.get(r.id) ?? true }));
  const selectedCount = candidates.filter((c) => c.selected).length;

  const daysToVisit = visitDate ? Math.ceil((Date.parse(`${visitDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">
          {course?.name ?? "Course"} &middot; Assessor visit
        </p>
        <h1 className="font-serif text-[30px] font-semibold text-ink-warm">Assessor</h1>
        <p className="max-w-[62ch] text-sm text-muted">
          Who is coming, which candidates they will see, and what the centre owes them before they arrive. Administration Handbook §14.
        </p>
      </div>

      {visitDayProblem ? (
        <div className="flex items-center gap-3 rounded-[10px] bg-destructive px-4 py-3 text-[13px] text-primary-foreground">
          <span className="rounded-full bg-[color-mix(in_oklab,white_22%,transparent)] px-2 py-[2px] text-[10px] font-bold tracking-[0.08em] uppercase">Visit day</span>
          <span className="flex-1 font-semibold">{visitDayProblem}</span>
          <Link href="/trainer/timetable?mode=edit" className="text-[12px] whitespace-nowrap underline">
            Nothing to observe &middot; §14.2 &rarr;
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
          <div className="flex flex-col items-end gap-1 text-right text-[12.5px]">
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

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
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
                Choose which candidates the assessor sees, then share the read-only link or email it to them. The link refuses to open until every
                selected portfolio is complete, and names what is missing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AssessorSelectionButton candidates={candidates} />
              <AssessorLinkButton />
              <Link
                href="/trainer/grades-report"
                className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainer-hover-fill"
              >
                Grade form &rarr;
              </Link>
              {packOpens ? (
                <a
                  href="/trainer/assessor/preview"
                  className="rounded-[6px] px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-[1.12]"
                  style={{ background: "var(--hub-accent)" }}
                >
                  Preview as the assessor &rarr;
                </a>
              ) : (
                <span className="rounded-[6px] border border-dashed border-border px-3 py-1.5 text-sm text-muted" title="Complete the portfolios first">
                  Preview not ready
                </span>
              )}
            </div>
            {!packOpens ? (
              <div className={`rounded-[10px] px-4 py-3 text-xs ${preview === "not-ready" ? "bg-card-inset text-ink" : "text-muted"}`}>
                <p className="font-semibold">The pack cannot open yet -- the link, the email and the preview all wait for this:</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {readiness.issues.map((i, n) => (
                    <li key={n}>
                      {i.traineeName}: {i.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted">
                {liveToken && !readiness.ready
                  ? `The link is already issued, so it, the email and the preview all open -- but ${readiness.issues.length} portfolio item${readiness.issues.length === 1 ? " is" : "s are"} still incomplete: ${readiness.issues.map((i) => `${i.traineeName}: ${i.reason}`).join("; ")}. `
                  : ""}
                The preview opens the pack through the same link the assessor gets, without accepting the terms on their behalf. &ldquo;Exit
                preview&rdquo; at the top brings you back here.
              </p>
            )}
          </section>
        </div>

        <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-card px-[22px] py-5">
          <div className="flex flex-col gap-[3px]">
            <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">What the assessor needs from you</p>
            <p className="text-sm text-muted">
              Administration Handbook §14.1.{" "}
              {preparationDeadline
                ? `Available by ${fmtDate(preparationDeadline, { day: "numeric", month: "long" })} — two to three days before the visit, so the assessor can read it.`
                : "Set a visit date and Connect will date this list for you."}
            </p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {centrePreparation.map((item) => (
              <li key={item.label} className="flex flex-col gap-[2px] border-t border-border-faint pt-2.5 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-semibold text-ink">
                    {item.label}
                    {item.conditional ? <span className="ml-2 text-[10px] font-bold tracking-[0.08em] text-gold uppercase">This course</span> : null}
                  </p>
                  <span className="shrink-0 text-[10px] font-semibold text-muted tabular-nums">§{item.cite}</span>
                </div>
                <p className="text-xs text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <DesignerCredit />
    </div>
  );
}

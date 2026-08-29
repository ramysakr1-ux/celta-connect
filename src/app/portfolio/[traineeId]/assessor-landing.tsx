import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCandidateCards } from "@/lib/assessor-pack";
import { halfOwningDate, halfTpDates } from "@/lib/rotation";
import { ASSIGNMENT_ORDER, ASSIGNMENT_INFO } from "@/lib/assignment-info";

// Ramy, 30 Aug 2026, specifying this after seeing both mock options: "click
// on the candidate card, it opens the portfolio, and then we have a
// combination of A and B. I like from option B the title, Daniel Kim's
// portfolio, everything the centre holds for this candidate, each line opens
// the record itself. And then underneath it, the teaching practice hours,
// hours assessed, teaching practice two of eight. And then we go to option A
// with those pills. And then you have the C5, assignments submitted by the
// candidate, the lesson plan -- only for the TP that the assessor is
// observing -- and then the rest of the candidate's files."
//
// Replaces the Course Stream for an assessor viewer. The stream is the
// candidate's own news feed ("0 broadcasts. No broadcasts yet."), which Ramy
// called "a strange place" to land when you have come to read a portfolio.
//
// The ordering is Handbook 12.1.1's -- Section A (the CELTA 5), Section C
// (the assignments), Section B (the teaching practice records) -- except that
// the lesson plan for the observed TP is lifted out of Section B and given
// its own card, because it is the one document the assessor reads before
// walking into a room rather than while moderating.

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";
const FAINT = "oklch(63% 0.012 82)";
const TEAL = "oklch(38% 0.072 195)";
const AMBER = "oklch(44% 0.1 68)";

export async function AssessorPortfolioLanding({ traineeId, courseId }: { traineeId: string; courseId: string }) {
  const admin = createAdminClient();

  // The name is looked up here rather than passed in: the portfolio page's own
  // profile select deliberately doesn't carry full_name (the layout header
  // owns the candidate's identity), and widening that select for one string
  // would touch a query five other blocks on that page read.
  const { data: person } = await admin
    .from("profiles")
    .select("full_name, special_consideration, special_consideration_arrangements")
    .eq("id", traineeId)
    .maybeSingle();
  const traineeName = person?.full_name ?? "This candidate";

  const [{ data: course }, { data: record }, cards, { data: assignments }, { data: pctResponses }, { data: letters }, { data: malpractice }] =
    await Promise.all([
      admin.from("courses").select("name, total_hours, assessor_visit_date, center_id").eq("id", courseId).maybeSingle(),
      admin.from("celta5_records").select("hours_attended").eq("trainee_id", traineeId).maybeSingle(),
      buildCandidateCards(admin, courseId),
      admin.from("assignments").select("assignment_type, first_status, resubmission_status").eq("trainee_id", traineeId),
      // Answered sections only -- the section TOTAL lives on the centre, which
      // isn't known until `course` resolves, and "N answered" is the honest
      // number anyway: a centre can add sections after a candidate finishes.
      admin.from("pre_course_task_responses").select("response").eq("trainee_id", traineeId),
      // Handbook 12.1.1 Section A, "where appropriate": a fail warning letter
      // and a candidate letter of withdrawal are portfolio content in their
      // own right, and 14.2 has the assessor "check documentation for any
      // candidate who has withdrawn". Ramy, 30 Aug 2026: "if there was a fail
      // letter or something to do with plagiarism, that could live in a third
      // pill. But if there isn't, then that third pill will be inactive."
      admin.from("formal_letters").select("letter_type, issued_at").eq("trainee_id", traineeId),
      admin.from("malpractice_cases").select("id, opened_at").eq("trainee_id", traineeId),
    ]);
  const card = cards.find((c) => c.traineeId === traineeId) ?? null;

  // Which TP this candidate teaches on the visit day -- the same rotation
  // derivation the assessor's "Lesson plans for the day" page makes, since no
  // table stores a date against a plan.
  const visitDate = course?.assessor_visit_date ?? null;
  const { data: tpEvents } = visitDate
    ? await admin.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp")
    : { data: null };
  const half = visitDate ? halfOwningDate(tpEvents ?? [], visitDate) : null;
  const observedTp = half && visitDate ? halfTpDates(tpEvents ?? [], half).indexOf(visitDate) + 1 : 0;

  const [{ data: observedPlan }, { data: inSubgroup }] = await Promise.all([
    observedTp > 0
      ? admin
          .from("tp_plans")
          .select("main_aims, subsidiary_aims, submitted_at")
          .eq("trainee_id", traineeId)
          .eq("tp_number", observedTp)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Whether this candidate is in the half that teaches on the visit day.
    //
    // Ramy, 30 Aug 2026: "the assessor observes usually two lessons and
    // observes feedback... sometimes things change and the assessor observes
    // maybe first and third, or first and second. So all three of them will
    // have the lesson plan included, but no other lesson plans are required."
    //
    // So this is deliberately NOT an attempt to work out which two lessons
    // get observed -- nobody knows that until the day. Everyone teaching on
    // the visit day carries their plan; the other half teaches nothing that
    // day, so a plan card for them would be a lesson nobody will watch.
    half
      ? admin
          .from("course_subgroup_members")
          .select("subgroup_id, course_subgroups!inner(half_order)")
          .eq("trainee_id", traineeId)
          .eq("course_subgroups.half_order", half)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const teachesOnVisitDay = Boolean(inSubgroup) && observedTp > 0;

  const submitted = (assignments ?? []).filter((a) => a.first_status !== "not_submitted").length;
  const approved = (assignments ?? []).filter((a) => {
    const resubRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
    return (resubRound ? a.resubmission_status : a.first_status) === "approved";
  }).length;
  const unresolved = (assignments ?? []).find((a) => {
    const resubRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
    return (resubRound ? a.resubmission_status : a.first_status) !== "approved";
  });

  // Migration 0237 replaced the section-keyed table with an item-keyed one
  // that has no submit step -- a non-empty response IS the answer, so that is
  // what gets counted rather than a submitted_at that no longer exists.
  const pctAnswered = (pctResponses ?? []).filter((r) => (r.response ?? "").trim().length > 0).length;

  // Ramy, 30 Aug 2026: "if there is a special requirement, yeah, it should be
  // there." Handbook 7 has the candidate agreement carry a Candidate
  // Declaration confirming whether they need special consideration, so that
  // "reasonable adjustments are made prior to the course starting and
  // throughout" -- an assessor moderating a judgement needs to know
  // adjustments were in place.
  //
  // But 12.2 is equally explicit the other way: "Centres must limit the
  // amount of candidate personal information shared with Cambridge English...
  // The only personal information required is candidate names." And
  // profiles.special_consideration is deliberately free-text health-adjacent
  // disclosure (0055: "serious illness, bereavement"), staff-visible only.
  //
  // So the line shows WHAT was arranged and never WHY. The arrangements are
  // a fixed multi-select (extended time, materials in advance) and are the
  // part that bears on assessment; the reason stays with the centre, which is
  // where 12.2 wants it.
  const arrangements = (person?.special_consideration_arrangements ?? []) as string[];
  const hasDeclaration = arrangements.length > 0 || Boolean((person?.special_consideration ?? "").trim());

  const letterCount = (letters ?? []).length;
  const caseCount = (malpractice ?? []).length;
  const formalRecordCount = letterCount + caseCount;

  const hoursAttended = record?.hours_attended ?? 0;
  const totalHours = course?.total_hours ?? 120;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">{traineeName}&apos;s portfolio</h1>
        <p className="mt-1 text-sm text-muted">
          Everything the centre holds for this candidate. Each line opens the record itself.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-9 gap-y-4 border-b border-border pb-4">
        <Figure label="Teaching practice" value={`${card?.tpsTaught ?? 0}`} of="of 8" />
        <Figure label="Hours assessed" value={(card?.hoursAssessed ?? 0).toFixed(1)} of="of 6" />
        <Figure label="Attendance" value={`${hoursAttended}`} of={`of ${totalHours}`} />
        <Figure
          label="Provisional grade"
          value={card?.provisionalLabel ?? "—"}
          ink={card?.provisionalLabel ? undefined : AMBER}
        />
      </div>

      {hasDeclaration ? (
        <div
          className="rounded-[8px] px-4 py-3"
          style={{
            background: "color-mix(in oklab, oklch(44% 0.1 68) 8%, var(--color-card))",
            border: "1px solid color-mix(in oklab, oklch(44% 0.1 68) 28%, transparent)",
            borderLeft: `3px solid ${AMBER}`,
          }}
        >
          <p className="text-[10px] font-bold tracking-[0.09em] uppercase" style={{ color: AMBER }}>
            Special arrangements in place
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: INK }}>
            {arrangements.length > 0
              ? arrangements.join(" · ")
              : "Arrangements were agreed with this candidate."}
          </p>
          <p className="mt-1 text-[11.5px]" style={{ color: MUTED }}>
            The reason is held by the centre and not shown here — Handbook §12.2 limits the personal information shared
            with Cambridge to candidate names. Ask the main course tutor if you need it.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <Card
          n={1}
          title="CELTA 5 record"
          detail={card?.celta5Detail ?? "No CELTA 5 record started yet"}
          state={card?.celta5Complete ? "Complete" : "Incomplete"}
          open={card?.celta5Complete !== true}
          href={`/portfolio/${traineeId}/celta5`}
          note="Attendance, observations, teaching practice, assignment marks and the stage records — Handbook §12.1.1 Section A."
        />

        <Card
          n={2}
          title="Written assignments"
          detail={
            unresolved
              ? `${approved} of 4 passed. ${ASSIGNMENT_INFO[unresolved.assignment_type]?.title ?? unresolved.assignment_type} is unresolved.`
              : `${approved} of 4 passed, ${submitted} submitted.`
          }
          state={card?.assignmentsComplete ? "Complete" : (card?.flaggedIssue ?? "Incomplete")}
          open={card?.assignmentsComplete !== true}
          href={`/portfolio/${traineeId}/assignments`}
          note={`First attempts and resubmissions, marked by the tutors — Section C. ${ASSIGNMENT_ORDER.length} titles, the same for the whole cohort.`}
        />

        {teachesOnVisitDay ? (
          <Card
            n={3}
            title={`Lesson plan for TP${observedTp}`}
            detail={
              observedPlan
                ? observedPlan.main_aims ?? "Plan started, no main aims written yet."
                : `No plan submitted for TP${observedTp} yet.`
            }
            state={observedPlan?.submitted_at ? "Submitted" : observedPlan ? "Draft" : "Not started"}
            open={!observedPlan?.submitted_at}
            href={`/portfolio/${traineeId}/tp/${observedTp}`}
            note="The lesson they teach on the visit day. Every candidate teaching that day carries their plan, since which two get observed is decided on the day."
          />
        ) : null}

        <Card
          n={teachesOnVisitDay ? 4 : 3}
          title="The rest of the candidate's files"
          detail="Every assessed teaching practice — plan, the candidate's own evaluation, materials, and the tutors' feedback."
          state={card?.tpsComplete ? "8 of 8 taught" : `${card?.tpsTaught ?? 0} of 8 taught`}
          open={card?.tpsComplete !== true}
          href={`/portfolio/${traineeId}/tp`}
          note="Section B. Their pre-course task and application are below."
        />
      </div>

      {/* Ramy, 30 Aug 2026: first "I don't know why you made them these
          arrows instead of having them sitting inside a card like the rest",
          then "we could make them like three pills next to each other with
          the whole width, just to show that they're not as important."
          
          The arrows were wrong because they read as an afterthought; full
          cards would have been wrong the other way, putting the pre-course
          task on a level with the CELTA 5. Three equal pills across the width
          says "also here, and secondary" in the shape itself, so the numbered
          cards keep the Handbook's own hierarchy. */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Pill
          title="Pre-course task"
          state={
            pctAnswered > 0
              ? `${pctAnswered} section${pctAnswered === 1 ? "" : "s"} answered`
              : "Not handed in"
          }
          muted={pctAnswered === 0}
          href={`/portfolio/${traineeId}/pre-course-task`}
        />
        {/* Ramy, 30 Aug 2026: "I don't want the resources there, and I don't
            want their timetable. I think we should have the pre-course task,
            and then we'll have the application form." Both dropped were the
            same for every candidate and neither is portfolio content -- the
            resource hub is the centre's library and the cohort timetable is
            already in the pack, so per-candidate copies were noise. The
            application is the opposite: Handbook 12.2 requires the completed
            selection task and interview notes to be available to the
            assessor, and it is the start of this candidate's journey. */}
        <Pill title="Application" state="Selection task and interview" href={`/portfolio/${traineeId}/application`} />
        <Pill
          title="Letters and cases"
          state={
            formalRecordCount === 0
              ? "None on this candidate"
              : [
                  letterCount > 0 ? `${letterCount} letter${letterCount === 1 ? "" : "s"}` : null,
                  caseCount > 0 ? `${caseCount} malpractice case${caseCount === 1 ? "" : "s"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
          muted={formalRecordCount > 0}
          href={formalRecordCount > 0 ? `/portfolio/${traineeId}/letters` : null}
        />
      </div>

      <p className="text-xs text-muted">
        Read-only. Nothing here can be edited, and nothing you open is recorded against the candidate.
      </p>
    </div>
  );
}

function Figure({ label, value, of, ink }: { label: string; value: string; of?: string; ink?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.05em] text-muted uppercase">{label}</p>
      <p className="mt-1 font-serif text-[21px] leading-none" style={{ color: ink ?? INK }}>
        {value}
        {of ? <span className="ml-1.5 font-sans text-[13px] text-muted">{of}</span> : null}
      </p>
    </div>
  );
}

function Pill({
  title,
  state,
  href,
  muted,
}: {
  title: string;
  state: string;
  /** null renders the pill inert -- there is nothing behind it to open. */
  href: string | null;
  muted?: boolean;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold" style={{ color: INK }}>
          {title}
        </span>
        <span className="block truncate text-[11px]" style={{ color: muted ? AMBER : MUTED }}>
          {state}
        </span>
      </span>
      <span className="shrink-0 text-[11px] font-semibold" style={{ color: href ? TEAL : "transparent" }}>
        →
      </span>
    </>
  );
  const cls = "card flex items-center justify-between gap-2 rounded-full px-4 py-2.5";
  // An empty pill stays visible rather than disappearing: "no fail letter"
  // is itself a fact the assessor wants, and a pill that comes and goes
  // between candidates makes the set harder to read at a glance.
  return href ? (
    <Link href={href} className={`assessor-hover no-underline ${cls}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={{ opacity: 0.62 }}>
      {body}
    </div>
  );
}

function Card({
  n,
  title,
  detail,
  state,
  open,
  href,
  note,
}: {
  n: number;
  title: string;
  detail: string;
  state: string;
  open: boolean;
  href: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="assessor-hover card flex items-start gap-3 p-4 no-underline"
      style={{ borderLeft: `3px solid ${open ? AMBER : TEAL}` }}
    >
      <span className="shrink-0 pt-[3px] text-[10px] font-bold tabular-nums" style={{ color: MUTED }}>
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[13.5px] font-semibold" style={{ color: INK }}>
            {title}
          </span>
          <span className="text-[11px] font-semibold" style={{ color: open ? AMBER : TEAL }}>
            {state}
          </span>
        </span>
        <span className="mt-0.5 block text-[12.5px]" style={{ color: MUTED }}>
          {detail}
        </span>
        <span className="mt-1.5 block text-[11.5px]" style={{ color: FAINT }}>
          {note}
        </span>
      </span>
      <span className="shrink-0 pt-[3px] text-[11px] font-semibold" style={{ color: TEAL }}>
        Open →
      </span>
    </Link>
  );
}

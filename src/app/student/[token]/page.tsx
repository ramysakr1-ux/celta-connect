import { createAdminClient } from "@/lib/supabase/admin";
import { VolunteerSignupForm } from "@/app/student/[token]/signup-form";
import { DeclineButton } from "@/app/student/[token]/decline-button";
import { ClassMaterialsLink } from "@/app/student/[token]/class-materials-link";
import { SIGNUP_QUESTIONS } from "@/lib/fol/volunteer-signup-questions";
import { Wordmark } from "@/components/wordmark";
import { DesignerCredit } from "@/components/designer-credit";
import { Greeting } from "@/app/student/[token]/greeting";
import { getVolunteerIdentityData, TICK_THRESHOLD_MINUTES, CERTIFICATE_HOURS_THRESHOLD } from "@/lib/volunteer-cross-course";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import { subscribeVolunteerPush, unsubscribeVolunteerPush } from "@/lib/push/actions";

// Four evenly-spaced markers scaled to whatever the centre has set --
// quarters of the threshold, rounded to the nearest 10 hours, rather than
// the old fixed 40/80/120/160 which only made sense at the default value.
function milestonesFor(threshold: number): number[] {
  const step = Math.max(Math.round(threshold / 4 / 10) * 10, 1);
  const marks = [step, step * 2, step * 3, threshold];
  return [...new Set(marks)].sort((a, b) => a - b);
}

function formatEventDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
  const dayLabel = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (diffDays === 0) return `Today, ${dayLabel}`;
  if (diffDays === 1) return `Tomorrow, ${dayLabel}`;
  return dayLabel;
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// volunteer-view-full-spec.md: Attended/Missed retired the green/amber
// semantic pills for a shared neutral ink -- only the background tint tells
// them apart -- and Upcoming keeps its own blue. No matching token exists
// for the two neutral tints (they're close to but not the same as
// --color-status-neutral-bg), so these are literal, page-scoped, same as
// the header bar's own near-white below.
function StatusPill({ attended }: { attended: boolean | null }) {
  if (attended === null) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
        style={{ background: "oklch(93% 0.045 235)", color: "oklch(42% 0.095 250)" }}
      >
        <span className="size-1.5 rounded-full bg-current" />
        Upcoming
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        background: attended ? "oklch(93% 0.014 70)" : "oklch(93.5% 0.012 85)",
        color: "oklch(51% 0.017 70)",
      }}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {attended ? "Attended" : "Missed"}
    </span>
  );
}

// volunteer-view-full-spec.md 1a/1b: 4 tiles, always the same 4 words in
// order -- Earned (reached), Next (the one coming up), an unlabeled dash for
// anything further out, and Certificate for the final tile always (that one
// is a fixed identity, the threshold itself, not a state -- even a
// volunteer who has already passed it still sees "Certificate" there, just
// in the Earned colour treatment).
function MilestoneTile({ hours, hoursCredited, isLast, isNext }: { hours: number; hoursCredited: number; isLast: boolean; isNext: boolean }) {
  const earned = hoursCredited >= hours;
  const label = isLast ? "Certificate" : earned ? "Earned" : isNext ? "Next" : "—";
  const style = earned
    ? { background: "color-mix(in oklab, var(--color-ink-warm) 12%, var(--color-card))", borderColor: "color-mix(in oklab, var(--color-ink-warm) 30%, transparent)", color: "var(--color-ink-warm)" }
    : isNext
      ? { background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-ink-warm)" }
      : { background: "transparent", borderColor: "transparent", color: "var(--color-muted)" };
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-[6px] border px-1 py-1.5 text-center" style={style}>
      <span className="text-xs font-bold">{hours}h</span>
      <span className="text-[9px] font-semibold tracking-[0.06em] uppercase">{label}</span>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

// Path lifted directly from Volunteer View - standalone.html's own "Join
// online" button markup, not redrawn from a generic icon set.
function VideoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 10l4.5-2.5v9L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

interface RowMaterial {
  id: string;
  name: string;
  url: string;
}

// Volunteer View.dc.html, written 14 Aug 2026, rebuilt to
// volunteer-view-full-spec.md 25 Aug 2026 -- two structurally different
// layouts (phone card-in-frame, desktop table + banner), not one reflowed
// tree, per the spec's own "1a/1b" framing. No login, no password --
// resolved entirely from a tokenized, course-scoped, auto-expiring link
// (migration 0030), every read going through the admin client with
// explicit scoping (there is no auth.uid() session on this path at all).
export default async function StudentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("*")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken || !accessToken.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-accent p-8 text-center">
          <Wordmark size="hero" />
          <p className="mt-4 text-sm text-destructive">
            This link has expired or isn&apos;t valid. Ask your teacher for a new one.
          </p>
        </div>
        </div>
      </div>
    );
  }

  const [{ data: volunteer }, { data: course }, { data: sharedMaterials }] = await Promise.all([
    admin.from("volunteer_students").select("name, signup_completed_at").eq("id", accessToken.volunteer_student_id).maybeSingle(),
    admin.from("courses").select("name, end_date, center_id").eq("id", accessToken.course_id).maybeSingle(),
    admin
      .from("volunteer_shared_materials")
      .select("id, created_at, tp_materials(id, file_name, slides_url, storage_path, tp_plans(tp_number))")
      .eq("course_id", accessToken.course_id)
      .order("created_at", { ascending: false }),
  ]);

  if (!volunteer) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-accent p-8 text-center">
          <Wordmark size="hero" />
          <p className="mt-4 text-sm text-destructive">This link isn&apos;t valid. Ask your teacher for a new one.</p>
        </div>
        </div>
      </div>
    );
  }

  // One-time collection, before the ongoing dashboard ever shows -- feeds
  // FOL's pooled-evidence model (class_error_log/fol_claims), unlocked to
  // candidates only from the course's Day-10 divergence session on.
  if (!volunteer.signup_completed_at) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container flex items-center gap-4 py-6">
          <Wordmark size="header" />
        </div>
        <div className="container pb-16">
          <div className="frame mx-auto flex max-w-xl flex-col gap-6 p-6">
            <div>
              <p className="text-sm font-medium text-muted uppercase tracking-wide">{course?.name ?? "Your course"}</p>
              <h1 className="mt-1 font-serif text-3xl text-ink">Welcome, {volunteer.name}!</h1>
              <p className="mt-2 text-sm text-muted">
                Before your first class, tell us a bit about yourself -- this helps your teachers get to know you.
              </p>
            </div>
            <div className="card p-6">
              <VolunteerSignupForm token={token} questions={SIGNUP_QUESTIONS} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [{ hoursCredited, classes }, { data: centerForThreshold }] = await Promise.all([
    getVolunteerIdentityData(admin, accessToken.volunteer_student_id),
    course?.center_id
      ? admin.from("centers").select("volunteer_certificate_hours_threshold").eq("id", course.center_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const certificateHoursThreshold = centerForThreshold?.volunteer_certificate_hours_threshold ?? CERTIFICATE_HOURS_THRESHOLD;

  // Scoped to this token's own course only (not the cross-course list
  // below) -- the decline action re-resolves volunteer_student_id from the
  // token itself, so the class shown here must belong to that same row.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = classes
    .filter((c) => c.courseId === accessToken.course_id && c.eventDate >= today)
    .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1));
  const nextClass = upcoming[0] ?? null;

  const { data: nextClassDecline } = nextClass
    ? await admin
        .from("volunteer_declines")
        .select("id")
        .eq("volunteer_student_id", accessToken.volunteer_student_id)
        .eq("timetable_event_id", nextClass.eventId)
        .maybeSingle()
    : { data: null };

  // "Teachers"/"topic" for the next class -- linked_tp_number is matched by
  // VALUE against plan_assignments.tp_number (not a foreign key), and one
  // calendar TP day can host several trainees' rotation slots, so this
  // shows everyone teaching that round rather than a single "the" lesson.
  let nextClassTeachers: { name: string; topic: string | null }[] = [];
  if (nextClass?.linkedTpNumber != null) {
    const { data: assignments } = await admin
      .from("plan_assignments")
      .select("trainee_id, short_title, main_lesson_aim")
      .eq("course_id", nextClass.courseId)
      .eq("tp_number", nextClass.linkedTpNumber);
    const traineeIds = [...new Set((assignments ?? []).map((a) => a.trainee_id))];
    const { data: trainerProfiles } = traineeIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", traineeIds)
      : { data: [] };
    const nameById = new Map((trainerProfiles ?? []).map((p) => [p.id, p.full_name]));
    nextClassTeachers = (assignments ?? []).map((a) => ({
      name: nameById.get(a.trainee_id) ?? "Your teacher",
      topic: a.short_title || a.main_lesson_aim || null,
    }));
  }

  // "This course" -- deliberately narrower than the cross-course hours
  // above: N of M classes attended, this course only, no percentage.
  const thisCourseClasses = classes.filter((c) => c.courseId === accessToken.course_id);
  const thisCourseAttended = thisCourseClasses.filter((c) => c.attended === true).length;
  const thisCourseHeldSoFar = thisCourseClasses.filter((c) => c.attended !== null).length;

  // Resolved server-side with the admin client -- a volunteer has no
  // Supabase session at all, so a browser client could never sign a
  // storage URL themselves the way a trainee's own MaterialsSection does.
  const resolvedMaterials = await Promise.all(
    (sharedMaterials ?? []).map(async (row) => {
      const material = row.tp_materials as unknown as {
        id: string;
        file_name: string | null;
        slides_url: string | null;
        storage_path: string | null;
        tp_plans: { tp_number: number } | null;
      } | null;
      if (!material) return null;

      let url = material.slides_url;
      if (!url && material.storage_path) {
        const { data: signed } = await admin.storage.from("tp-materials").createSignedUrl(material.storage_path, 3600);
        url = signed?.signedUrl ?? null;
      }
      if (!url) return null;

      return { id: material.id, name: material.file_name ?? "Material", url, tpNumber: material.tp_plans?.tp_number ?? null };
    })
  );
  const materials = resolvedMaterials.filter((m): m is NonNullable<typeof m> => m !== null);
  const materialsByTpNumber = new Map<number, RowMaterial[]>();
  for (const m of materials) {
    if (m.tpNumber == null) continue;
    const list = materialsByTpNumber.get(m.tpNumber) ?? [];
    list.push({ id: m.id, name: m.name, url: m.url });
    materialsByTpNumber.set(m.tpNumber, list);
  }

  // "Your classes" list/table -- volunteer-view-full-spec.md shows a Topic
  // column per row, not just a date, so this needs the same
  // linked_tp_number -> plan_assignments lookup nextClass gets above, just
  // batched across every class in the list (which can span more than one
  // course -- "hours are the unit, never levels or courses").
  const listClasses = classes.slice(0, 12);
  const tpKeysNeeded = listClasses.filter((c) => c.linkedTpNumber != null).map((c) => ({ courseId: c.courseId, tpNumber: c.linkedTpNumber as number }));
  const listCourseIds = [...new Set(tpKeysNeeded.map((k) => k.courseId))];
  const { data: listAssignments } = listCourseIds.length
    ? await admin.from("plan_assignments").select("course_id, tp_number, short_title, main_lesson_aim").in("course_id", listCourseIds)
    : { data: [] };
  const topicByKey = new Map<string, string>();
  for (const a of listAssignments ?? []) {
    const key = `${a.course_id}:${a.tp_number}`;
    if (!topicByKey.has(key) && (a.short_title || a.main_lesson_aim)) {
      topicByKey.set(key, (a.short_title || a.main_lesson_aim) as string);
    }
  }
  const rows = listClasses.map((c) => ({
    ...c,
    topic: c.linkedTpNumber != null ? (topicByKey.get(`${c.courseId}:${c.linkedTpNumber}`) ?? null) : null,
    rowMaterials: c.courseId === accessToken.course_id && c.linkedTpNumber != null ? (materialsByTpNumber.get(c.linkedTpNumber) ?? []) : [],
  }));

  const hoursRemaining = Math.max(certificateHoursThreshold - hoursCredited, 0);
  const progressPct = Math.min((hoursCredited / certificateHoursThreshold) * 100, 100);
  const milestones = milestonesFor(certificateHoursThreshold);
  const nextMilestoneIndex = milestones.findIndex((m) => hoursCredited < m);
  const perClassHours = TICK_THRESHOLD_MINUTES / 60 + 0.75;

  const firstName = volunteer.name.split(" ")[0];
  const endDateLabel = course?.end_date ? new Date(`${course.end_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
  const headline = nextClass ? `Your next class is ${formatEventDate(nextClass.eventDate).split(",")[0].toLowerCase()}` : "No classes scheduled yet";
  const whereLabel = nextClass?.zoomUrl ? "Online" : "In person at the centre";
  const topicLabel = nextClassTeachers.find((t) => t.topic)?.topic ?? null;
  const teachersLabel = nextClassTeachers.length > 0 ? nextClassTeachers.map((t) => t.name).join(" and ") : null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8 md:py-12">
      {/* volunteer-view-full-spec.md 1a/1b: the whole page -- header AND
          body -- lives inside ONE bordered/rounded shell floating on the
          page ground (390px/22px-radius on phone, a wider 6px-radius "mat"
          on desktop), not a full-bleed page. Confirmed by inspecting the
          mockup's own computed layout directly (Volunteer View -
          standalone.html), not just its prose -- a first pass at this page
          built the content full-width with no enclosing card at all, which
          read as "not really a replica" once compared side by side. */}
      <div className="w-full max-w-[390px] overflow-hidden rounded-[22px] border border-border bg-card md:max-w-[1100px] md:overflow-visible md:rounded-[6px] md:p-[22px]">
        {/* Inner near-white panel -- inert on phone (header/body sit
            directly on the shell above), becomes its own bordered/rounded
            panel on desktop (the "mat" effect around a white page). */}
        <div className="md:rounded-[6px] md:border md:border-border">
          <div className="hidden md:block md:rounded-[6px]" style={{ background: "oklch(99.2% 0.005 90)" }}>
            {/* Header bar */}
            <header className="flex h-[52px] items-center justify-between border-b border-border px-5">
              <Wordmark size="header-compact" />
              <Greeting name={volunteer.name} suffix="volunteer student" className="text-xs text-muted" />
            </header>

            <div className="grid grid-cols-[1.35fr_1fr] gap-5 p-[22px_20px]">
              <div className="flex flex-col gap-3.5">
                <TitleBlock course={course} endDateLabel={endDateLabel} headline={headline} desktop />
                {nextClass ? (
                  <NextClassBanner
                    nextClass={nextClass}
                    whereLabel={whereLabel}
                    topicLabel={topicLabel}
                    teachersLabel={teachersLabel}
                    token={token}
                    nextClassDecline={nextClassDecline}
                  />
                ) : null}
                <ClassesTable rows={rows} />
              </div>
              <div className="flex flex-col gap-3.5">
                <HoursCard
                  hoursCredited={hoursCredited}
                  hoursRemaining={hoursRemaining}
                  perClassHours={perClassHours}
                  progressPct={progressPct}
                  milestones={milestones}
                  nextMilestoneIndex={nextMilestoneIndex}
                />
                <ThisCourseCard thisCourseAttended={thisCourseAttended} thisCourseHeldSoFar={thisCourseHeldSoFar} thisCourseClasses={thisCourseClasses} />
              </div>
            </div>
            <Footer endDateLabel={endDateLabel} materials={materials} token={token} />
          </div>

          {/* Phone -- header flush at the very top of the shell, body
              padded 18px 16px 26px, one column. */}
          <div className="md:hidden">
            <header className="flex h-[54px] items-center justify-between border-b border-border px-4" style={{ background: "oklch(99.2% 0.005 90)" }}>
              <Wordmark size="header-compact" />
              <Greeting name={firstName} className="text-xs text-muted" />
            </header>

            <div className="flex flex-col gap-4 px-4 pt-[18px] pb-[26px]">
              <TitleBlock course={course} endDateLabel={endDateLabel} headline={headline} desktop={false} />
              {nextClass ? (
                <NextClassCard
                  nextClass={nextClass}
                  whereLabel={whereLabel}
                  topicLabel={topicLabel}
                  teachersLabel={teachersLabel}
                  course={course}
                  token={token}
                  nextClassDecline={nextClassDecline}
                />
              ) : null}
              <ClassesList rows={rows} attendedCount={thisCourseAttended} />
              <HoursCard
                hoursCredited={hoursCredited}
                hoursRemaining={hoursRemaining}
                perClassHours={perClassHours}
                progressPct={progressPct}
                milestones={milestones}
                nextMilestoneIndex={nextMilestoneIndex}
              />
              <ThisCourseCard thisCourseAttended={thisCourseAttended} thisCourseHeldSoFar={thisCourseHeldSoFar} thisCourseClasses={thisCourseClasses} />
              <Footer endDateLabel={endDateLabel} materials={materials} token={token} />
            </div>
          </div>
        </div>
      </div>

      <DesignerCredit corner="bottom-right" />
    </div>
  );
}

function TitleBlock({
  course,
  endDateLabel,
  headline,
  desktop,
}: {
  course: { name: string } | null;
  endDateLabel: string | null;
  headline: string;
  desktop: boolean;
}) {
  return (
    <div>
      <p className={`font-bold text-muted uppercase ${desktop ? "text-[11px] tracking-[0.08em]" : "text-[10px] tracking-[0.08em]"}`}>
        {course?.name ?? "Your course"}
        {desktop && endDateLabel ? ` · until ${endDateLabel}` : ""}
      </p>
      <h1 className={`mt-1 font-serif font-semibold text-ink ${desktop ? "text-[22px]" : "text-[21px]"}`}>{headline}</h1>
    </div>
  );
}

function NextClassFacts({ whereLabel, topicLabel, teachersLabel }: { whereLabel: string; topicLabel: string | null; teachersLabel: string | null }) {
  const facts: [string, string][] = [["Where", whereLabel]];
  if (topicLabel) facts.push(["Topic", topicLabel]);
  if (teachersLabel) facts.push(["Teachers", teachersLabel]);
  return (
    <div className="flex flex-col gap-1.5">
      {facts.map(([label, value]) => (
        <div key={label} className="flex gap-2.5 text-[13px] text-ink">
          <span className="w-[62px] shrink-0 text-[10px] font-bold tracking-[0.06em] text-muted uppercase">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

interface NextClassLike {
  eventId: string;
  eventDate: string;
  eventTime: string | null;
  zoomUrl: string | null;
}

function NextClassCard({
  nextClass,
  whereLabel,
  topicLabel,
  teachersLabel,
  course,
  token,
  nextClassDecline,
}: {
  nextClass: NextClassLike;
  whereLabel: string;
  topicLabel: string | null;
  teachersLabel: string | null;
  course: { name: string } | null;
  token: string;
  nextClassDecline: { id: string } | null;
}) {
  return (
    <div
      className="flex flex-col gap-[13px] rounded-[10px] border p-4"
      style={{ borderColor: "color-mix(in oklab, var(--color-primary) 32%, transparent)", background: "oklch(99.2% 0.005 90)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-serif text-[19px] font-semibold text-ink">{formatEventDate(nextClass.eventDate)}</p>
        {nextClass.eventTime ? <p className="text-[13px] font-semibold text-primary tabular-nums">{nextClass.eventTime.slice(0, 5)}</p> : null}
      </div>
      <NextClassFacts whereLabel={whereLabel} topicLabel={topicLabel} teachersLabel={teachersLabel} />
      <div className="flex items-center gap-2">
        {nextClass.zoomUrl ? (
          <a
            href={nextClass.zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-primary text-sm font-semibold text-primary-foreground"
          >
            <VideoIcon />
            Join online
          </a>
        ) : null}
        <a
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(
            `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${course?.name ?? "Class"}\nDTSTART:${nextClass.eventDate.replace(/-/g, "")}\nEND:VEVENT\nEND:VCALENDAR`
          )}`}
          download="class.ics"
          title="Add to calendar"
          className="admin-hover-fill flex size-11 shrink-0 items-center justify-center rounded-[8px] border border-border text-muted"
        >
          <CalendarIcon />
        </a>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border-faint pt-3">
        <DeclineButton token={token} eventId={nextClass.eventId} alreadyDeclined={Boolean(nextClassDecline)} />
      </div>
    </div>
  );
}

function NextClassBanner({
  nextClass,
  whereLabel,
  topicLabel,
  teachersLabel,
  token,
  nextClassDecline,
}: {
  nextClass: NextClassLike;
  whereLabel: string;
  topicLabel: string | null;
  teachersLabel: string | null;
  token: string;
  nextClassDecline: { id: string } | null;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border p-4"
      style={{ borderColor: "color-mix(in oklab, var(--color-primary) 30%, transparent)", background: "var(--color-card)" }}
    >
      <div>
        <p className="font-serif text-[17px] font-semibold text-ink">
          {formatEventDate(nextClass.eventDate)}
          {nextClass.eventTime ? ` · ${nextClass.eventTime.slice(0, 5)}` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">{[whereLabel, topicLabel, teachersLabel ? `with ${teachersLabel}` : null].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex items-center gap-3">
        <DeclineButton token={token} eventId={nextClass.eventId} alreadyDeclined={Boolean(nextClassDecline)} />
        {nextClass.zoomUrl ? (
          <a
            href={nextClass.zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[38px] items-center gap-2 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <VideoIcon />
            Join online
          </a>
        ) : null}
      </div>
    </div>
  );
}

interface ClassRow {
  eventId: string;
  eventDate: string;
  topic: string | null;
  courseName: string;
  attended: boolean | null;
  rowMaterials: RowMaterial[];
}

function ClassesList({ rows, attendedCount }: { rows: ClassRow[]; attendedCount: number }) {
  return (
    <div id="classes" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Your classes</p>
        <p className="text-[11px] text-muted">{attendedCount} attended</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No classes scheduled yet.</p>
      ) : (
        rows.map((c) => (
          <div key={c.eventId} className="flex flex-col gap-2 rounded-[10px] border border-border bg-card px-[14px] py-[13px]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{c.topic ?? c.courseName}</p>
              <p className="shrink-0 text-[11px] text-muted">{formatShortDate(c.eventDate)}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill attended={c.attended} />
              <ClassMaterialsLink materials={c.rowMaterials} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ClassesTable({ rows }: { rows: ClassRow[] }) {
  return (
    <div id="classes" className="overflow-hidden rounded-[6px] border border-border">
      <div
        className="grid grid-cols-[96px_1fr_128px_150px] border-b border-border px-4 py-2 text-[9px] font-bold tracking-[0.06em] text-muted uppercase"
        style={{ background: "var(--color-card)" }}
      >
        <div>Date</div>
        <div>Topic</div>
        <div>Attendance</div>
        <div>Materials</div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No classes scheduled yet.</p>
      ) : (
        rows.map((c, i) => (
          <div
            key={c.eventId}
            className={`grid grid-cols-[96px_1fr_128px_150px] items-center px-4 py-2.5 text-xs text-ink ${i > 0 ? "border-t border-border-faint" : ""}`}
          >
            <div className="text-muted">{formatShortDate(c.eventDate)}</div>
            <div className="truncate">{c.topic ?? c.courseName}</div>
            <div>
              <StatusPill attended={c.attended} />
            </div>
            <div>{c.rowMaterials.length > 0 ? <ClassMaterialsLink materials={c.rowMaterials} /> : <span className="text-muted">—</span>}</div>
          </div>
        ))
      )}
    </div>
  );
}

function HoursCard({
  hoursCredited,
  hoursRemaining,
  perClassHours,
  progressPct,
  milestones,
  nextMilestoneIndex,
}: {
  hoursCredited: number;
  hoursRemaining: number;
  perClassHours: number;
  progressPct: number;
  milestones: number[];
  nextMilestoneIndex: number;
}) {
  return (
    <div
      className="rounded-[10px] border p-3.5"
      style={{ borderColor: "color-mix(in oklab, var(--color-primary) 18%, transparent)", background: "color-mix(in oklab, var(--color-primary) 8%, var(--color-card))" }}
    >
      <div className="flex items-baseline justify-between gap-2.5">
        <p className="text-[13px] font-semibold text-ink">Your hours</p>
        <p className="flex items-baseline gap-1">
          <span className="font-serif text-[21px] font-semibold" style={{ color: "var(--color-ink-warm)" }}>
            {hoursCredited.toFixed(1)}
          </span>
          <span className="text-[11px] text-muted">hrs</span>
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">
        {hoursRemaining > 0 ? `You are ${hoursRemaining.toFixed(1)} hours from your certificate.` : "You've reached the certificate threshold."} Every class
        adds {perClassHours.toFixed(2).replace(/\.?0+$/, "")} hours.
      </p>
      <div className="mt-2.5 h-[5px] overflow-hidden rounded-full" style={{ background: "oklch(93.5% 0.012 85)" }}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="mt-2.5 flex gap-[7px]">
        {milestones.map((m, i) => (
          <MilestoneTile key={m} hours={m} hoursCredited={hoursCredited} isLast={i === milestones.length - 1} isNext={i === nextMilestoneIndex} />
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-muted">Every class counts, whichever level you are in. Stay for at least two of the three lessons and the class is yours.</p>
    </div>
  );
}

function ThisCourseCard({
  thisCourseAttended,
  thisCourseHeldSoFar,
  thisCourseClasses,
}: {
  thisCourseAttended: number;
  thisCourseHeldSoFar: number;
  thisCourseClasses: { eventId: string; eventDate: string; attended: boolean | null }[];
}) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3.5">
      <p className="text-xs font-semibold text-ink">This course</p>
      <p className="mt-1 text-xs text-muted">
        You&apos;ve come to {thisCourseAttended} of {thisCourseHeldSoFar} classes held so far. {thisCourseClasses.length} in total.
      </p>
      <div className="mt-2 flex gap-1">
        {thisCourseClasses
          .slice()
          .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1))
          .map((c) => (
            <span
              key={c.eventId}
              className="h-[5px] flex-1 rounded-[3px]"
              style={{ background: c.attended === true ? "var(--color-ink-warm)" : c.attended === false ? "var(--color-border)" : "oklch(93.5% 0.012 85)" }}
              title={c.eventDate}
            />
          ))}
      </div>
    </div>
  );
}

function Footer({ endDateLabel, materials, token }: { endDateLabel: string | null; materials: unknown[]; token: string }) {
  return (
    <div className="mt-2 flex flex-col items-center gap-2 border-t border-border-faint pt-4 text-center">
      <p className="text-[11px] leading-[1.55] text-muted">
        This link is yours alone. It stops working when the course ends{endDateLabel ? ` on ${endDateLabel}` : ""} — download anything you want to keep
        before then.
      </p>
      {materials.length > 0 ? (
        <a href="#classes" className="text-xs font-semibold text-primary hover:underline">
          Download all my materials
        </a>
      ) : null}
      <PushSubscribeButton subscribe={subscribeVolunteerPush.bind(null, token)} unsubscribe={unsubscribeVolunteerPush.bind(null, token)} />
    </div>
  );
}

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { VolunteerSignupForm } from "@/app/student/[token]/signup-form";
import { DeclineButton } from "@/app/student/[token]/decline-button";
import { ClassMaterialsLink } from "@/app/student/[token]/class-materials-link";
import { LessonMaterialsCard } from "@/app/student/[token]/lesson-materials-card";
import { JoinOnlineButton } from "@/app/student/[token]/join-online-button";
import { SIGNUP_QUESTIONS } from "@/lib/fol/volunteer-signup-questions";
import { Wordmark } from "@/components/wordmark";
import { DesignerCredit } from "@/components/designer-credit";
import { Greeting } from "@/app/student/[token]/greeting";
import type { Metadata } from "next";
import { InstallPrompt } from "@/components/install-prompt";
import { getVolunteerIdentityData, CERTIFICATE_HOURS_THRESHOLD } from "@/lib/volunteer-cross-course";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { resolveTimeBands, toLocalIso, zonedTimeToUtc } from "@/lib/timetable-grid";
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

// Ramy, 25 Aug 2026: "let's go for a red sort of garnet for missed and the
// green teal for attended" -- reverses the spec's original neutral-ink
// treatment for this page specifically. Reuses the app's own existing
// on-track (teal)/at-risk (garnet) status tokens rather than inventing new
// literals, same pair used for status pills elsewhere in the app.
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
        background: attended ? "var(--color-status-on-track-bg)" : "var(--color-status-at-risk-bg)",
        color: attended ? "var(--color-status-on-track-text)" : "var(--color-status-at-risk-text)",
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
  // Ramy, 25 Aug 2026: "give them a little bit of color... so they can see
  // when they're moving" -- earned milestones now use the same teal the
  // rest of the app already uses for "good news" (the Attended pill,
  // "Coming next class"), instead of the same muted ink-warm every other
  // state used, so passing one actually reads as a small win.
  const style = earned
    ? { background: "var(--color-status-on-track-bg)", borderColor: "color-mix(in oklab, var(--color-status-on-track-text) 35%, transparent)", color: "var(--color-status-on-track-text)" }
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

interface RowMaterial {
  id: string;
  name: string;
  url: string;
}

interface RichMaterial {
  id: string;
  name: string;
  url: string;
  fileType: string | null;
  sizeBytes: number | null;
}

interface LessonGroup {
  tpNumber: number;
  traineeId: string;
  earliestSharedAt: string;
  materials: RichMaterial[];
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Volunteer View.dc.html, written 14 Aug 2026, rebuilt to
// volunteer-view-full-spec.md 25 Aug 2026 -- two structurally different
// layouts (phone card-in-frame, desktop table + banner), not one reflowed
// tree, per the spec's own "1a/1b" framing. No login, no password --
// resolved entirely from a tokenized, course-scoped, auto-expiring link
// (migration 0030), every read going through the admin client with
// explicit scoping (there is no auth.uid() session on this path at all).
// Overrides the app-wide manifest link for this page only, so a volunteer
// who installs Connect gets an app that opens on their own page rather than
// on a login screen they have no account for.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/student/${token}/manifest.webmanifest`,
    robots: { index: false, follow: false },
  };
}

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
          <Link href="/" className="inline-block hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
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
    admin.from("courses").select("name, start_date, end_date, center_id, time_bands").eq("id", accessToken.course_id).maybeSingle(),
    admin
      .from("volunteer_shared_materials")
      .select("id, created_at, tp_materials(id, file_name, file_type, slides_url, storage_path, trainee_id, tp_plans(tp_number))")
      .eq("course_id", accessToken.course_id)
      .order("created_at", { ascending: false }),
  ]);

  if (!volunteer) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-accent p-8 text-center">
          <Link href="/" className="inline-block hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
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
          <Link href="/" className="hover:opacity-80">
            <Wordmark size="header" />
          </Link>
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
  // Ramy, 30 Aug 2026: "is it gonna change when the next class arrives,
  // like ten, ten forty-five, etcetera, with a chain, after the break?"
  //
  // It was not. This filtered on `eventDate >= today` and sorted on the
  // DATE alone, so on a day holding several TP rounds every one of them
  // compared equal: the panel showed whichever row the query returned
  // first and sat on it until midnight. A volunteer who finished the 10:00
  // and had another at 10:45 was still being told about the 10:00 -- with
  // a Join button pointing at a room that had already emptied.
  //
  // Two things were wrong at once. `today` was the UTC date rather than
  // the centre's, and nothing compared the time of day at all.
  //
  // Now a class stops being "next" once it has actually finished, so the
  // panel walks the day forward: 10:00 through to 10:45, then the 10:45
  // one, then tomorrow's first. Classes with no time set stay current for
  // the whole of their date -- an untimed row is a day's commitment, and
  // guessing an hour for it would be worse than showing it all day.
  //
  // Ramy, 30 Aug 2026: "how would it know the break? The break is not
  // something in the timetable."
  //
  // It doesn't need to, and it does not assume a length either. The
  // course's own time bands (courses.time_bands, edited in the timetable
  // settings) carry the END of each band, and the breaks ARE the gaps
  // between them -- this course runs 10:00-10:45, 10:45-11:30, then
  // 11:45-12:30, so the quarter hour after 11:30 is a break precisely
  // because no band covers it. A class is over when its band ends, and
  // during the gap the panel is already showing the one you are heading
  // to, which is the thing worth knowing while standing in the corridor.
  //
  // The 45-minute constant is only the fallback for an event whose time
  // matches no band at all -- an off-grid session someone typed by hand.
  const timeBands = resolveTimeBands(course?.time_bands ?? null);
  const endOfBandFor = (eventTime: string): number | null => {
    const band = timeBands.find((b) => b.start === eventTime.slice(0, 5));
    if (!band) return null;
    const [h, m] = band.end.split(":").map(Number);
    return h * 60 + m;
  };
  const nowMs = Date.now();
  const upcoming = classes
    .filter((c) => c.courseId === accessToken.course_id)
    .filter((c) => {
      if (!c.eventTime) return c.eventDate >= toLocalIso(new Date(nowMs), c.timeZone);
      const startsAt = zonedTimeToUtc(c.eventDate, c.eventTime, c.timeZone);
      const bandEnd = endOfBandFor(c.eventTime);
      const [sh, sm] = c.eventTime.slice(0, 5).split(":").map(Number);
      const runsForMinutes = bandEnd != null ? bandEnd - (sh * 60 + sm) : TP_LESSON_LENGTH_MINUTES;
      return startsAt.getTime() + runsForMinutes * 60_000 > nowMs;
    })
    .sort((a, b) => {
      if (a.eventDate !== b.eventDate) return a.eventDate < b.eventDate ? -1 : 1;
      return (a.eventTime ?? "").localeCompare(b.eventTime ?? "");
    });
  const nextClass = upcoming[0] ?? null;

  // Ramy, 25 Aug 2026: the Join-online link only activates 10 minutes
  // before start, but ONLY for the first TP of the day -- "between
  // lessons... it should always be active" for anyone stepping out and
  // back in on a later same-day round. Detected by checking for any
  // earlier-that-day TP event on this course, not by tp_number (a single
  // calendar TP round can host several trainees' back-to-back segments
  // under one event_time, same premise nextClassTeachers works from).
  const [{ data: earlierSameDay }, { data: nextClassDecline }] = await Promise.all([
    nextClass?.zoomUrl && nextClass.eventTime
      ? admin
          .from("course_timetable_events")
          .select("id")
          .eq("course_id", nextClass.courseId)
          .eq("type", "tp")
          .eq("event_date", nextClass.eventDate)
          .lt("event_time", nextClass.eventTime)
          .limit(1)
      : Promise.resolve({ data: null }),
    nextClass
      ? admin
          .from("volunteer_declines")
          .select("id")
          .eq("volunteer_student_id", accessToken.volunteer_student_id)
          .eq("timetable_event_id", nextClass.eventId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let joinActivationIso: string | null = null;
  if (nextClass?.zoomUrl && nextClass.eventTime) {
    const isFirstTpOfDay = !earlierSameDay || earlierSameDay.length === 0;
    if (isFirstTpOfDay) {
      // Was `new Date(`${date}T${time}`)`, which parses that string in the
      // SERVER's zone (UTC on Vercel), not the centre's -- so the Join
      // button unlocked three hours early for an Istanbul course.
      const startMs = zonedTimeToUtc(nextClass.eventDate, nextClass.eventTime, nextClass.timeZone).getTime();
      joinActivationIso = new Date(startMs - 10 * 60_000).toISOString();
    }
  }

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
        file_type: string | null;
        slides_url: string | null;
        storage_path: string | null;
        trainee_id: string;
        tp_plans: { tp_number: number } | null;
      } | null;
      if (!material) return null;

      let url = material.slides_url;
      if (!url && material.storage_path) {
        const { data: signed } = await admin.storage.from("tp-materials").createSignedUrl(material.storage_path, 3600);
        url = signed?.signedUrl ?? null;
      }
      if (!url) return null;

      return {
        id: material.id,
        name: material.file_name ?? "Material",
        url,
        fileType: material.file_type,
        storagePath: material.storage_path,
        traineeId: material.trainee_id,
        tpNumber: material.tp_plans?.tp_number ?? null,
        sharedAt: row.created_at,
      };
    })
  );
  const materials = resolvedMaterials.filter((m): m is NonNullable<typeof m> => m !== null);

  // File size isn't a column on tp_materials -- real byte size comes
  // straight from Storage's own listing, same source
  // course-close-out/verify.ts already trusts for this bucket, rather than
  // inventing a number nowhere else in the app tracks.
  const storageFolders = [...new Set(materials.filter((m) => m.storagePath).map((m) => m.storagePath!.split("/").slice(0, -1).join("/")))];
  const sizeByPath = new Map<string, number>();
  await Promise.all(
    storageFolders.map(async (folder) => {
      const { data: listing } = await admin.storage.from("tp-materials").list(folder);
      for (const entry of listing ?? []) {
        if (entry.metadata?.size != null) sizeByPath.set(`${folder}/${entry.name}`, entry.metadata.size);
      }
    })
  );

  // Table's own per-row indicator stays aggregate (everyone who shared for
  // that calendar day, merged) -- attendance is about the day, not who
  // taught it.
  const materialsByTpNumber = new Map<number, RowMaterial[]>();
  for (const m of materials) {
    if (m.tpNumber == null) continue;
    const list = materialsByTpNumber.get(m.tpNumber) ?? [];
    list.push({ id: m.id, name: m.name, url: m.url });
    materialsByTpNumber.set(m.tpNumber, list);
  }

  // Materials panel below is scoped per TEACHER, not per calendar day --
  // Ramy, 25 Aug 2026: "TP one a, and then TP one b, and then TP one c" --
  // one calendar TP round can host several trainees rotating through it
  // (same as nextClassTeachers above), and each trainee's own shared files
  // get their own card/letter as they come in, rather than merging
  // everyone's TP1 material into a single card. Keyed tpNumber:traineeId,
  // letter assigned by the order each trainee FIRST shared something for
  // that round.
  const lessonGroupsByKey = new Map<string, LessonGroup>();
  for (const m of materials) {
    if (m.tpNumber == null) continue;
    const key = `${m.tpNumber}:${m.traineeId}`;
    const group = lessonGroupsByKey.get(key);
    const richMaterial: RichMaterial = {
      id: m.id,
      name: m.name,
      url: m.url,
      fileType: m.fileType,
      sizeBytes: m.storagePath ? (sizeByPath.get(m.storagePath) ?? null) : null,
    };
    if (group) {
      group.materials.push(richMaterial);
      if (m.sharedAt < group.earliestSharedAt) group.earliestSharedAt = m.sharedAt;
    } else {
      lessonGroupsByKey.set(key, { tpNumber: m.tpNumber, traineeId: m.traineeId, earliestSharedAt: m.sharedAt, materials: [richMaterial] });
    }
  }

  // "Your classes" list/table -- volunteer-view-full-spec.md shows a Topic
  // column per row, not just a date, so this needs the same
  // linked_tp_number -> plan_assignments lookup nextClass gets above, just
  // batched across every class in the list (which can span more than one
  // course -- "hours are the unit, never levels or courses").
  // Three classes: the next one, then the two most recent.
  //
  // Volunteer View.dc.html's own fixture is four rows -- one upcoming, two
  // attended, one missed -- and Ramy trimmed it further once he saw real
  // data in it: "maybe maximum three, and then the rest will just be on the
  // card." With a volunteer who has missed a run of classes, four rows of
  // red is three too many. Not a log.
  //
  // It was classes.slice(0, 12), which on a 48-session course meant twelve
  // rows all reading "Upcoming", directly above a card saying "you've come
  // to 18 of 36 classes held so far" -- the page contradicting itself. I
  // then made it twelve MIXED rows, which fixed the contradiction and kept
  // the real problem. Ramy: "a long line of sessions that you attended or
  // missed -- that shouldn't be there. It should be the cards."
  //
  // He is right, and the design says so. A volunteer wants to know when
  // they are next in, that their recent attendance registered, and where
  // the handouts are. The cards below carry the totals; this is a glance,
  // not a record.
  // Cross-course, so each class is asked about its own centre's date --
  // this list can hold a New York class and a Los Angeles one, and on the
  // three hours between their midnights the same UTC date is "today" in
  // one and already "tomorrow" in the other.
  const isPast = (c: (typeof classes)[number]) => c.eventDate < toLocalIso(new Date(nowMs), c.timeZone);
  const upcomingForList = classes.filter((c) => !isPast(c));
  const pastForList = classes.filter(isPast);
  const listClasses = [...upcomingForList.slice(-1), ...pastForList.slice(0, 2)];
  const tpKeysNeeded = listClasses.filter((c) => c.linkedTpNumber != null).map((c) => ({ courseId: c.courseId, tpNumber: c.linkedTpNumber as number }));
  const listCourseIds = [...new Set(tpKeysNeeded.map((k) => k.courseId))];
  const { data: listAssignments } = listCourseIds.length
    ? await admin.from("plan_assignments").select("course_id, tp_number, trainee_id, short_title, main_lesson_aim").in("course_id", listCourseIds)
    : { data: [] };
  const topicByKey = new Map<string, string>();
  const topicByTpTrainee = new Map<string, string>();
  for (const a of listAssignments ?? []) {
    const key = `${a.course_id}:${a.tp_number}`;
    if (!topicByKey.has(key) && (a.short_title || a.main_lesson_aim)) {
      topicByKey.set(key, (a.short_title || a.main_lesson_aim) as string);
    }
    if (a.short_title || a.main_lesson_aim) {
      topicByTpTrainee.set(`${a.tp_number}:${a.trainee_id}`, (a.short_title || a.main_lesson_aim) as string);
    }
  }
  const rows = listClasses.map((c) => ({
    ...c,
    topic: c.linkedTpNumber != null ? (topicByKey.get(`${c.courseId}:${c.linkedTpNumber}`) ?? null) : null,
    rowMaterials: c.courseId === accessToken.course_id && c.linkedTpNumber != null ? (materialsByTpNumber.get(c.linkedTpNumber) ?? []) : [],
  }));

  // Ramy, 25 Aug 2026, after seeing "TP4a": "why don't we just write down
  // the name of the teacher?... teacher name, TP number, and the topic."
  // The letter never meant anything to a volunteer reading it -- the real
  // teacher's name does.
  const lessonTraineeIds = [...new Set([...lessonGroupsByKey.values()].map((g) => g.traineeId))];
  const { data: lessonTeacherProfiles } = lessonTraineeIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", lessonTraineeIds)
    : { data: [] };
  const teacherNameById = new Map((lessonTeacherProfiles ?? []).map((p) => [p.id, p.full_name]));

  const dateByTpNumber = new Map<number, string>();
  for (const c of listClasses) {
    if (c.courseId === accessToken.course_id && c.linkedTpNumber != null) dateByTpNumber.set(c.linkedTpNumber, c.eventDate);
  }
  const lessonCards: { key: string; teacherName: string; label: string; topic: string | null; eventDate: string; materials: RichMaterial[] }[] = [];
  for (const group of lessonGroupsByKey.values()) {
    lessonCards.push({
      key: `${group.tpNumber}:${group.traineeId}`,
      teacherName: teacherNameById.get(group.traineeId) ?? "Your teacher",
      label: `TP${group.tpNumber}`,
      topic: topicByTpTrainee.get(`${group.tpNumber}:${group.traineeId}`) ?? null,
      eventDate: dateByTpNumber.get(group.tpNumber) ?? "",
      materials: group.materials,
    });
  }

  // Ramy, 25 Aug 2026: "unassessed is the same thing as getting to know
  // you... it's gonna read whatever is on the timetable" -- and, pushing
  // on the trainer side too: "it would read demo lesson." Anything a
  // trainee or trainer shared via session_materials against a non-TP
  // event on this course, grouped the same way (one card per person per
  // session), labelled with the event's own title rather than "TP{n}".
  const { data: otherEvents } = await admin
    .from("course_timetable_events")
    .select("id, title, event_date")
    .eq("course_id", accessToken.course_id)
    .neq("type", "tp");
  const otherEventIds = (otherEvents ?? []).map((e) => e.id);
  const { data: sessionMaterialRows } =
    otherEventIds.length > 0
      ? await admin
          .from("session_materials")
          .select("id, timetable_event_id, uploaded_by, storage_path, file_name, file_type, slides_url, created_at")
          .in("timetable_event_id", otherEventIds)
      : { data: [] };

  if (sessionMaterialRows && sessionMaterialRows.length > 0) {
    const eventById = new Map((otherEvents ?? []).map((e) => [e.id, e]));
    const uploaderIds = [...new Set(sessionMaterialRows.map((m) => m.uploaded_by))];
    const { data: uploaderProfiles } = await admin.from("profiles").select("id, full_name").in("id", uploaderIds);
    const uploaderNameById = new Map((uploaderProfiles ?? []).map((p) => [p.id, p.full_name]));

    const resolvedSessionMaterials = await Promise.all(
      sessionMaterialRows.map(async (m) => {
        let url = m.slides_url;
        if (!url && m.storage_path) {
          const { data: signed } = await admin.storage.from("tp-materials").createSignedUrl(m.storage_path, 3600);
          url = signed?.signedUrl ?? null;
        }
        if (!url) return null;
        const { data: listing } = m.storage_path
          ? await admin.storage.from("tp-materials").list(m.storage_path.split("/").slice(0, -1).join("/"))
          : { data: [] };
        const sizeBytes = m.storage_path ? (listing ?? []).find((e) => `${m.storage_path!.split("/").slice(0, -1).join("/")}/${e.name}` === m.storage_path)?.metadata?.size ?? null : null;
        return { ...m, url, sizeBytes };
      })
    );

    const sessionGroupsByKey = new Map<string, { eventId: string; uploaderId: string; materials: RichMaterial[] }>();
    for (const m of resolvedSessionMaterials) {
      if (!m) continue;
      const key = `${m.timetable_event_id}:${m.uploaded_by}`;
      const group = sessionGroupsByKey.get(key);
      const richMaterial: RichMaterial = { id: m.id, name: m.file_name ?? "Material", url: m.url, fileType: m.file_type, sizeBytes: m.sizeBytes };
      if (group) group.materials.push(richMaterial);
      else sessionGroupsByKey.set(key, { eventId: m.timetable_event_id, uploaderId: m.uploaded_by, materials: [richMaterial] });
    }

    for (const group of sessionGroupsByKey.values()) {
      const event = eventById.get(group.eventId);
      if (!event) continue;
      lessonCards.push({
        key: `session:${group.eventId}:${group.uploaderId}`,
        teacherName: uploaderNameById.get(group.uploaderId) ?? "Your tutor",
        label: event.title,
        topic: null,
        eventDate: event.event_date,
        materials: group.materials,
      });
    }
  }

  lessonCards.sort((a, b) => (a.key < b.key ? 1 : -1));

  const hoursRemaining = Math.max(certificateHoursThreshold - hoursCredited, 0);
  const progressPct = Math.min((hoursCredited / certificateHoursThreshold) * 100, 100);
  const milestones = milestonesFor(certificateHoursThreshold);
  const nextMilestoneIndex = milestones.findIndex((m) => hoursCredited < m);

  const firstName = volunteer.name.split(" ")[0];
  const endDateLabel = course?.end_date ? new Date(`${course.end_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
  // Ramy, 30 Aug 2026: "maybe you can have the dates instead" -- a run of
  // dates tells a volunteer how much of the course is left in a way that
  // "until 4 Sept" alone does not.
  const startDateLabel = course?.start_date
    ? new Date(`${course.start_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  const courseDatesLabel = startDateLabel && endDateLabel ? `${startDateLabel} – ${endDateLabel}` : endDateLabel;
  const headline = nextClass ? `Your next class is ${formatEventDate(nextClass.eventDate).split(",")[0].toLowerCase()}` : "No classes scheduled yet";
  // The room belongs on the card. Ramy: "there's no room number on the hero
  // card." course_timetable_events.detail is the centre's own free text for
  // an event (migration 0229) and is where a room number lives, so it rides
  // on the Where line rather than inventing a second location row that is
  // empty for every online class.
  const whereLabel = [
    nextClass?.zoomUrl ? "Online" : "In person at the centre",
    nextClass?.detail || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const topicLabel = nextClassTeachers.find((t) => t.topic)?.topic ?? null;
  const teachersLabel = nextClassTeachers.length > 0 ? nextClassTeachers.map((t) => t.name).join(" and ") : null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8 md:py-12">
      {/* Ramy, 30 Aug 2026: "how do they keep this on their phones and
          desktop? Just create a shortcut?"
          
          Better than a shortcut -- Connect is already a real installable
          app (manifest + icons + service worker), the offer was just never
          made to volunteers. It was rendered for trainees only, from
          build-spec §7's "trainees only (daily use for five weeks)".
          
          A volunteer needs it more, not less. A trainee who loses their way
          back can log in; a volunteer has no account at all and their only
          route in is a link in an email from weeks ago. An icon on the home
          screen IS their copy of that link. */}
      <div className="w-full max-w-[860px]">
        <InstallPrompt />
      </div>
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
            {/* Two rows, each a pair facing across the page. Ramy, 30 Aug
                2026: "my credit will be across from Connect, and then the
                student name with the greeting will be down and bigger, and
                you have the centre on the other side."
                
                So the top row is chrome -- the wordmark and who built it --
                and the row beneath it is the two things that are actually
                about this volunteer: which course, and who they are. The
                greeting drops out of the 12px chrome line it was crammed
                into and gets to be the size it deserves. */}
            <header className="flex h-[52px] items-center justify-between border-b border-border px-5">
              <Link href="/" className="hover:opacity-80">
                <Wordmark size="header-compact" />
              </Link>
              <DesignerCredit pinned={false} className="text-[11px] text-muted" />
            </header>

            <div className="flex flex-col gap-5 p-[22px_20px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                  {course?.name ?? "Your course"}
                  {courseDatesLabel ? ` · ${courseDatesLabel}` : ""}
                </p>
                <Greeting name={volunteer.name} suffix="volunteer student" className="font-serif text-[19px] text-ink" />
              </div>
              {nextClass ? (
                <NextClassBanner
                  nextClass={nextClass}
                  whereLabel={whereLabel}
                  topicLabel={topicLabel}
                  teachersLabel={teachersLabel}
                  token={token}
                  nextClassDecline={nextClassDecline}
                  joinActivationIso={joinActivationIso}
                  attended={thisCourseAttended}
                  missed={Math.max(thisCourseHeldSoFar - thisCourseAttended, 0)}
                  toCome={Math.max(thisCourseClasses.length - thisCourseHeldSoFar, 0)}
                />
              ) : null}
              <ClassesTable rows={rows} />
              {/* Ramy: the hours card is "almost half the page... make it a bit
                  smaller, and then this course make it a little bigger."
                  Closer to even, so the two read as a pair rather than one
                  card with a footnote beside it. */}
              <div className="grid grid-cols-[1.35fr_1fr] items-start gap-5">
                <HoursCard
                  hoursCredited={hoursCredited}
                  hoursRemaining={hoursRemaining}
                  progressPct={progressPct}
                  milestones={milestones}
                  nextMilestoneIndex={nextMilestoneIndex}
                />
                <ThisCourseCard thisCourseAttended={thisCourseAttended} thisCourseHeldSoFar={thisCourseHeldSoFar} thisCourseClasses={thisCourseClasses} />
              </div>
              <MaterialsPanel lessonCards={lessonCards} />
            </div>
            <Footer endDateLabel={endDateLabel} materials={materials} token={token} />
          </div>

          {/* Phone -- header flush at the very top of the shell, body
              padded 18px 16px 26px, one column. */}
          <div className="md:hidden">
            <header className="flex h-[54px] items-center justify-between border-b border-border px-4" style={{ background: "oklch(99.2% 0.005 90)" }}>
              <Link href="/" className="hover:opacity-80">
                <Wordmark size="header-compact" />
              </Link>
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
                  joinActivationIso={joinActivationIso}
                />
              ) : null}
              <ClassesList rows={rows} attendedCount={thisCourseAttended} />
              <HoursCard
                hoursCredited={hoursCredited}
                hoursRemaining={hoursRemaining}
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

      <DesignerCredit pinned={false} className="flex justify-center py-4 md:hidden" />
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
  // Desktop no longer uses this -- its header is two facing rows now, and
  // the "your next class is tomorrow" headline was saying what the panel
  // directly beneath it already says. Ramy: "remove your next classes
  // tomorrow because we already have it inside the panel." Phone keeps the
  // headline, where the panel is further down the scroll and the repetition
  // does not land as repetition.
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
  detail: string | null;
}

function NextClassCard({
  nextClass,
  whereLabel,
  topicLabel,
  teachersLabel,
  course,
  token,
  nextClassDecline,
  joinActivationIso,
}: {
  nextClass: NextClassLike;
  whereLabel: string;
  topicLabel: string | null;
  teachersLabel: string | null;
  course: { name: string } | null;
  token: string;
  nextClassDecline: { id: string } | null;
  joinActivationIso: string | null;
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
      {/* Ramy: "you're making the Zoom pill thicker. It needs to be
          longer. The width was fine." Making it "bigger" earlier had grown
          it in the wrong axis -- a 52px slab. Back to a normal pill height,
          with a floor on its width so it stays the long, obvious thing in
          the row however short the countdown text gets. */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {nextClass.zoomUrl ? (
          <JoinOnlineButton
            zoomUrl={nextClass.zoomUrl}
            activationIso={joinActivationIso}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-primary text-sm font-semibold text-primary-foreground"
          />
        ) : null}
        <a
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(
            `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${course?.name ?? "Class"}\nDTSTART:${nextClass.eventDate.replace(/-/g, "")}\nEND:VEVENT\nEND:VCALENDAR`
          )}`}
          download="class.ics"
          title="Add to calendar"
          className="volunteer-hover-fill flex size-11 shrink-0 items-center justify-center rounded-[8px] border border-border text-muted"
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

// The next-class card, rebuilt to Volunteer View.dc.html rather than the
// full-width strip it had become.
//
// The design is a bordered card: date and time on one baseline, then
// label/value fact rows (62px label column), then a full-width teal "Join
// online" with a square secondary beside it. What was live instead was a
// banner spanning the whole page with the facts crushed into one grey
// sentence -- Ramy: "that top part... it wasn't meant to be, like, the
// entire page. It was a card. And I think there was something next to it.
// Where is the part where you click to join Zoom?"
//
// The Join button was never missing, only conditional on the class having a
// zoom_url, and the demo course meets in person. It now says so in a fact
// row instead of silently rendering nothing, so a volunteer can tell the
// difference between "no link yet" and "there is no link, come to the
// building".
//
// The attendance counts live here too, per Ramy again: "maybe something on
// the card, you have missed how many lessons or you have so and so coming.
// Just put the information there instead of the long line."
function NextClassBanner({
  nextClass,
  whereLabel,
  topicLabel,
  teachersLabel,
  token,
  nextClassDecline,
  joinActivationIso,
  attended,
  missed,
  toCome,
}: {
  nextClass: NextClassLike;
  whereLabel: string;
  topicLabel: string | null;
  teachersLabel: string | null;
  token: string;
  nextClassDecline: { id: string } | null;
  joinActivationIso: string | null;
  attended: number;
  missed: number;
  toCome: number;
}) {
  const facts: { label: string; value: string }[] = [
    { label: "Where", value: whereLabel },
    ...(topicLabel ? [{ label: "Topic", value: topicLabel }] : []),
    ...(teachersLabel ? [{ label: "Teacher", value: teachersLabel }] : []),
    {
      label: "So far",
      value: [
        `${attended} attended`,
        missed > 0 ? `${missed} missed` : null,
        toCome > 0 ? `${toCome} still to come` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];

  return (
    <div
      className="flex flex-col gap-[13px] rounded-[10px] border border-t-[3px] p-4"
      style={{
        borderColor: "color-mix(in oklab, var(--color-primary) 34%, transparent)",
        borderTopColor: "var(--color-primary)",
        // Ramy: "play with the panel colour." Deeper at the top where the
        // date and time sit, fading out before the facts -- so the colour
        // belongs to the thing you look at first rather than washing the
        // whole card evenly.
        background: "linear-gradient(170deg, color-mix(in oklab, var(--color-primary) 13%, var(--color-card)) 0%, var(--color-card) 55%)",
      }}
    >
      {/* No eyebrow. The page heading immediately above this card already
          reads "Your next class is tomorrow", so labelling the card the same
          thing said it twice in two type sizes. Ramy: "we understand this.
          The next class is enough." */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-[21px] font-semibold text-ink">{formatEventDate(nextClass.eventDate)}</p>
        {/* "Starts", not a bare number. Ramy read the unlabelled pill as a
            clock and asked why it wasn't moving -- fair, since a lone 10:00
            in a dark pill at a card corner looks like a widget rather than a
            fact about the class. Every other fact in this panel is named by
            the label column; this one sits outside it, so it has to carry
            its own word. */}
        {nextClass.eventTime ? (
          <span className="inline-flex items-baseline gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground">
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase opacity-80">Starts</span>
            <span className="text-[15px] font-bold tabular-nums">{nextClass.eventTime.slice(0, 5)}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-[7px]">
        {facts.map((f) => (
          <div key={f.label} className="flex items-baseline gap-2.5">
            <span className="w-[62px] flex-none text-[10px] font-bold tracking-[0.1em] text-muted uppercase">{f.label}</span>
            <span className="text-[13px] text-ink">{f.value}</span>
          </div>
        ))}
      </div>

      {/* The action row always carries weight. It used to render nothing at
          all for an in-person class, because Join online is conditional on a
          zoom_url -- so a volunteer at a face-to-face centre saw a card that
          trailed off into "Can't make it?" and nothing else. An in-person
          class now says so in the same slot, with the same size, so the row
          reads as an answer rather than an absence. */}
      {/* Ramy: "you're making the Zoom pill thicker. It needs to be
          longer. The width was fine." Making it "bigger" earlier had grown
          it in the wrong axis -- a 52px slab. Back to a normal pill height,
          with a floor on its width so it stays the long, obvious thing in
          the row however short the countdown text gets. */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {nextClass.zoomUrl ? (
          <JoinOnlineButton
            zoomUrl={nextClass.zoomUrl}
            activationIso={joinActivationIso}
            className="trainee-hover-fill flex h-[42px] min-w-[260px] flex-1 items-center justify-center gap-2.5 rounded-[10px] bg-primary px-6 text-[14.5px] font-semibold text-primary-foreground shadow-[0_2px_10px_-4px_color-mix(in_oklab,var(--color-primary)_70%,transparent)]"
          />
        ) : (
          <span
            className="flex h-[42px] min-w-[260px] flex-1 items-center justify-center gap-2.5 rounded-[10px] px-6 text-[14.5px] font-semibold"
            style={{
              background: "color-mix(in oklab, var(--color-primary) 14%, transparent)",
              color: "var(--color-primary)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            In person at the centre
          </span>
        )}
        <DeclineButton token={token} eventId={nextClass.eventId} alreadyDeclined={Boolean(nextClassDecline)} />
      </div>
    </div>
  );
}

interface ClassRow {
  eventId: string;
  eventDate: string;
  eventTime: string | null;
  zoomUrl: string | null;
  linkedTpNumber: number | null;
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
              <p className="shrink-0 text-[11px] text-muted">
                {formatShortDate(c.eventDate)}
                {c.eventTime ? <span className="tabular-nums"> · {c.eventTime.slice(0, 5)}</span> : null}
              </p>
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
    // No overflow-hidden on this wrapper -- ClassMaterialsLink's multi-file
    // dropdown is an absolutely-positioned popup that needs to escape the
    // table, not just the rounded corners. Rounding applied directly to the
    // header and the last row instead.
    <div id="classes" className="rounded-[6px] border border-border">
      <div
        className="grid grid-cols-[96px_1fr_128px_150px] rounded-t-[6px] border-b border-border px-4 py-2 text-[9px] font-bold tracking-[0.06em] text-muted uppercase"
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
            className={`grid grid-cols-[96px_1fr_128px_150px] items-center px-4 py-2.5 text-xs text-ink ${i > 0 ? "border-t border-border-faint" : ""} ${i === rows.length - 1 ? "rounded-b-[6px]" : ""}`}
          >
            {/* Date alone could not tell one lesson from another: a single
                day runs several TP rounds -- the demo course teaches TP6 at
                10:00, 10:45 and 11:45 -- and they share a topic, so two
                rows rendered as the same class listed twice. */}
            <div className="text-muted">
              {formatShortDate(c.eventDate)}
              {c.eventTime ? <span className="tabular-nums"> · {c.eventTime.slice(0, 5)}</span> : null}
            </div>
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

// volunteer-view-full-spec.md 1b: a dedicated materials panel under the
// table, scoped to one class session ("Materials -- <topic> · <date>"), not
// just a per-row count -- Ramy, 25 Aug 2026, after the pills/counts were
// already right: "the actual material that they received, the handouts.
// Where are they?" 3-column grid of compact file cards (icon tile + name +
// size + a real "Get" download), not another dropdown.
// Ramy, 25 Aug 2026, after seeing one card per FILE: "every card should...
// contain all the material for one TP. That's how I want it. So one TP, one
// lesson... TP one lesson one, TP one lesson two, TP one lesson three."
// One card per class that's actually happened and has something shared,
// not just the most recent -- a volunteer should be able to get materials
// from any past class, not only the last one. Files for that lesson stack
// inside its own card rather than each getting its own top-level card.
function MaterialsPanel({
  lessonCards,
}: {
  lessonCards: { key: string; teacherName: string; label: string; topic: string | null; eventDate: string; materials: RichMaterial[] }[];
}) {
  if (lessonCards.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10px] font-bold tracking-[0.12em] text-muted uppercase">Materials</p>
      <div className="grid grid-cols-3 gap-2.5">
        {lessonCards.map((c) => (
          <LessonMaterialsCard
            key={c.key}
            teacherName={c.teacherName}
            label={c.label}
            topic={c.topic}
            materials={c.materials.map((m) => ({ id: m.id, name: m.name, url: m.url, sizeLabel: formatFileSize(m.sizeBytes) }))}
          />
        ))}
      </div>
    </div>
  );
}

function HoursCard({
  hoursCredited,
  hoursRemaining,
  progressPct,
  milestones,
  nextMilestoneIndex,
}: {
  hoursCredited: number;
  hoursRemaining: number;
  progressPct: number;
  milestones: number[];
  nextMilestoneIndex: number;
}) {
  return (
    <div
      className="rounded-[10px] border border-t-[3px] p-3.5"
      style={{
        borderColor: "color-mix(in oklab, var(--color-primary) 22%, transparent)",
        borderTopColor: "var(--color-primary)",
        background: "linear-gradient(160deg, color-mix(in oklab, var(--color-primary) 10%, var(--color-card)), var(--color-card) 70%)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          Your hours
        </p>
        <p className="flex items-baseline gap-1">
          <span className="font-serif text-[26px] leading-none font-semibold text-primary">
            {hoursCredited.toFixed(1)}
          </span>
          <span className="text-[11px] font-semibold text-primary/70">hrs</span>
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">
        {hoursRemaining > 0 ? `You are ${hoursRemaining.toFixed(1)} hours from your certificate.` : "You've reached the certificate threshold."}
      </p>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in oklab, var(--color-primary) 14%, transparent)" }}>
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
  // A stat, not a sentence. Ramy: "the scores you've come to blah blah blah
  // -- make it a stat instead." The number is the thing a volunteer is
  // looking for; it was buried mid-sentence in muted 12px text while the
  // sentence around it carried no information they needed.
  const pct = thisCourseHeldSoFar > 0 ? Math.round((thisCourseAttended / thisCourseHeldSoFar) * 100) : null;
  return (
    <div className="rounded-[10px] border border-border bg-card p-3.5">
      <p className="text-[10px] font-bold tracking-[0.1em] text-muted uppercase">This course</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-serif text-[28px] leading-none font-semibold text-ink">{thisCourseAttended}</span>
        <span className="text-[13px] text-muted">of {thisCourseHeldSoFar} so far</span>
        {pct !== null ? (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{
              background: "color-mix(in oklab, var(--color-primary) 12%, transparent)",
              color: "var(--color-primary)",
            }}
          >
            {pct}%
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-muted">{thisCourseClasses.length} classes in the course</p>
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
        <a href={`/student/${token}/materials`} className="text-xs font-semibold text-primary hover:underline">
          Download all my materials
        </a>
      ) : null}
      {/* The always-available way in, so dismissing the banner can never
          strand someone who changes their mind. Renders nothing at all on a
          browser that cannot install, or once installed. */}
      <InstallPrompt variant="inline" />
      <PushSubscribeButton subscribe={subscribeVolunteerPush.bind(null, token)} unsubscribe={unsubscribeVolunteerPush.bind(null, token)} />
      <a href={`/student/${token}/unsubscribe`} className="text-[11px] text-muted hover:underline">
        Manage reminder emails
      </a>
    </div>
  );
}

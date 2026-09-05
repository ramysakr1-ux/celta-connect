import { hubReadClient } from "@/lib/supabase/hub-read";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AttendanceRegisterGrid } from "@/components/attendance-register-grid";
import { VolunteersV2, type VolunteerRowData, type ClassLabel } from "@/app/trainer/(hub)/volunteers/volunteers-v2";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { computeSessionTicks, creditedHours, blocksNeededForPresent, CERTIFICATE_HOURS_THRESHOLD, teachingDayNumber } from "@/lib/volunteer-attendance";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

// §14 + design_handoff_volunteer_students_v2 (Ramy, 5 Sep 2026). The
// trainer-side register: Today strip (RSVP replies + Zoom presence),
// register grouped by class (per-day marks, hours banked, link state),
// student card. Attendance is computed, never entered here -- Zoom writes
// it (migration 0200), face-to-face is ticked on the timetable event.
// Checkpoint 9's read-only assessor branch keeps the flat grid.
export default async function VolunteersPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const supabase = trainer ? hubReadClient(trainer, courseId) : createAdminClient();
  const [{ data: volunteers }, { data: course }, { data: tpEvents }] = await Promise.all([
    supabase
      .from("volunteer_students")
      .select("id, name, level, email, created_at, signup_completed_at, volunteer_person_id")
      .eq("course_id", courseId)
      .is("removed_at", null)
      .order("name"),
    supabase.from("courses").select("id, name, end_date, center_id").eq("id", courseId).maybeSingle(),
    supabase.from("course_timetable_events").select("id, event_date, event_time, zoom_url").eq("course_id", courseId).eq("type", "tp").order("event_date").order("event_time"),
  ]);

  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const [center, { data: centerSettings }] = await Promise.all([
    course ? getCachedCenter(course.center_id) : Promise.resolve(null),
    course
      ? supabase.from("centers").select("volunteer_certificate_hours_threshold").eq("id", course.center_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const timeZone = center?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  const todayEvents = (tpEvents ?? []).filter((e) => e.event_date === today);
  const todayEventIds = todayEvents.map((e) => e.id);
  const certificateHoursThreshold = centerSettings?.volunteer_certificate_hours_threshold ?? CERTIFICATE_HOURS_THRESHOLD;

  const [{ data: tokens }, { data: attendanceRows }, { data: signupProfiles }, { data: confirmations }, { data: declines }] = await Promise.all([
    volunteerIds.length > 0
      ? supabase.from("course_access_tokens").select("token, volunteer_student_id, last_opened_at, expires_at").eq("role", "volunteer_student").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
    volunteerIds.length > 0
      ? supabase.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id, joined_at, left_at, source").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
    !trainer || volunteerIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase.from("volunteer_signup_profiles").select("volunteer_student_id, transcript, recording_consent_given_at, audio_url").in("volunteer_student_id", volunteerIds),
    todayEventIds.length > 0 && volunteerIds.length > 0
      ? supabase.from("volunteer_confirmations").select("volunteer_student_id, timetable_event_id").in("timetable_event_id", todayEventIds)
      : Promise.resolve({ data: [] }),
    todayEventIds.length > 0 && volunteerIds.length > 0
      ? supabase.from("volunteer_declines").select("volunteer_student_id, timetable_event_id").in("timetable_event_id", todayEventIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Cross-course hours follow the person, not this course (volunteer_people,
  // migration 0125) -- the same math the Centre Admin pool and the
  // volunteer's own page already use.
  const personIds = [...new Set((volunteers ?? []).map((v) => v.volunteer_person_id).filter((id): id is string => Boolean(id)))];
  const admin = createAdminClient();
  const { data: siblingRows } =
    personIds.length > 0
      ? // course-wide: hours follow the volunteer_person across every course they've volunteered on
        await admin.from("volunteer_students").select("id, course_id, volunteer_person_id").in("volunteer_person_id", personIds)
      : { data: [] as { id: string; course_id: string; volunteer_person_id: string | null }[] };
  const priorSiblings = (siblingRows ?? []).filter((s) => s.course_id !== courseId);
  const priorCourseIds = [...new Set(priorSiblings.map((s) => s.course_id))];
  const priorSiblingIds = priorSiblings.map((s) => s.id);
  const [{ data: priorTpEvents }, { data: priorAttendance }] = await Promise.all([
    priorCourseIds.length > 0
      ? admin.from("course_timetable_events").select("id, event_date, course_id").in("course_id", priorCourseIds).eq("type", "tp")
      : Promise.resolve({ data: [] as { id: string; event_date: string; course_id: string }[] }),
    priorSiblingIds.length > 0
      ? // course-wide: attendance on the person's earlier courses
        admin.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", priorSiblingIds)
      : Promise.resolve({ data: [] as { volunteer_student_id: string; timetable_event_id: string }[] }),
  ]);
  const priorHoursByPerson = new Map<string, { hours: number; courses: number }>();
  for (const personId of personIds) {
    const memberIds = priorSiblings.filter((s) => s.volunteer_person_id === personId).map((s) => s.id);
    if (memberIds.length === 0) continue;
    const memberCourseIds = new Set(priorSiblings.filter((s) => s.volunteer_person_id === personId).map((s) => s.course_id));
    const attended = new Set((priorAttendance ?? []).filter((a) => memberIds.includes(a.volunteer_student_id)).map((a) => a.timetable_event_id));
    const events = (priorTpEvents ?? []).filter((e) => memberCourseIds.has(e.course_id));
    const hours = creditedHours(computeSessionTicks(events, attended, TP_LESSON_LENGTH_MINUTES));
    priorHoursByPerson.set(personId, { hours, courses: memberCourseIds.size });
  }

  // Assessor: read-only register, no management controls at all.
  if (!trainer) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">Attendance register</h1>
          <p className="mt-1 text-sm text-muted">Volunteer student attendance at teaching practice sessions.</p>
        </div>
        <AttendanceRegisterGrid events={tpEvents ?? []} volunteers={volunteers ?? []} attendance={attendanceRows ?? []} />
      </div>
    );
  }

  // ---- shape everything for the client component ----
  const tokenByVolunteer = new Map((tokens ?? []).map((t) => [t.volunteer_student_id, t]));
  const profileByVolunteer = new Map((signupProfiles ?? []).map((p) => [p.volunteer_student_id, p]));
  // "Listen" on the student card (Ramy, 5 Sep 2026) -- a signed hour-long
  // URL per recording; the bucket is private, same pattern as the
  // admissions speaking task.
  const audioUrlByVolunteer = new Map<string, string>();
  await Promise.all(
    (signupProfiles ?? [])
      .filter((p) => p.audio_url)
      .map(async (p) => {
        const { data: signed } = await admin.storage.from("volunteer-signup-audio").createSignedUrl(p.audio_url!, 3600);
        if (signed?.signedUrl) audioUrlByVolunteer.set(p.volunteer_student_id, signed.signedUrl);
      })
  );
  const confirmedSet = new Set((confirmations ?? []).map((c) => c.volunteer_student_id));
  const declinedSet = new Set((declines ?? []).map((d) => d.volunteer_student_id));
  const attendedByVolunteer = new Map<string, Set<string>>();
  const liveByVolunteer = new Set<string>();
  for (const a of attendanceRows ?? []) {
    const set = attendedByVolunteer.get(a.volunteer_student_id) ?? new Set<string>();
    set.add(a.timetable_event_id);
    attendedByVolunteer.set(a.volunteer_student_id, set);
    if (todayEventIds.includes(a.timetable_event_id) && a.joined_at && !a.left_at) liveByVolunteer.add(a.volunteer_student_id);
  }

  const tpDates = [...new Set((tpEvents ?? []).map((e) => e.event_date))].sort();
  const now = new Date();
  const todayStart = todayEvents[0]?.event_time ?? null;
  // "Underway" = the first of today's TP blocks has started, on the
  // centre's own clock (event_date already matched "today" in that zone).
  const localNow = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const todayUnderway = Boolean(todayStart) && localNow >= (todayStart ?? "").slice(0, 5);

  // The rule line's numbers come from the course's own typical day.
  const blocksPerDay = new Map<string, number>();
  for (const e of tpEvents ?? []) blocksPerDay.set(e.event_date, (blocksPerDay.get(e.event_date) ?? 0) + 1);
  const counts = [...blocksPerDay.values()];
  const typicalBlocks = counts.length > 0 ? counts.sort((a, b) => counts.filter((x) => x === a).length - counts.filter((x) => x === b).length).pop()! : 3;
  const sessionHours = (typicalBlocks * TP_LESSON_LENGTH_MINUTES) / 60;

  const rows: VolunteerRowData[] = (volunteers ?? []).map((v) => {
    const attended = attendedByVolunteer.get(v.id) ?? new Set<string>();
    // Held days and today only -- a day that hasn't happened yet is
    // "upcoming", not an absence.
    const ticks = computeSessionTicks(tpEvents ?? [], attended, TP_LESSON_LENGTH_MINUTES).filter((t) => t.date <= today);
    const hoursHere = creditedHours(ticks);
    const prior = v.volunteer_person_id ? (priorHoursByPerson.get(v.volunteer_person_id) ?? { hours: 0, courses: 0 }) : { hours: 0, courses: 0 };
    const tok = tokenByVolunteer.get(v.id);
    const prof = profileByVolunteer.get(v.id);
    const oneLessonCount = ticks.filter((t) => t.date < today && t.tier === "partial").length;
    const absentCount = ticks.filter((t) => t.date < today && t.tier === "absent").length;
    const todayState = todayEvents.length === 0
      ? null
      : liveByVolunteer.has(v.id)
        ? ("in_room" as const)
        : confirmedSet.has(v.id)
          ? todayUnderway
            ? ("not_joined_yet" as const)
            : ("coming" as const)
          : declinedSet.has(v.id)
            ? ("cant" as const)
            : todayUnderway
              ? ("not_joined_yet" as const)
              : ("no_reply" as const);
    return {
      id: v.id,
      name: v.name,
      level: v.level,
      email: v.email,
      joinedAt: v.created_at.slice(0, 10),
      signupCompleted: Boolean(v.signup_completed_at),
      token: tok?.token ?? null,
      lastOpenedAt: tok?.last_opened_at ?? null,
      expiresAt: tok?.expires_at ?? null,
      consentAt: prof?.recording_consent_given_at ?? null,
      transcript: prof?.transcript ?? null,
      audioUrl: audioUrlByVolunteer.get(v.id) ?? null,
      sessions: ticks.map((t) => ({
        date: t.date,
        dayNumber: teachingDayNumber(tpDates, t.date),
        tier: t.tier,
        creditedMinutes: t.creditedMinutes,
        isToday: t.date === today,
        inRoomNow: t.date === today && liveByVolunteer.has(v.id),
      })),
      totalDays: tpDates.length,
      hoursHere,
      hoursPrior: prior.hours,
      priorCourses: prior.courses,
      oneLessonCount,
      absentCount,
      todayState,
      saidComing: confirmedSet.has(v.id),
      saidCant: declinedSet.has(v.id),
    };
  });

  const classes: ClassLabel[] = [...new Set(rows.map((r) => r.level ?? ""))].sort().map((level) => ({
    level: level || null,
    label: level || "No class set",
  }));

  return (
    <VolunteersV2
      rows={rows}
      classes={classes}
      todayInfo={
        todayEvents.length > 0
          ? {
              dateLabel: new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
              classNumber: teachingDayNumber(tpDates, today),
              totalClasses: tpDates.length,
              startTime: todayStart ? todayStart.slice(0, 5) : null,
              underway: todayUnderway,
              lessonsToday: todayEvents.length,
            }
          : null
      }
      rule={{ need: blocksNeededForPresent(typicalBlocks), lessons: typicalBlocks, sessionHours, target: certificateHoursThreshold }}
      courseEndDate={course?.end_date ?? null}
      siteOrigin={process.env.SITE_URL ?? "https://www.celtaconnect.com"}
    />
  );
}

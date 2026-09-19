// The volunteer pool, at the size a real class has.
//
// The demo carried two volunteer students -- Emeka (Intermediate) and Grace
// (Elementary), one per level -- so the Handbook 9.1.3 class-size warning
// fired on every walkthrough, every register listed the other level's
// student, and each class read "1 drifting". Ramy, 20 Sep 2026: seed ~8 per
// level. Seven more per level here; Emeka and Grace keep their special
// roles (the signed-up dashboard, the first-screen signup) and stay seeded
// where they were.
//
// Each person: signed up before the course, an email, a reusable link,
// attendance across the lessons of THEIR class that have already happened
// (most days in full, a couple of gaps), and a reply for the next class.
// Runs from seed-demo.mjs on every rebuild and from a one-off runner on the
// live course, so it takes the record clock rather than reading one.

const POOL = [
  // Elementary (A2)
  { name: "Mariam Haddad", level: "Elementary", l1: "Arabic", motivation: "I want to speak with my children's teachers without my husband translating." },
  { name: "Yusuf Demir", level: "Elementary", l1: "Turkish", motivation: "For my job in the hotel. Guests ask me things and I only smile." },
  { name: "Sofia Petrova", level: "Elementary", l1: "Bulgarian", motivation: "I am starting a nursing course next year and the interview is in English." },
  { name: "Chen Wei", level: "Elementary", l1: "Mandarin", motivation: "My English is only from apps. I need to talk to real people." },
  { name: "Ana Lucía Torres", level: "Elementary", l1: "Spanish", motivation: "Practice, practice. I understand a lot but I am shy to speak." },
  { name: "Fatima Al-Sayed", level: "Elementary", l1: "Arabic", motivation: "To help my son with homework and to talk at the doctor." },
  { name: "Paulo Ribeiro", level: "Elementary", l1: "Portuguese", motivation: "Work. I drive deliveries and customers speak fast." },
  // Intermediate (B1+)
  { name: "Aylin Kaya", level: "Intermediate", l1: "Turkish", motivation: "I am preparing for IELTS and I need speaking practice with correction." },
  { name: "Diego Fernández", level: "Intermediate", l1: "Spanish", motivation: "My company is moving me to the London office in January." },
  { name: "Nguyen Thi Lan", level: "Intermediate", l1: "Vietnamese", motivation: "I read and write well for university but my speaking is behind." },
  { name: "Ivan Petrov", level: "Intermediate", l1: "Russian", motivation: "Confidence. I know the grammar but I freeze in meetings." },
  { name: "Zeynep Arslan", level: "Intermediate", l1: "Turkish", motivation: "I teach maths and I want to teach it in English one day." },
  { name: "Carlos Mendes", level: "Intermediate", l1: "Portuguese", motivation: "Free lessons with real teachers -- and I like meeting people." },
  { name: "Noor Rahman", level: "Intermediate", l1: "Bengali", motivation: "I want to pass the interview for a pharmacy assistant position." },
];

const slug = (name) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * @param supabase service-role client
 * @param ctx.courseId the demo course
 * @param ctx.centerId its centre
 * @param ctx.today course-local ISO date the record is written "as of"
 * @param ctx.signedUpAt ISO timestamp for the sign-ups (before the course)
 * @param ctx.nowIso ISO timestamp for "now" on the record clock
 */
export async function seedVolunteerPoolDemo(supabase, { courseId, centerId, today, signedUpAt, nowIso }) {
  const { data: tpRows } = await supabase
    .from("course_timetable_events")
    .select("id, event_date, event_time, detail")
    .eq("course_id", courseId)
    .eq("type", "tp")
    .order("event_date")
    .order("event_time");
  const classOf = (level) => ((level ?? "").toLowerCase().startsWith("elem") ? "a2" : "b1");
  const rowsFor = (level) => (tpRows ?? []).filter((e) => !e.detail || e.detail.toLowerCase().startsWith(classOf(level)));

  let people = 0;
  let attendance = 0;
  let replies = 0;
  for (const [i, p] of POOL.entries()) {
    const email = `demo-vol-${slug(p.name)}@celtaconnect.com`;
    const { data: vs, error } = await supabase
      .from("volunteer_students")
      .insert({ course_id: courseId, name: p.name, level: p.level, email, signup_completed_at: signedUpAt })
      .select("id")
      .single();
    if (error) throw error;
    people += 1;
    await supabase.from("volunteer_signup_profiles").insert({
      center_id: centerId,
      course_id: courseId,
      volunteer_student_id: vs.id,
      written_answers: { motivation: p.motivation },
      l1_language: p.l1,
      consent_given_at: signedUpAt,
    });
    await supabase.from("course_access_tokens").insert({
      course_id: courseId,
      role: "volunteer_student",
      volunteer_student_id: vs.id,
      expires_at: new Date(new Date(nowIso).getTime() + 5 * 365 * 86400000).toISOString(),
      // Most have opened their link at some point; a couple never have.
      last_opened_at: i % 5 === 4 ? null : nowIso,
    });

    // Attendance: the lessons of their class already taught. Full days,
    // with gaps that differ person to person -- one misses the third day,
    // one the fifth, one came for a single lesson on day two -- so the
    // register and the "drifting" line have something true to show.
    const mine = rowsFor(p.level).filter((e) => e.event_date < today);
    const dates = [...new Set(mine.map((e) => e.event_date))];
    const attRows = dates.flatMap((date, d) => {
      const blocks = mine.filter((e) => e.event_date === date);
      const missDay = (i % 7 === 1 && d === 2) || (i % 7 === 3 && d === 4) || (i % 7 === 5 && d === 6) || (i % 7 === 6 && (d === 1 || d === 7));
      const oneLesson = i % 7 === 2 && d === 1;
      const take = missDay ? 0 : oneLesson ? 1 : blocks.length;
      return blocks.slice(0, take).map((e) => ({ volunteer_student_id: vs.id, timetable_event_id: e.id }));
    });
    if (attRows.length > 0) {
      const { error: attErr } = await supabase.from("volunteer_attendance").insert(attRows);
      if (attErr) throw attErr;
      attendance += attRows.length;
    }

    // Reply for the next class of their level: most said yes, one can't,
    // one hasn't answered.
    const next = rowsFor(p.level).find((e) => e.event_date >= today);
    if (next) {
      const k = i % 7;
      if (k === 4) {
        await supabase.from("volunteer_declines").upsert({ volunteer_student_id: vs.id, timetable_event_id: next.id }, { onConflict: "volunteer_student_id,timetable_event_id" });
        replies += 1;
      } else if (k !== 6) {
        await supabase.from("volunteer_confirmations").upsert({ volunteer_student_id: vs.id, timetable_event_id: next.id }, { onConflict: "volunteer_student_id,timetable_event_id" });
        replies += 1;
      }
    }
  }
  return { people, attendance, replies };
}

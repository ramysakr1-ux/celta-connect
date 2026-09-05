import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The two buttons in the day-before RSVP email land here (for-claude-code-
// volunteer-messaging-complete.md §2): yes records a confirmation, no a
// decline (the existing table -- one decline mechanism, not two), and
// either way the volunteer ends up on their own class page. The token is
// the identity, re-validated here like every other volunteer write; an
// email link is a GET, so this is a GET, idempotent by upsert.
export async function GET(request: Request, { params }: { params: Promise<{ token: string; eventId: string; answer: string }> }) {
  const { token, eventId, answer } = await params;
  const dest = new URL(`/student/${token}`, request.url);
  if (answer !== "yes" && answer !== "no") return NextResponse.redirect(dest, 303);

  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("volunteer_student_id, course_id, expires_at")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();
  if (!accessToken?.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return NextResponse.redirect(dest, 303);
  }

  // The event must be on this volunteer's own course -- a guessed event id
  // from another course records nothing.
  const { data: event } = await admin.from("course_timetable_events").select("id, course_id").eq("id", eventId).maybeSingle();
  if (!event || event.course_id !== accessToken.course_id) return NextResponse.redirect(dest, 303);

  const volunteerId = accessToken.volunteer_student_id;
  if (answer === "yes") {
    await admin
      .from("volunteer_confirmations")
      .upsert({ volunteer_student_id: volunteerId, timetable_event_id: eventId }, { onConflict: "volunteer_student_id,timetable_event_id" });
    await admin.from("volunteer_declines").delete().eq("volunteer_student_id", volunteerId).eq("timetable_event_id", eventId);
  } else {
    await admin
      .from("volunteer_declines")
      .upsert({ volunteer_student_id: volunteerId, timetable_event_id: eventId }, { onConflict: "volunteer_student_id,timetable_event_id" });
    await admin.from("volunteer_confirmations").delete().eq("volunteer_student_id", volunteerId).eq("timetable_event_id", eventId);
  }

  return NextResponse.redirect(dest, 303);
}

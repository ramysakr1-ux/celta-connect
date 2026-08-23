import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyZoomSignature, buildUrlValidationResponse } from "@/lib/zoom/webhook-signature";
import { findExactEmailMatch, suggestVolunteerMatch } from "@/lib/zoom/matching";
import { toLocalIso } from "@/lib/timetable-grid";

// zoom-auto-attendance.md §3. Mirrors src/app/api/webhooks/resend/route.ts's
// shape (raw body, HMAC header verification, always 200 on anything not
// acted on so the provider stops retrying) -- Zoom additionally requires
// answering its one-time endpoint.url_validation handshake before it will
// ever send a real event.
//
// Field names below (payload.object.id, payload.object.participant.{email,
// user_name}) follow Zoom's documented meeting.participant_joined/left
// webhook shape as of this app's build. Verify against a real delivered
// payload once ZOOM_WEBHOOK_SECRET is live -- Zoom has changed webhook
// payload shapes across API versions before, and this hasn't been
// exercised against a real Zoom account.

interface ZoomWebhookBody {
  event?: string;
  payload?: {
    plainToken?: string;
    account_id?: string;
    object?: {
      id?: number | string;
      participant?: {
        email?: string;
        user_name?: string;
      };
    };
  };
}

export async function POST(request: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET;
  const raw = await request.text();

  let body: ZoomWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Unparseable payload." }, { status: 400 });
  }

  // The handshake Zoom sends once, when the webhook URL is first
  // configured/re-verified -- must be answered correctly or Zoom never
  // activates the subscription and no real events ever arrive.
  if (body.event === "endpoint.url_validation") {
    if (!secret) return NextResponse.json({ error: "ZOOM_WEBHOOK_SECRET not set." }, { status: 500 });
    const plainToken = body.payload?.plainToken;
    if (!plainToken) return NextResponse.json({ error: "Missing plainToken." }, { status: 400 });
    return NextResponse.json(buildUrlValidationResponse(secret, plainToken));
  }

  // Same open-in-dev-only posture as the Resend route: refuse unsigned
  // events once a secret is configured, accept anything locally.
  if (secret) {
    const timestamp = request.headers.get("x-zm-request-timestamp");
    const signature = request.headers.get("x-zm-signature");
    if (!timestamp || !signature || !verifyZoomSignature(secret, timestamp, raw, signature)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
  }

  const eventType = body.event;
  if (eventType !== "meeting.participant_joined" && eventType !== "meeting.participant_left") {
    return NextResponse.json({ ok: true, ignored: eventType ?? "unknown" });
  }

  const meetingId = body.payload?.object?.id != null ? String(body.payload.object.id) : null;
  const participant = body.payload?.object?.participant;
  if (!meetingId || !participant) {
    return NextResponse.json({ ok: true, ignored: "missing meeting id or participant" });
  }

  const admin = createAdminClient();

  // A trainer can reuse one personal Zoom link across many sessions, so
  // zoom_meeting_id alone isn't necessarily unique -- narrow to today's
  // date (the webhook fires live, during the session) and, if more than
  // one still matches, the one closest to right now.
  const today = toLocalIso(new Date());
  const { data: candidateEvents } = await admin
    .from("course_timetable_events")
    .select("id, course_id, event_time")
    .eq("zoom_meeting_id", meetingId)
    .eq("event_date", today);

  const event = pickClosestEvent(candidateEvents ?? []);
  if (!event) return NextResponse.json({ ok: true, unmatched_event: true });

  const email = participant.email ? participant.email.trim().toLowerCase() : null;
  const displayName = participant.user_name?.trim() || "Unknown";
  const occurredAt = new Date().toISOString();

  const { data: volunteers } = await admin
    .from("volunteer_students")
    .select("id, name, email")
    .eq("course_id", event.course_id)
    .is("removed_at", null);
  const candidates = volunteers ?? [];

  const exactMatch = findExactEmailMatch(email, candidates);

  if (exactMatch) {
    if (eventType === "meeting.participant_joined") {
      // Keep the first join, not the latest -- a rejoin shouldn't reset
      // when the session is considered to have started for this person.
      const { data: existing } = await admin
        .from("volunteer_attendance")
        .select("id")
        .eq("volunteer_student_id", exactMatch.id)
        .eq("timetable_event_id", event.id)
        .maybeSingle();
      if (!existing) {
        await admin.from("volunteer_attendance").insert({
          volunteer_student_id: exactMatch.id,
          timetable_event_id: event.id,
          source: "zoom",
          joined_at: occurredAt,
          zoom_participant_email: email,
        });
      }
    } else {
      await admin
        .from("volunteer_attendance")
        .update({ left_at: occurredAt })
        .eq("volunteer_student_id", exactMatch.id)
        .eq("timetable_event_id", event.id);
    }
    return NextResponse.json({ ok: true, matched: true });
  }

  // No confident email match -- land in the review list. suggestVolunteerMatch
  // is advisory only (pre-fills the trainer's dropdown); it never writes to
  // volunteer_attendance itself.
  const suggestion = suggestVolunteerMatch(displayName, candidates);
  const { data: existingUnmatched } = email
    ? await admin
        .from("zoom_unmatched_participants")
        .select("id")
        .eq("timetable_event_id", event.id)
        .eq("zoom_email", email)
        .is("resolved_at", null)
        .maybeSingle()
    : { data: null };

  if (eventType === "meeting.participant_joined") {
    if (!existingUnmatched) {
      await admin.from("zoom_unmatched_participants").insert({
        timetable_event_id: event.id,
        zoom_email: email,
        zoom_display_name: displayName,
        suggested_volunteer_student_id: suggestion?.id ?? null,
        joined_at: occurredAt,
      });
    }
  } else if (existingUnmatched) {
    await admin.from("zoom_unmatched_participants").update({ left_at: occurredAt }).eq("id", existingUnmatched.id);
  }

  return NextResponse.json({ ok: true, matched: false });
}

function pickClosestEvent<T extends { id: string; course_id: string; event_time: string | null }>(events: T[]): T | null {
  if (events.length === 0) return null;
  if (events.length === 1) return events[0];
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const toMinutes = (t: string | null) => {
    if (!t) return nowMinutes;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return events.reduce((closest, e) => (Math.abs(toMinutes(e.event_time) - nowMinutes) < Math.abs(toMinutes(closest.event_time) - nowMinutes) ? e : closest));
}

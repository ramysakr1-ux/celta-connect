// zoom-auto-attendance.md §2 -- extracts the numeric meeting ID out of
// whatever Zoom join-link shape a trainer pastes (zoom.us/j/<id>,
// us02web.zoom.us/j/<id>?pwd=..., with or without https://), so the
// webhook can match an incoming participant event back to the right
// timetable row via course_timetable_events.zoom_meeting_id.
export function extractZoomMeetingId(zoomUrl: string | null): string | null {
  if (!zoomUrl) return null;
  const match = zoomUrl.match(/zoom\.us\/j\/(\d+)/i);
  return match ? match[1] : null;
}

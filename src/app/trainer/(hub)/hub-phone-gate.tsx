"use client";

import { usePathname } from "next/navigation";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";
import { isPhoneDoor } from "@/app/trainer/(hub)/trainer-mobile-nav";

// The hub's phone posture in one place (high-traffic audit 16 Sep 2026, A7):
// the four doors on the phone bar render on a phone; every other hub page
// says it needs a laptop, in the same words the individually gated pages
// already used. Decided by path in the layout, so no page carries a gate of
// its own -- and a page that is gated twice (the grade form, rotation, the
// timetable's editing mode) just shows the outer message below md.
//
// An assessor's tour of the hub is untouched: build-spec §7 grants assessor
// sessions reading on a phone, and the grade form already skips its gate for
// them.
const TASKS: Record<string, string> = {
  tp: "Writing TP feedback",
  timetable: "The timetable",
  assignments: "Marking assignments",
  assessor: "The assessor tab",
  "grades-report": "The grade form",
  rotation: "Teaching Practice rotation",
  volunteers: "Managing volunteer students",
  "resource-hub": "The resource hub",
  settings: "Your settings",
  concerns: "Concerns",
  "support-access": "Support access",
  "trainer-in-training": "Trainer-in-Training",
  coursebooks: "The TP points library",
  "pre-course-task": "Pre-course tasks",
  "observation-tasks": "Observation tasks",
  "observation-hours": "Observation hours",
  gtky: "Day-one activities",
  "session-materials": "Session materials",
  "assignment-briefs": "Assignment briefs",
  "marking-guidance": "Marking guidance",
  malpractice: "A malpractice case",
  "grade-query-reply": "Replying to a grade query",
  "fol-spot-check": "The Focus on the Learner spot check",
  video: "Video",
  audio: "Audio",
};

export function HubPhoneGate({ skip = false, children }: { skip?: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (skip || isPhoneDoor(pathname)) return <>{children}</>;
  const segment = pathname.split("/")[2] ?? "";
  const task = TASKS[segment] ?? "This page";
  return <LaptopOnlyGate task={task}>{children}</LaptopOnlyGate>;
}

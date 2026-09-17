import { redirect } from "next/navigation";

// /demo is the Course Story now (for-claude-code-demo-clock.md §4: "it
// replaces the eight-card /demo landing as the first thing a visitor sees;
// the eight role links move into the story's header pills"). The role routes
// underneath -- /demo/<role> -- are unchanged and still the doors.
export default function DemoLandingPage() {
  redirect("/demo/story");
}

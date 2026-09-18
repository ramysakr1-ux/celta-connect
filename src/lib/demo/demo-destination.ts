import { safeRedirectPath } from "@/lib/safe-redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickDemoCourse } from "@/lib/demo-course";

/**
 * `?to=` on a /demo/<role> link: the screen to land on, instead of that
 * person's own landing page.
 *
 * Ramy, 18 Sep 2026, walking the Course Story: "everything goes somewhere
 * else... I can't click on any of them and it takes me where it's supposed
 * to." 130 of the story's 143 cards had no destination of their own, so each
 * one signed you in as its lane's person, pinned the day and dropped you on
 * their landing page -- right person, right day, wrong screen. The cards
 * could not say where they meant, because the demo links had nowhere to put
 * it.
 *
 * `{me}` stands for the signed-in profile's own id, so a card can point at
 * "/portfolio/{me}/tp/3" without hardcoding an id that changes every time
 * the demo is reseeded. mintDemoMagicLink already accepts a function of the
 * profile id for exactly this, so the substitution happens after the account
 * is resolved and never appears in a URL.
 *
 * `{course}` is the demo's own running course, for the rooms that are per
 * course rather than per person -- the course room holds the entry form, the
 * centre grade form and the grade approval form, and without this those cards
 * could only land on the course-administration index and leave the reader to
 * find the course (walked 18 Sep 2026). Resolved the same way the demo doors
 * resolve it, so it is always the course the demo is about.
 *
 * Same-origin only, through safeRedirectPath -- a demo link is a public URL
 * that authenticates somebody, which is precisely the shape an open redirect
 * needs to be dangerous.
 *
 * `{filmed:N}` and `{tutorial:stage1|stage2|stage3}` are the records behind a
 * card, resolved at click time: the Nth filmed observation on the course, or
 * this candidate's own tutorial. Those ids are per seed and per person, so a
 * card cannot name one. A record that does not exist -- the demo candidate
 * has no Stage 3, because she is doing well -- falls back to the timetable,
 * where the session appears, rather than 404ing on a card that looked like a
 * door (18 Sep 2026).
 */
export async function demoDestination(
  raw: string | null | undefined,
  fallback: string | ((profileId: string) => string),
  opts?: { candidateEmail?: string }
): Promise<string | ((profileId: string) => string)> {
  if (!raw) return fallback;
  let path = safeRedirectPath(raw, "");
  if (!path) return fallback;

  const filmed = path.match(/\{filmed:(\d+)\}/);
  if (filmed) {
    const id = await nthFilmedObservationId(Number(filmed[1]));
    path = id ? path.replace(filmed[0], id) : "/portfolio/{me}/timetable";
  }

  const tutorial = path.match(/\{tutorial:(stage1|stage2|stage3)\}/);
  if (tutorial) {
    const resolved = await tutorialPathFor(tutorial[1] as "stage1" | "stage2" | "stage3", opts?.candidateEmail);
    path = resolved ?? "/portfolio/{me}/timetable";
  }

  if (path.includes("{course}")) {
    const courseId = await demoCourseId();
    // No course to point at means the card would land on a broken id; the
    // person's own landing is a worse answer than the index it came from,
    // so fall back to the path with the course segment dropped.
    if (!courseId) return fallback;
    path = path.replaceAll("{course}", courseId);
  }

  if (!path.includes("{me}")) return path;
  return (profileId: string) => path.replaceAll("{me}", profileId);
}

/** The Nth filmed observation on the demo course, in timetable order. */
async function nthFilmedObservationId(n: number): Promise<string | null> {
  if (!Number.isInteger(n) || n < 1) return null;
  try {
    const courseId = await demoCourseId();
    if (!courseId) return null;
    const admin = createAdminClient();
    const { data: sessions } = await admin
      .from("filmed_observation_sessions")
      .select("id, timetable_event_id")
      .eq("course_id", courseId);
    if (!sessions?.length) return null;
    // Their order is the timetable's, not the table's -- the row order is
    // whatever the seed inserted.
    const { data: events } = await admin
      .from("course_timetable_events")
      .select("id, event_date, event_time")
      .in("id", sessions.map((s) => s.timetable_event_id).filter(Boolean));
    const dateById = new Map((events ?? []).map((e) => [e.id, `${e.event_date}T${e.event_time ?? "00:00"}`]));
    const ordered = [...sessions].sort((a, b) =>
      (dateById.get(a.timetable_event_id) ?? "").localeCompare(dateById.get(b.timetable_event_id) ?? "")
    );
    return ordered[n - 1]?.id ?? null;
  } catch {
    return null;
  }
}

/** This candidate's own tutorial for a stage, as a full path. */
async function tutorialPathFor(
  stage: "stage1" | "stage2" | "stage3",
  candidateEmail?: string
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    if (stage === "stage2") {
      // Stage 2 is a booking sheet the whole course shares, not a per-person
      // invite, so the card opens the first block on the course.
      const courseId = await demoCourseId();
      if (!courseId) return null;
      const { data: block } = await admin
        .from("stage2_tutorial_blocks")
        .select("id")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return block ? `/portfolio/{me}/stage2-tutorial/${block.id}` : null;
    }
    if (!candidateEmail) return null;
    const { data: profile } = await admin.from("profiles").select("id").eq("email", candidateEmail).maybeSingle();
    if (!profile) return null;
    const { data: invite } = await admin
      .from("individual_tutorial_invites")
      .select("id")
      .eq("trainee_id", profile.id)
      .eq("stage", stage)
      .maybeSingle();
    return invite ? `/portfolio/{me}/individual-tutorial/${invite.id}` : null;
  } catch {
    return null;
  }
}

/** The course the demo is about, resolved as the demo doors resolve it. */
async function demoCourseId(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: centre } = await admin
      .from("centers")
      .select("id")
      .eq("is_demo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!centre) return null;
    const course = await pickDemoCourse<{ id: string; start_date: string }>(admin, centre.id, "id, start_date");
    return course?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The token-based doors -- the assessor's pack and the volunteer's page --
 * have no session and no profile id. Their `?to=` is a path UNDER the token
 * root, so "/lesson-plans" becomes "/assessor/<token>/lesson-plans", and a
 * card can never point one of them at somebody else's room.
 */
export function demoTokenDestination(raw: string | null | undefined, root: string): string {
  const suffix = safeRedirectPath(raw, "");
  if (!suffix) return root;
  return `${root}${suffix}`;
}

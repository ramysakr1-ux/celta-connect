import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Redemption for the links generated on Command Center > Access.
//
// Until 3 Sep 2026 this route existed only to apologise: generate, copy and
// revoke were real, but the link signed nobody in, and visiting one said so
// in plain HTML. It mints a real session now.
//
// DEMO CENTRES ONLY, every role. Ramy, 3 Sep 2026: "Access only creates magic
// links, not real invites." That is the whole scope of this feature and the
// line is enforced here rather than assumed.
//
// I had this wrong first: I made the assessor branch mint a live
// course_access_tokens row on any centre, reasoning that an assessor arrives
// by link rather than by invite -- true, but the real link already exists.
// getOrCreateAssessorToken() (src/app/trainer/assessor-actions.ts) issues it
// from the trainer hub, gated on computeAssessorReadiness and expiring on the
// course end date, with an email to the assessor. Minting a second one from
// here would have handed out an assessor link for a course that had not
// passed that gate. The MCT issues real assessor links, on their own course.
//
// Two mechanisms inside a demo centre, because Connect genuinely has two:
//
//   assessor, volunteer          -- no account exists. A token plus a cookie,
//                                   the same entry a real one uses.
//   centre_admin/mct/act/trainee -- a real seeded account, signed in by magic
//                                   link. Safe only because migration 0079's
//                                   trigger blocks every write a demo centre
//                                   might attempt.
const ACCOUNT_ROLES = ["centre_admin", "mct", "act", "trainee"] as const;

function page(title: string, body: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#3a2f1f;line-height:1.6"><h1 style="font-size:20px">${title}</h1><p>${body}</p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  const { data: link } = await admin
    .from("platform_demo_login_links")
    .select("id, center_id, role_key, expires_at, revoked_at")
    .eq("login_token", token)
    .maybeSingle();

  const valid = link && !link.revoked_at && new Date(link.expires_at) > new Date();
  if (!valid) return NextResponse.redirect(new URL("/", siteUrl));

  // Recorded before anything can fail below, so a link that was clicked but
  // couldn't resolve still shows as used rather than looking untouched.
  await admin.from("platform_demo_login_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);

  const { data: centre } = await admin
    .from("centers")
    .select("id, name, is_demo")
    .eq("id", link.center_id)
    .maybeSingle();
  if (!centre) return page("That centre is gone", "The link is valid, but the centre it was made for no longer exists.");

  if (!centre.is_demo) {
    return page(
      "Not on a live centre",
      `${centre.name} is a real centre. These links sign someone in without an account, which is only safe where every write is blocked at the database layer -- so they work on demo centres alone. A real assessor link is issued by the course tutor from the trainer hub, where it is checked against assessor readiness and expires with the course.`
    );
  }

  // Newest course at the chosen centre. Both token roles hang off a course,
  // not off the centre itself.
  const { data: course } = await admin
    .from("courses")
    .select("id, end_date")
    .eq("center_id", centre.id)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (link.role_key === "assessor") {
    if (!course) return page("No course to assess", `${centre.name} has no course yet, and an assessor link is issued against a course.`);

    const { data: existing } = await admin
      .from("course_access_tokens")
      .select("token")
      .eq("course_id", course.id)
      .eq("role", "assessor")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.redirect(new URL(`/assessor/${existing.token}`, siteUrl));

    // A demo course can have ended already, so don't let its end date expire
    // the token before anyone opens it -- same reasoning as demo/assessor.
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { data: created } = await admin
      .from("course_access_tokens")
      .insert({
        course_id: course.id,
        role: "assessor",
        expires_at: expiresAt.toISOString(),
        // Pre-accepted, as demo/assessor does it: the gate writes acceptance
        // back to this row, and a demo centre rejects every write, which
        // would strand the visitor at the gate forever.
        terms_accepted_at: new Date().toISOString(),
      })
      .select("token")
      .single();
    if (!created) return page("Could not issue the link", "The assessor link could not be created. Try generating a new one.");

    return NextResponse.redirect(new URL(`/assessor/${created.token}`, siteUrl));
  }

  if (link.role_key === "volunteer") {
    if (!course) return page("No course here", `${centre.name} has no course yet, so it has no volunteer students.`);

    // Found, never minted. A volunteer's token belongs to a real student
    // record; minting a bare one would land on a page with no student behind
    // it. If nobody has signed up here yet, say so.
    const { data: existing } = await admin
      .from("course_access_tokens")
      .select("token")
      .eq("course_id", course.id)
      .eq("role", "volunteer_student")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!existing) return page("No volunteer students yet", `Nobody has signed up as a volunteer student at ${centre.name}, so there is no volunteer view to open.`);

    return NextResponse.redirect(new URL(`/student/${existing.token}`, siteUrl));
  }

  if (!(ACCOUNT_ROLES as readonly string[]).includes(link.role_key)) {
    return page("Unknown role", "This link names a role Connect doesn't recognise.");
  }

  const resolved = await resolveDemoAccount(admin, centre.id, link.role_key, course?.id ?? null);
  if (!resolved) {
    return page("Nobody holds that role here", `${centre.name} has no ${link.role_key} to sign in as.`);
  }

  return mintDemoMagicLink(resolved.email, resolved.next);
}

type Admin = ReturnType<typeof createAdminClient>;

/** Finds a seeded account holding `roleKey` at a demo centre, and where to land them. */
async function resolveDemoAccount(
  admin: Admin,
  centerId: string,
  roleKey: string,
  courseId: string | null
): Promise<{ email: string; next: string | ((profileId: string) => string) } | null> {
  if (roleKey === "centre_admin") {
    const { data: grant } = await admin
      .from("centre_roles")
      .select("profile_id")
      .eq("center_id", centerId)
      .in("role", ["centre_administrator", "centre_owner"])
      .limit(1)
      .maybeSingle();
    if (!grant) return null;
    const email = await emailOf(admin, grant.profile_id);
    return email ? { email, next: "/centre" } : null;
  }

  if (roleKey === "mct" || roleKey === "act") {
    if (!courseId) return null;
    const { data: tutor } = await admin
      .from("course_tutors")
      .select("profile_id")
      .eq("course_id", courseId)
      .eq("tutor_role", roleKey === "mct" ? "main_course_tutor" : "assistant_course_tutor")
      .is("left_at", null)
      .limit(1)
      .maybeSingle();
    if (!tutor) return null;
    const email = await emailOf(admin, tutor.profile_id);
    return email ? { email, next: "/trainer" } : null;
  }

  // trainee -- their own portfolio is their home, so the destination depends
  // on which profile the magic link resolves to.
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("center_id", centerId)
    .eq("role", "trainee")
    .limit(1)
    .maybeSingle();
  return profile?.email ? { email: profile.email, next: (profileId: string) => `/portfolio/${profileId}` } : null;
}

async function emailOf(admin: Admin, profileId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
  return data?.email ?? null;
}

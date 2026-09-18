import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickDemoCourse } from "@/lib/demo-course";
import { CENTRE_ROLE_LABELS, type CentreRole } from "@/lib/auth/centre-permissions";

// Who each Course Story card signs you in as.
//
// Ramy, 18 Sep 2026, walking the story: the first two cards in the centre
// lane are different people -- Diane Okonkwo sets the course up, Priya Raman
// runs admissions -- and the cards swapped accounts under him without saying
// so. "Add the names to the cards."
//
// Read from the database, not typed in here. The page's own standfirst says
// "every card is a real screen... nothing here is a mock-up", and a name
// hardcoded beside a seeded account is exactly a mock-up the first time the
// demo is reseeded with different people. Role labels come from the same
// place: centre_roles for the centre lane, course_tutors for the tutors, so
// "Centre manager" and "Main course tutor" can never drift from what the
// screens themselves say.
//
// Keyed by demo path, no query string. A card with no entry -- the
// /demo/journey/* pages -- is a public screen with nobody signed in, and
// deliberately shows no name.
export interface DemoPerson {
  name: string;
  role: string;
}

const EMAILS = {
  "/demo/centre-owner": "demo-centre-admin@celtaconnect.com",
  "/demo/centre-admin": "demo-centre-manager@celtaconnect.com",
  "/demo/course-admin": "demo-course-admin@celtaconnect.com",
  "/demo/centre-observer": "demo-centre-observer@celtaconnect.com",
  "/demo/trainee": "demo-amara@celtaconnect.com",
  "/demo/trainee-gtky": "demo-amara@celtaconnect.com",
  "/demo/trainee-precourse": "demo-amara@celtaconnect.com",
  "/demo/trainer": "demo-trainer@celtaconnect.com",
  "/demo/trainer-act": "demo-trainer2@celtaconnect.com",
} as const;

const TUTOR_ROLE_LABELS: Record<string, string> = {
  main_course_tutor: "Main course tutor",
  assistant_course_tutor: "Assistant course tutor",
};

export const getDemoPeople = unstable_cache(
  async (): Promise<Record<string, DemoPerson>> => {
    const out: Record<string, DemoPerson> = {};
    try {
      const admin = createAdminClient();

      const { data: centre } = await admin
        .from("centers")
        .select("id")
        .eq("is_demo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!centre) return out;

      const course = await pickDemoCourse<{ id: string; start_date: string; assessor_name: string | null }>(
        admin,
        centre.id,
        "id, start_date, assessor_name"
      );

      const emails = [...new Set(Object.values(EMAILS))];
      const { data: profiles } = await admin.from("profiles").select("id, email, full_name").in("email", emails);
      const byEmail = new Map((profiles ?? []).map((p) => [p.email, p]));

      // Centre-side roles: the grant, not the job title on the profile.
      const { data: grants } = await admin
        .from("centre_roles")
        .select("profile_id, role")
        .in("profile_id", (profiles ?? []).map((p) => p.id))
        .is("revoked_at", null);
      const grantByProfile = new Map<string, string>();
      for (const g of grants ?? []) if (!grantByProfile.has(g.profile_id)) grantByProfile.set(g.profile_id, g.role);

      // Tutor roles on the course the demo actually opens -- course_tutors,
      // never profiles.tutor_role, which is set once at signup and never
      // re-synced (that is what swapped the two demo tutor links on 16 Sep).
      const tutorByProfile = new Map<string, string>();
      if (course) {
        const { data: tutors } = await admin
          .from("course_tutors")
          .select("profile_id, tutor_role")
          .eq("course_id", course.id)
          .is("left_at", null);
        for (const t of tutors ?? []) if (t.tutor_role) tutorByProfile.set(t.profile_id, t.tutor_role);
      }

      for (const [path, email] of Object.entries(EMAILS)) {
        const p = byEmail.get(email);
        if (!p?.full_name) continue;
        const tutorRole = tutorByProfile.get(p.id);
        const centreRole = grantByProfile.get(p.id);
        const role = tutorRole
          ? (TUTOR_ROLE_LABELS[tutorRole] ?? tutorRole)
          : centreRole
            ? (CENTRE_ROLE_LABELS[centreRole as CentreRole] ?? centreRole)
            : "Candidate";
        out[path] = { name: p.full_name, role };
      }

      if (course?.assessor_name) out["/demo/assessor"] = { name: course.assessor_name, role: "Assessor" };

      // The volunteer link opens whichever token the route itself opens --
      // the earliest one on this course -- so resolve the person the same way
      // rather than naming a volunteer the link would not take you to.
      if (course) {
        const { data: token } = await admin
          .from("course_access_tokens")
          .select("volunteer_student_id")
          .eq("course_id", course.id)
          .eq("role", "volunteer_student")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (token?.volunteer_student_id) {
          const { data: v } = await admin
            .from("volunteer_students")
            .select("name")
            .eq("id", token.volunteer_student_id)
            .maybeSingle();
          if (v?.name) out["/demo/volunteer"] = { name: v.name, role: "Volunteer student" };
        }
      }
    } catch {
      // A story page that cannot reach the database should still present.
      // Losing the names is a smaller failure than losing the page.
    }
    return out;
  },
  ["demo-story-people"],
  { revalidate: 900 }
);

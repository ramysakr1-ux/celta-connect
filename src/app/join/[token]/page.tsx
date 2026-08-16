import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "@/app/join/[token]/join-form";
import { Wordmark } from "@/components/wordmark";
import type { UserRole } from "@/lib/supabase/types";

// Unified with /login and every tokenized-link gate onto one entry-moment
// look (sheet-gold + the real Wordmark) rather than this page's own
// bespoke dark theme + animated side-line effect from earlier in the
// build -- dropped deliberately, see project memory.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, name, center_id, trainee_join_token, trainer_join_token")
    .or(`trainee_join_token.eq.${token},trainer_join_token.eq.${token}`)
    .maybeSingle();

  // A course's row (and its join tokens) survive close-out -- only the
  // trainee-owned working data gets wiped (src/lib/course-close-out/wipe.ts)
  // -- so a token that still matches a course can distinguish "this course
  // finished normally" from "this token was never valid," per the entry-
  // screens PDF's "closed is different from broken."
  const { data: closeOut } = course
    ? await admin.from("course_close_outs").select("status").eq("course_id", course.id).maybeSingle()
    : { data: null };

  if (course && closeOut?.status === "wiped") {
    const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", course.center_id).maybeSingle();
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="sheet-gold w-full max-w-sm p-8">
          <Wordmark size="hero" />
          <h1 className="mt-4 font-serif text-xl text-ink">The course has closed</h1>
          <p className="mt-2 text-sm text-muted">
            {course.name} at {center?.name ?? "your centre"} has finished, and the course material was returned to the
            centre -- your workspace is no longer available.
          </p>
          {/* admissions_email is the only centre address we hold (migration 0084)
              and it's nullable, so the button can't be the only way out of this
              screen -- without a fallback line a closed course is a dead end. */}
          {center?.admissions_email ? (
            <a
              href={`mailto:${center.admissions_email}`}
              className="mt-4 inline-block rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card hover:bg-ink-warm/90"
            >
              Email {center.name}
            </a>
          ) : (
            <p className="mt-4 text-xs text-muted">
              If you need a copy of your records, contact {center?.name ?? "your centre"} directly.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="sheet-gold w-full max-w-sm p-8">
          <Wordmark size="hero" />
          <p className="mt-4 text-sm text-destructive">
            This join link is invalid or has expired. Ask your centre admin for a new one.
          </p>
        </div>
      </div>
    );
  }

  const role: UserRole = course.trainee_join_token === token ? "trainee" : "trainer";
  const { data: center } = await admin.from("centers").select("is_uk_centre").eq("id", course.center_id).maybeSingle();

  return (
    <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="sheet-gold w-full max-w-sm p-8">
        <Wordmark size="hero" />
        <p className="mt-1 text-sm text-muted">
          You&apos;re joining {course.name} as a <span className="capitalize">{role}</span>. Your workspace opens as
          soon as you accept.
        </p>
        <JoinForm token={token} role={role} isUkCentre={center?.is_uk_centre ?? false} />
      </div>
    </div>
  );
}

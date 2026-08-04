import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "@/app/join/[token]/join-form";
import { Wordmark } from "@/components/wordmark";
import type { UserRole } from "@/lib/supabase/types";

// Unified with /login and every tokenized-link gate onto one entry-moment
// look (sheet-accent + the real Wordmark) rather than this page's own
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
    .select("id, name, trainee_join_token, trainer_join_token")
    .or(`trainee_join_token.eq.${token},trainer_join_token.eq.${token}`)
    .maybeSingle();

  if (!course) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="sheet-accent w-full max-w-sm p-8">
          <Wordmark size="lg" />
          <p className="mt-4 text-sm text-destructive">
            This join link is invalid or has expired. Ask your center admin for a new one.
          </p>
        </div>
      </div>
    );
  }

  const role: UserRole = course.trainee_join_token === token ? "trainee" : "trainer";

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="sheet-accent w-full max-w-sm p-8">
        <Wordmark size="lg" />
        <p className="mt-1 text-sm text-muted">
          You&apos;re joining {course.name} as a <span className="capitalize">{role}</span>.
        </p>
        <JoinForm token={token} />
      </div>
    </div>
  );
}

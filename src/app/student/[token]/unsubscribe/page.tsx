import Link from "next/link";
import { DemoDayTag } from "@/components/demo-day-tag";
import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import { UnsubscribeButton } from "@/app/student/[token]/unsubscribe/unsubscribe-button";
import { EntryNotice } from "@/components/entry-notice";

// Ramy, 25 Aug 2026: "if they don't wanna be notified in the email, they
// can just disable it in the email itself" -- a landing page rather than a
// bare one-click GET, so a corporate email scanner prefetching the link
// can't silently opt someone out. Same expired-link shell as the main
// volunteer page.
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("volunteer_student_id, expires_at, course_id")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken?.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return <EntryNotice heading="This link has expired">Ask your teacher for a new one.</EntryNotice>;
  }

  const { data: volunteer } = await admin
    .from("volunteer_students")
    .select("name, reminders_opted_out")
    .eq("id", accessToken.volunteer_student_id)
    .maybeSingle();
  const optedOut = volunteer?.reminders_opted_out ?? false;

  return (
    <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="frame w-full max-w-sm p-3">
        {/* No teal primary on this screen -- the one control is an outlined
            toggle -- so the rule is gold (Ramy, 26 Aug 2026). */}
        <div className="sheet-entry sheet-entry-gold p-8 text-center">
          <div className="flex justify-end">
            <DemoDayTag courseId={accessToken.course_id} />
          </div>
          <Link href="/" className="inline-block hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
          <h1 className="mt-5 font-serif text-h3 text-ink">{optedOut ? "Turn reminder emails back on?" : "Stop class reminder emails?"}</h1>
          <p className="mt-2 text-body text-muted">
            {optedOut
              ? `${volunteer?.name ? `${volunteer.name}, y` : "Y"}ou'll get the day-before and 30-minute reminder emails again for classes you haven't declined.`
              : `${volunteer?.name ? `${volunteer.name}, y` : "Y"}ou'll stop getting the day-before and 30-minute reminder emails. You can still open your class link any time, and you'll still see everything on your own page.`}
          </p>
          <UnsubscribeButton token={token} initiallyOptedOut={optedOut} />
        </div>
      </div>
    </div>
  );
}

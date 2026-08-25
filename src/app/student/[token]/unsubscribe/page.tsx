import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import { UnsubscribeButton } from "@/app/student/[token]/unsubscribe/unsubscribe-button";

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
    .select("volunteer_student_id, expires_at")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken?.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
          <div className="sheet-accent p-8 text-center">
            <Wordmark size="hero" />
            <p className="mt-4 text-sm text-destructive">This link has expired or isn&apos;t valid. Ask your teacher for a new one.</p>
          </div>
        </div>
      </div>
    );
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
        <div className="sheet-accent p-8 text-center">
          <Wordmark size="hero" />
          <h1 className="mt-5 font-serif text-lg text-ink">{optedOut ? "Turn reminder emails back on?" : "Stop class reminder emails?"}</h1>
          <p className="mt-2 text-sm text-muted">
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

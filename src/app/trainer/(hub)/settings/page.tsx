import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getFeedbackAssistState } from "@/lib/feedback-assist";
import { FeedbackAssistCard } from "@/app/trainer/(hub)/feedback-assist-card";

// A tutor's own feedback wording. Feedback assist moved here off Today,
// 5 Sep 2026 -- it is a preference, not a task, and the landing page is for
// tasks.
//
// Reached from the Teaching Practice tab since 6 Sep 2026, not from a
// "Settings" link beside your name. Ramy: the page holds one thing, so it
// should say so, and the door belongs next to the feedback it shapes. The
// route keeps its /settings path -- renaming the URL would break links for
// no gain -- but nothing on screen calls it settings any more.
export default async function TrainerSettingsPage() {
  const session = await getCurrentProfile();
  const trainer =
    session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner"
      ? session.profile
      : null;
  if (!trainer) redirect("/login");
  const courseId = trainer.course_id;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  // design_handoff_feedback_assist (2026-08-17): a trainer's own tool, not
  // a course-admin one -- "whoever runs course admin may not be the person
  // writing feedback" -- so an admin previewing the hub gets no card.
  const feedbackAssist = trainer.role === "trainer" ? await getFeedbackAssistState(courseId, trainer.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">{trainer.full_name ?? "Trainer"} &middot; This course</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">Feedback wording</h1>
        <p className="max-w-[62ch] text-sm text-muted">
          How your written feedback is phrased when Connect drafts it for you. Yours alone for this course &mdash; it changes nothing
          that candidates or other tutors see, and never what you actually say.
        </p>
      </div>

      {feedbackAssist ? (
        <FeedbackAssistCard
          initialEnabled={feedbackAssist.enabled}
          initialDirect={feedbackAssist.direct}
          initialSupportive={feedbackAssist.supportive}
        />
      ) : (
        <p className="rounded-[14px] border border-border bg-card px-[22px] py-5 text-sm text-muted">
          Feedback assist is a tutor&apos;s own tool and only appears when you are signed in as one.
        </p>
      )}

    </div>
  );
}

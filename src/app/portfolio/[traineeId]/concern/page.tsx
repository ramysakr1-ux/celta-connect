import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ConcernForm } from "@/app/portfolio/[traineeId]/concern/concern-form";

const ESCALATION = [
  { step: "1", text: "The centre replies to every concern. If it is not resolved, ask for it to be reviewed by someone outside the teaching team -- the centre must offer that." },
  { step: "2", text: "If you are still not satisfied after the centre's procedure, you can contact the Cambridge Helpdesk." },
  { step: "3", text: "Concerns about a result are different, and go through the Cambridge appeals procedure after results are issued." },
];

// Enrolment Forms.dc.html 1c, "Raising a concern -- the internal complaints
// route". CELTA is short and intensive, so this stays reachable at any
// point, not just at enrolment -- a quiet footer link from Today, not a
// nav tab (the trainee nav's 6 tabs are a deliberately fixed list).
export default async function RaiseConcernPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/portfolio/${traineeId}`} label={"Course stream"} />

      <div className="sheet flex flex-col gap-4">
        <div>
          <h1 className="font-serif text-xl text-ink">Raise a concern</h1>
          <p className="mt-1 text-sm text-muted">
            CELTA is short and intensive, so a problem left for a week is a problem that has already affected your
            course. Say it early.
          </p>
        </div>

        <ConcernForm traineeId={traineeId} />

        <div className="flex flex-col gap-2 border-t border-border-faint pt-3">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">If you are still not satisfied</p>
          {ESCALATION.map((e) => (
            <div key={e.step} className="flex items-start gap-2.5">
              <span className="w-4 shrink-0 text-xs font-bold text-muted">{e.step}</span>
              <p className="text-xs leading-relaxed text-ink">{e.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

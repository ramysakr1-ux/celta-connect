import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { GenerateReplyButton } from "@/app/trainer/(hub)/grade-query-reply/[traineeId]/generate-reply-button";

// build-spec.md "Grade query -- the reply before an appeal". Entry point:
// one candidate's history of generated/filed grade-query replies, plus the
// button that starts a new one. A trainer lands here from the candidate's
// CELTA5 record page.
export default async function GradeQueryReplyListPage({
  params,
}: {
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, full_name, course_id, role")
    .eq("id", traineeId)
    .maybeSingle();

  if (!trainee || trainee.course_id !== trainer.course_id || trainee.role !== "trainee") {
    notFound();
  }

  const { data: replies } = await supabase
    .from("grade_query_replies")
    .select("id, generated_at, filed_at")
    .eq("trainee_id", traineeId)
    .order("generated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/dashboard/trainer/trainees/${traineeId}/celta5`} label={`${trainee.full_name}\u2019s CELTA 5 record`} />

      <div className="sheet flex flex-col gap-2 p-6">
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Roster</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">Grade query reply -- {trainee.full_name}</h1>
        <p className="text-sm text-muted">
          Generated but never sent automatically. Draws entirely from the record -- grade descriptors, TP
          outcomes, criteria met, assignment rounds, tutorial dates, and the provisional slash justification if
          there is one. A trainer edits and files it; it quotes the record rather than re-arguing the grade.
        </p>
        <div className="mt-2">
          <GenerateReplyButton traineeId={traineeId} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-ink">Filed with this course</h2>
        {replies && replies.length > 0 ? (
          <div className="sheet flex flex-col divide-y divide-border p-0">
            {replies.map((r) => (
              <Link
                key={r.id}
                href={`/trainer/grade-query-reply/${traineeId}/${r.id}`}
                className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-accent/40"
              >
                <span className="text-sm text-ink">
                  Generated {new Date(r.generated_at).toLocaleString()}
                </span>
                <span className={`pill ${r.filed_at ? "pill-success" : "pill-neutral"}`}>
                  {r.filed_at ? `Filed ${new Date(r.filed_at).toLocaleDateString()}` : "Draft -- not filed"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="sheet p-6 text-sm text-muted">No grade query reply has been generated yet.</p>
        )}
      </div>
    </div>
  );
}

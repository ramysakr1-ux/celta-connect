import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";

// Handbook 12.2: "completed selection tasks and interview notes/record sheets
// of both accepted and rejected candidates must be available to assessors."
// 14.1 names it the "Application task", and adds that assessors "will also
// need to check the applications of any candidates who have withdrawn".
//
// The admissions screens hold all of this already, but they gate on
// requireAdmissionsHandler, so an assessor bounces off them. This is the
// read-only view of the same rows, scoped to one candidate and reachable from
// their portfolio -- Ramy, 30 Aug 2026: "we should have the pre-course task,
// and then we'll have the application form."
//
// Deliberately narrow. 12.2 also says centres "must limit the amount of
// candidate personal information shared with Cambridge English... The only
// personal information required is candidate names", so date of birth, phone
// and email are fetched by nobody here even though the row carries them.

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";
const FAINT = "oklch(63% 0.012 82)";

const MARKING_ROWS = [
  ["Language awareness", "marking_language_awareness", "marking_language_awareness_note"],
  ["Accuracy", "marking_accuracy", "marking_accuracy_note"],
  ["Organisation", "marking_organisation", "marking_organisation_note"],
  ["Range", "marking_range", "marking_range_note"],
  ["Substance", "marking_substance", "marking_substance_note"],
] as const;

const BAND_LABEL: Record<string, string> = { above: "Above standard", at: "At standard", below: "Below standard" };

export default async function CandidateApplicationPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;

  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin" || viewer?.role === "platform_owner";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!isStaff && !assessorCourseId) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const admin = createAdminClient();

  const { data: trainee } = await supabase.from("profiles").select("full_name, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  // applicants.resulting_trainee_id is the link back from an enrolled
  // candidate to the application they were accepted from (migration 0085).
  const { data: applicant } = await admin
    .from("applicants")
    .select("*")
    .eq("resulting_trainee_id", traineeId)
    .maybeSingle();

  const { data: interview } = applicant
    ? await admin.from("interview_records").select("*").eq("applicant_id", applicant.id).maybeSingle()
    : { data: null };

  if (!applicant) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-2xl text-ink">{trainee.full_name}&apos;s application</h1>
        <div className="card p-5 text-sm text-muted">
          No application is on file for this candidate in Connect. That is normal for anyone enrolled before the centre
          started taking applications through the platform &mdash; the centre keeps those records itself, and Handbook
          &sect;12.2 requires them to be available to you on request.
        </div>
      </div>
    );
  }

  const languageAwareness = Array.isArray(applicant.language_awareness_submission)
    ? (applicant.language_awareness_submission as { question?: string; answer?: string }[])
    : [];
  const fixedQuestions = Array.isArray(interview?.fixed_questions)
    ? (interview.fixed_questions as { question_text?: string; answer_text?: string }[])
    : [];
  const drawnQuestions = Array.isArray(interview?.drawn_questions)
    ? (interview.drawn_questions as { question_text?: string; answer_text?: string; drawn_reason?: string }[])
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">{trainee.full_name}&apos;s application</h1>
        <p className="mt-1 text-sm text-muted">
          The selection task and interview record this candidate was accepted on &mdash; Handbook &sect;12.2. Only their
          name is shown; the centre holds the rest.
        </p>
      </div>

      <Section title="What they told us">
        <Field label="Education" value={applicant.education_summary} />
        <Field label="ELT experience" value={applicant.elt_experience_summary} />
        <Field label="Special requirements declared" value={applicant.special_requirements} empty="None declared" />
        <Field label="Anything that would stop them attending in full" value={applicant.cannot_attend_note} empty="Nothing declared" />
        <Field label="Anything else" value={applicant.anything_else} empty="Nothing added" />
      </Section>

      <Section title="Selection task — extended writing">
        <Field label="Their answer" value={applicant.writing_task_submission} empty="Not submitted" />
      </Section>

      {languageAwareness.length > 0 ? (
        <Section title="Selection task — language awareness">
          {languageAwareness.map((item, i) => (
            <div key={i}>
              <p className="text-[12.5px] font-semibold text-ink">{item.question ?? `Item ${i + 1}`}</p>
              <p className="mt-0.5 text-[12.5px] whitespace-pre-line text-muted">{item.answer || "No answer given"}</p>
            </div>
          ))}
        </Section>
      ) : null}

      <Section
        title="How the centre marked it"
        caption={
          applicant.marked_at
            ? `Marked ${new Date(applicant.marked_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
            : "Not marked in Connect."
        }
      >
        {MARKING_ROWS.map(([label, bandKey, noteKey]) => {
          const band = applicant[bandKey] as string | null;
          const note = applicant[noteKey] as string | null;
          if (!band && !note) return null;
          return (
            <div key={label} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12.5px] font-semibold text-ink">{label}</p>
                <p className="shrink-0 text-[11.5px] font-semibold" style={{ color: MUTED }}>
                  {band ? (BAND_LABEL[band] ?? band) : "—"}
                </p>
              </div>
              {note ? <p className="text-[12px] whitespace-pre-line text-muted">{note}</p> : null}
            </div>
          );
        })}
      </Section>

      <Section
        title="Interview record"
        caption={
          interview
            ? interview.interviewer_signed_at
              ? `Signed by ${interview.interviewer_signature_name ?? "the interviewer"} and the applicant.`
              : "Recorded, not signed."
            : "No interview record on file."
        }
      >
        {[...fixedQuestions, ...drawnQuestions].map((q: { question_text?: string; answer_text?: string; drawn_reason?: string }, i) => (
          <div key={i}>
            <p className="text-[12.5px] font-semibold text-ink">{q.question_text ?? `Question ${i + 1}`}</p>
            <p className="mt-0.5 text-[12.5px] whitespace-pre-line text-muted">{q.answer_text || "No answer recorded"}</p>
            {q.drawn_reason ? (
              <p className="mt-0.5 text-[11px]" style={{ color: FAINT }}>
                Asked because: {q.drawn_reason}
              </p>
            ) : null}
          </div>
        ))}
        {interview?.overall_notes ? <Field label="Interviewer's overall notes" value={interview.overall_notes} /> : null}
      </Section>

      <p className="text-xs text-muted">
        Read-only. Handbook &sect;12.2 also requires the selection tasks of <em>rejected</em> applicants to be available
        to you &mdash; those are in the centre documents panel of the pack, not here, since they belong to no candidate
        portfolio.
      </p>
    </div>
  );
}

function Section({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div>
        <p className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: MUTED }}>
          {title}
        </p>
        {caption ? (
          <p className="mt-0.5 text-[11.5px]" style={{ color: FAINT }}>
            {caption}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, empty }: { label: string; value: string | null; empty?: string }) {
  if (!value && !empty) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-0.5 text-[12.5px] whitespace-pre-line" style={{ color: value ? INK : FAINT }}>
        {value || empty}
      </p>
    </div>
  );
}

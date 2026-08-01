import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS } from "@/lib/celta-criteria";
import { CriteriaRatingPill, StandardRatingPill } from "@/lib/status-pill";
import { SelfAssessmentForm } from "@/app/dashboard/trainee/celta5/self-assessment-form";
import { ObservationForm } from "@/app/dashboard/trainee/celta5/observation-form";

export default async function TraineeCelta5Page() {
  const profile = await requireRole("trainee");
  const supabase = await createClient();

  const [{ data: record }, { data: matrix }, { data: observations }] = await Promise.all([
    supabase.rpc("get_my_celta5_record"),
    supabase.rpc("get_my_celta5_matrix"),
    supabase.from("observations").select("*").eq("trainee_id", profile.id).order("observation_date"),
  ]);

  if (!record) {
    return (
      <div className="card p-6">
        <p className="text-muted">No CELTA 5 record found yet. Check with your trainer.</p>
      </div>
    );
  }

  const byCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m]));
  const stage2Submitted = !!record.stage2_candidate_submitted_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">CELTA 5 record</h1>
        <p className="mt-2 text-muted">
          Your Cambridge CELTA progress, criteria assessment, and portfolio records.
        </p>
      </div>

      {record.stage1_strengths || record.stage1_action_plan ? (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Stage One</h2>
          {record.stage1_strengths ? (
            <div className="mt-2">
              <p className="text-sm text-muted">Strengths</p>
              <p className="text-ink">{record.stage1_strengths}</p>
            </div>
          ) : null}
          {record.stage1_action_plan ? (
            <div className="mt-2">
              <p className="text-sm text-muted">Action plan</p>
              <p className="text-ink">{record.stage1_action_plan}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="font-serif text-lg text-ink">Stage Two</h2>
        {!stage2Submitted ? (
          <div className="mt-3">
            <SelfAssessmentForm />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <div className="card p-6">
              <p className="text-sm text-muted">
                Submitted {new Date(record.stage2_candidate_submitted_at!).toLocaleString()}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted">Your overall assessment</p>
                  <StandardRatingPill rating={record.stage2_candidate_overall} />
                </div>
                <div>
                  <p className="text-sm text-muted">Tutor&apos;s overall assessment</p>
                  <StandardRatingPill rating={record.stage2_tutor_overall} />
                </div>
              </div>
              {record.stage2_tutor_notes ? (
                <div className="mt-4">
                  <p className="text-sm text-muted">Tutor&apos;s summary and action points</p>
                  <p className="text-ink">{record.stage2_tutor_notes}</p>
                </div>
              ) : null}
            </div>

            {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
              <div key={section} className="card p-6">
                <h3 className="font-serif text-ink">
                  Topic {section} -- {title}
                </h3>
                <div className="mt-3 flex flex-col gap-3">
                  {codes.map((code) => {
                    const row = byCode.get(code);
                    return (
                      <div key={code} className="border-b border-border pb-3 last:border-none">
                        <p className="text-sm text-ink">
                          {code}
                          {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                        </p>
                        <div className="mt-1 flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted">You:</span>
                            <CriteriaRatingPill rating={row?.candidate_status ?? null} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted">Tutor:</span>
                            <CriteriaRatingPill rating={row?.tutor_status_stage2 ?? null} />
                          </div>
                        </div>
                        {row?.tutor_comments_stage2 ? (
                          <p className="mt-1 text-sm text-muted">{row.tutor_comments_stage2}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {record.stage3_required ? (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Stage Three</h2>
          {record.stage3_finalized_at ? (
            <>
              <div className="mt-3">
                <p className="text-sm text-muted">Tutor&apos;s overall assessment</p>
                <StandardRatingPill rating={record.stage3_tutor_overall} />
              </div>
              {record.stage3_tutor_notes ? (
                <div className="mt-3">
                  <p className="text-sm text-muted">Summary and action points</p>
                  <p className="text-ink">{record.stage3_tutor_notes}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-muted">
              Your tutor is completing your Stage Three review.
            </p>
          )}
        </div>
      ) : null}

      {record.final_recommended_grade ? (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Final recommended grade</h2>
          <p className="mt-1 font-serif text-2xl text-ink">{record.final_recommended_grade}</p>
          <p className="mt-2 text-sm text-muted">
            Subject to confirmation by Cambridge Assessment English.
          </p>
          {record.overall_notes ? (
            <p className="mt-3 text-ink">{record.overall_notes}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="font-serif text-lg text-ink">
          Observations of experienced teachers
        </h2>
        <p className="mt-1 text-sm text-muted">
          Log the 6 hours you spend observing experienced teachers (up to 3 filmed).
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {observations?.map((o) => (
            <ObservationForm key={`${o.id}-${o.updated_at}`} observation={o} />
          ))}
          <ObservationForm />
        </div>
      </div>
    </div>
  );
}

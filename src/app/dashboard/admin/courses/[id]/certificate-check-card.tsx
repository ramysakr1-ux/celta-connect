"use client";

import { useActionState } from "react";
import { recordCertificateGrade, type FormState } from "@/app/dashboard/admin/courses/[id]/close-out-actions";

const initialState: FormState = { error: null };
const GRADES = ["Pass", "Pass B", "Pass A", "Fail"] as const;

export interface CertificateCandidate {
  traineeId: string;
  fullName: string;
  recommendedGrade: string | null;
  certificateGrade: string | null;
}

function CertificateRow({ courseId, candidate }: { courseId: string; candidate: CertificateCandidate }) {
  const [state, action, pending] = useActionState(recordCertificateGrade, initialState);
  const mismatch = Boolean(
    candidate.certificateGrade && candidate.recommendedGrade && candidate.certificateGrade !== candidate.recommendedGrade
  );

  return (
    <div className={`admin-hover flex flex-col gap-2 rounded-[6px] border p-3 ${mismatch ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{candidate.fullName}</p>
          <p className="text-xs text-muted">Recommended: {candidate.recommendedGrade ?? "not yet set"}</p>
        </div>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="trainee_id" value={candidate.traineeId} />
          <select
            name="certificate_grade"
            defaultValue={candidate.certificateGrade ?? ""}
            className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Not received yet</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="admin-hover-fill rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
      {mismatch ? (
        <p className="text-sm font-semibold text-destructive">
          Certificate says {candidate.certificateGrade}, recommended was {candidate.recommendedGrade} -- contact Cambridge immediately.
        </p>
      ) : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}

// build-spec.md compliance-audit item 10 (Handbook 11.5): "Certificates
// checked against the recommended grades on arrival; Cambridge contacted
// immediately on an error." Only candidates with a final recommended grade
// are shown -- nothing to check a certificate against otherwise.
export function CertificateCheckCard({ courseId, candidates }: { courseId: string; candidates: CertificateCandidate[] }) {
  if (candidates.length === 0) return null;

  return (
    <div className="card flex flex-col gap-3 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Certificate check</h2>
        <p className="mt-1 text-sm text-muted">
          Record each candidate&apos;s grade as printed on their arrived certificate. A mismatch against the
          recommended grade is flagged immediately here.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {candidates.map((c) => (
          <CertificateRow key={c.traineeId} courseId={courseId} candidate={c} />
        ))}
      </div>
    </div>
  );
}

import { holdAutoSentInterview } from "@/app/dashboard/admissions/actions";
import type { SelectionTaskReading, SelectionTaskRowKey } from "@/lib/openai/read-selection-task";

const ROW_LABELS: Record<SelectionTaskRowKey, string> = {
  language_awareness: "Language awareness",
  accuracy: "Accuracy",
  organisation: "Organisation",
  range: "Range",
  substance: "Substance",
};
const ROW_KEYS: SelectionTaskRowKey[] = ["language_awareness", "accuracy", "organisation", "range", "substance"];

const LEVEL_LABEL: Record<string, string> = { above: "Above standard", at: "At standard", below: "Below standard" };

const LANE_COPY: Record<string, { label: string; note: string }> = {
  clear: { label: "Clear on every criterion", note: "Worth interviewing." },
  borderline: { label: "Mixed / borderline", note: "Queued for a human -- nothing sent." },
  clear_problems: { label: "Clear problems", note: "Flagged for a tutor to read directly -- nothing sent." },
};

function isReading(value: unknown): value is SelectionTaskReading {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return ROW_KEYS.every((k) => v[k] && typeof v[k] === "object") && typeof v.summary === "string";
}

// specs/for-claude-code-email-inventory.md Part 1, plus marking-form.tsx's
// own precedent for showing an AI reading: "labelled as a suggestion,
// visually distinct from anything a person wrote... never pre-filled into
// [the tutor's own marks]." This panel is read-only next to the marking
// form below it -- the tutor's own select dropdowns are untouched by it.
export function AiReadingPanel({
  applicant,
}: {
  applicant: {
    id: string;
    ai_reading_summary: unknown;
    ai_reading_generated_at: string | null;
    ai_reading_lane: string | null;
    interview_auto_send_at: string | null;
    interview_auto_send_cancelled_at: string | null;
    interview_auto_send_sent_at: string | null;
  };
}) {
  if (!applicant.ai_reading_generated_at || !isReading(applicant.ai_reading_summary)) return null;
  const reading = applicant.ai_reading_summary;
  const lane = applicant.ai_reading_lane ? LANE_COPY[applicant.ai_reading_lane] : null;

  const holdPending =
    applicant.ai_reading_lane === "clear" &&
    applicant.interview_auto_send_at &&
    !applicant.interview_auto_send_cancelled_at &&
    !applicant.interview_auto_send_sent_at;

  return (
    <div className="card flex flex-col gap-3 border-dashed p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">AI reading -- suggested, not sent</p>
        {lane ? (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-ink">{lane.label}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {ROW_KEYS.map((key) => {
          const row = reading[key];
          return (
            <div key={key} className="flex items-start justify-between gap-3 border-b border-border-faint pb-2 last:border-none">
              <span className="text-sm text-ink">{ROW_LABELS[key]}</span>
              <div className="text-right">
                <span className="text-sm text-muted">{LEVEL_LABEL[row.level]}</span>
                {row.note ? <p className="mt-0.5 max-w-sm text-xs text-muted">{row.note}</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-ink">{reading.summary}</p>
      {lane ? <p className="text-xs text-muted">{lane.note}</p> : null}

      {holdPending ? (
        <form action={holdAutoSentInterview} className="flex items-center gap-2 border-t border-border-faint pt-3">
          <input type="hidden" name="applicant_id" value={applicant.id} />
          <p className="flex-1 text-xs text-muted">
            An interview will be booked automatically -- held until{" "}
            {new Date(applicant.interview_auto_send_at!).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
          </p>
          <button type="submit" className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary admin-hover-fill">
            Hold
          </button>
        </form>
      ) : null}
      {applicant.interview_auto_send_cancelled_at ? (
        <p className="border-t border-border-faint pt-3 text-xs text-muted">Held -- book an interview by hand below when ready.</p>
      ) : null}
    </div>
  );
}

import { ANALYSIS_SHEETS } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpLanguageAnalysis = Database["public"]["Tables"]["tp_language_analyses"]["Row"];

// A submitted language analysis, shown in full.
//
// Ramy, 13 Sep 2026, clicking into a lesson after the analyses were written:
// "I'm clicking on Kofi and there's nothing there." There was — the sheet was
// on the page, showing the structure's NAME and its MEANING and nothing else.
// Four places rendered it that way: the tutor's TP page, the candidate's own
// portfolio view, the plan review and the assembled document. So the marker
// sentences, the clarification technique with its concept questions, the form
// analysis, the phonemic transcription, the pronunciation features and every
// problem-and-solution pair were invisible everywhere except the editor the
// candidate typed them into.
//
// That is most of criterion 4i, and all of what a tutor is meant to assess.
// One component now, so it cannot drift apart again.

export function LanguageAnalysisReadOnly({
  analysis,
  compact = false,
}: {
  analysis: TpLanguageAnalysis;
  /** Tighter type for a side panel; the content is identical. */
  compact?: boolean;
}) {
  const isVocab = analysis.type === "vocab";
  const sheet = analysis.type === "grammar" || analysis.type === "function" ? ANALYSIS_SHEETS[analysis.type] : null;
  const body = compact ? "text-[13px]" : "text-sm";

  if (isVocab) {
    const rows = analysis.vocab_rows ?? [];
    if (rows.length === 0) return null;
    return (
      <div className="flex flex-col gap-3">
        {analysis.context ? <p className={`${body} text-ink`}>{analysis.context}</p> : null}
        <div className="overflow-x-auto rounded-[8px] border border-border-faint">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-card">
                {["Vocab item", "Definition", "How they'll convey it", "Clarification", "Form", "Problems & solutions"].map(
                  (h) => (
                    <th key={h} className="border-b border-border-faint p-2 text-left text-[11.5px] font-semibold text-ink-warm">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 ? "bg-background" : undefined}>
                  {(["item", "definition", "convey", "clarification", "form", "problems"] as const).map((k, ci) => (
                    <td
                      key={k}
                      className={`border-b border-border-faint p-2 align-top whitespace-pre-line ${
                        ci === 0 ? "font-medium text-ink" : "text-ink-warm"
                      }`}
                    >
                      {row[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {analysis.vocab_reference ? (
          <p className="text-xs text-muted">
            <span className="font-semibold">Reference:</span> {analysis.vocab_reference}
          </p>
        ) : null}
      </div>
    );
  }

  const blocks = analysis.blocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {analysis.context ? <p className={`${body} text-ink`}>{analysis.context}</p> : null}
      {blocks.map((block, i) => (
        <div key={i} className="rounded-[8px] border border-border-faint p-4">
          <h3 className="font-serif text-ink">
            {sheet?.blockName ?? "Structure"} {i + 1}
            {block.item ? ` · ${block.item}` : ""}
          </h3>
          <div className="mt-2 flex flex-col gap-2.5">
            {(sheet?.fields ?? []).map((field) => {
              if (field.key === "item") return null;
              const value = block[field.key];

              if (field.type === "pairs") {
                const pairs = (value as { problem: string; solution: string }[] | undefined) ?? [];
                const real = pairs.filter((p) => p?.problem || p?.solution);
                if (real.length === 0) return null;
                return (
                  <div key={String(field.key)}>
                    <p className="text-[11.5px] font-semibold text-muted">{field.label}</p>
                    <ul className="mt-0.5 flex flex-col gap-1">
                      {real.map((pair, pi) => (
                        <li key={pi} className="text-[13px] text-ink">
                          {pair.problem} <span className="text-primary">→</span>{" "}
                          <span className="text-ink-warm">{pair.solution}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              const text = ((value as string | undefined) ?? "").trim();
              if (!text) return null;
              return (
                <div key={String(field.key)}>
                  <p className="text-[11.5px] font-semibold text-muted">{field.label}</p>
                  <p className="text-[13px] whitespace-pre-line text-ink">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

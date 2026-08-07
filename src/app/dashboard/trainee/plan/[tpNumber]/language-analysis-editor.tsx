"use client";

import {
  ANALYSIS_SHEETS,
  emptyAnalysisBlock,
  emptyVocabRow,
  type AnalysisBlock,
  type LanguageAnalysisType,
  type VocabRow,
} from "@/lib/tp-plan-content";
import { VoiceTextarea } from "@/components/voice-textarea";
import { bulletListProps } from "@/lib/bullet-list";
import { PhonemicPopup } from "@/components/phonemic-popup";
import { CustomSelect } from "@/components/custom-select";

const inputClass =
  "w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

export function LanguageAnalysisEditor({
  open,
  onToggle,
  type,
  onTypeChange,
  isMainAim,
  onMainAimChange,
  context,
  onContextChange,
  blocks,
  onBlocksChange,
  vocabRows,
  onVocabRowsChange,
  vocabReference,
  onVocabReferenceChange,
  locked,
}: {
  open: boolean;
  onToggle: () => void;
  type: LanguageAnalysisType;
  onTypeChange: (type: LanguageAnalysisType) => void;
  isMainAim: boolean;
  onMainAimChange: (value: boolean) => void;
  context: string;
  onContextChange: (value: string) => void;
  blocks: AnalysisBlock[];
  onBlocksChange: (blocks: AnalysisBlock[]) => void;
  vocabRows: VocabRow[];
  onVocabRowsChange: (rows: VocabRow[]) => void;
  vocabReference: string;
  onVocabReferenceChange: (value: string) => void;
  locked: boolean;
}) {
  const isVocab = type === "vocab";
  const sheet = !isVocab ? ANALYSIS_SHEETS[type] : null;

  function updateBlock(index: number, patch: Partial<AnalysisBlock>) {
    onBlocksChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  return (
    <div className="card p-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="font-serif text-lg text-ink">Language Analysis</h2>
        <span className="text-sm text-primary">{open ? "▾ Hide" : "▸ Optional -- click to add"}</span>
      </button>

      {open ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted">What are you analysing?</label>
              <div className="inline-flex w-fit rounded-[6px] border border-border p-0.5">
                {([
                  { value: "grammar", label: "Grammar" },
                  { value: "vocab", label: "Vocabulary" },
                  { value: "function", label: "Functional language" },
                ] as { value: LanguageAnalysisType; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={locked}
                    onClick={() => onTypeChange(opt.value)}
                    className={`rounded-[4px] px-3 py-1.5 text-sm font-medium transition-colors ${
                      type === opt.value ? "bg-primary text-card" : "text-muted hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-ink">
              <span>
                Is {type === "vocab" ? "vocabulary" : type === "function" ? "functional language" : "grammar"} the
                main aim of your lesson?
              </span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={isMainAim}
                  disabled={locked}
                  onChange={() => onMainAimChange(true)}
                />
                Yes
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={!isMainAim}
                  disabled={locked}
                  onChange={() => onMainAimChange(false)}
                />
                No
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Overall context of the lesson</label>
            <input
              type="text"
              value={context}
              disabled={locked}
              onChange={(e) => onContextChange(e.target.value)}
              placeholder="e.g. Talking about life changes -- a blog post about moving abroad"
              className={inputClass}
            />
          </div>

          {isVocab ? (
            <div className="flex flex-col gap-3">
              <VocabTable rows={vocabRows} onChange={onVocabRowsChange} locked={locked} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-muted">Reference material</label>
                <p className="text-xs italic text-muted">
                  Which dictionary or reference you used -- Cambridge, Oxford Learner&apos;s, Longman.
                </p>
                <textarea
                  rows={2}
                  value={vocabReference}
                  disabled={locked}
                  onChange={(e) => onVocabReferenceChange(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">{sheet!.guide}</p>
              {blocks.map((block, i) => (
                <div key={i} className="rounded-[6px] border border-border-faint p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-serif text-ink">
                      {sheet!.blockName} {i + 1}
                    </h3>
                    {!locked ? (
                      <button
                        type="button"
                        onClick={() => onBlocksChange(blocks.filter((_, bi) => bi !== i))}
                        className="text-sm text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {sheet!.fields.map((field) => {
                    const key = field.key;
                    if (field.type === "pairs") {
                      const pairs = (block[key] as { problem: string; solution: string }[] | undefined) ?? [];
                      return (
                        <div
                          key={key}
                          className="grid grid-cols-1 gap-1.5 border-t border-border-faint py-3 first:border-t-0 first:pt-0 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-4"
                        >
                          <label className="text-sm text-muted">{field.label}</label>
                          <div className="flex flex-col gap-2">
                            {pairs.map((pair, pi) => (
                              <div key={pi} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <textarea
                                  rows={2}
                                  value={pair.problem}
                                  disabled={locked}
                                  onChange={(e) =>
                                    updateBlock(i, {
                                      [key]: pairs.map((p, x) => (x === pi ? { ...p, problem: e.target.value } : p)),
                                    } as Partial<AnalysisBlock>)
                                  }
                                  placeholder="Problem"
                                  className={inputClass}
                                  {...bulletListProps}
                                />
                                <textarea
                                  rows={2}
                                  value={pair.solution}
                                  disabled={locked}
                                  onChange={(e) =>
                                    updateBlock(i, {
                                      [key]: pairs.map((p, x) => (x === pi ? { ...p, solution: e.target.value } : p)),
                                    } as Partial<AnalysisBlock>)
                                  }
                                  placeholder="Solution"
                                  className={inputClass}
                                  {...bulletListProps}
                                />
                              </div>
                            ))}
                          </div>
                          {!locked ? (
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(i, {
                                  [key]: [...pairs, { problem: "", solution: "" }],
                                } as Partial<AnalysisBlock>)
                              }
                              className="mt-2 text-sm text-primary hover:underline"
                            >
                              + Add another problem
                            </button>
                          ) : null}
                        </div>
                      );
                    }

                    const value = (block[key] as string | undefined) ?? "";
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-1 gap-1 border-t border-border-faint py-3 first:border-t-0 first:pt-0 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-4"
                      >
                        <div>
                          <label className="text-sm text-muted">{field.label}</label>
                          {field.hint ? <p className="text-xs italic text-muted">{field.hint}</p> : null}
                        </div>
                        {field.type === "select" ? (
                          <CustomSelect
                            value={value}
                            disabled={locked}
                            onChange={(v) => updateBlock(i, { [key]: v } as Partial<AnalysisBlock>)}
                            options={(field.options ?? []).map((opt) => ({
                              value: opt,
                              label: opt || "— choose —",
                            }))}
                          />
                        ) : field.type === "input" ? (
                          <input
                            type="text"
                            value={value}
                            disabled={locked}
                            onChange={(e) => updateBlock(i, { [key]: e.target.value } as Partial<AnalysisBlock>)}
                            className={inputClass}
                          />
                        ) : field.type === "phon" ? (
                          <PhonemicPopup
                            value={value}
                            disabled={locked}
                            onChange={(v) => updateBlock(i, { [key]: v } as Partial<AnalysisBlock>)}
                            className={inputClass}
                          />
                        ) : (
                          <VoiceTextarea
                            rows={3}
                            value={value}
                            disabled={locked}
                            onChange={(e) => updateBlock(i, { [key]: e.target.value } as Partial<AnalysisBlock>)}
                            className={inputClass}
                            {...bulletListProps}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {!locked ? (
                <button
                  type="button"
                  onClick={() => onBlocksChange([...blocks, emptyAnalysisBlock()])}
                  className="self-start rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
                >
                  + Add another {sheet!.blockName.toLowerCase()}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function VocabTable({
  rows,
  onChange,
  locked,
}: {
  rows: VocabRow[];
  onChange: (rows: VocabRow[]) => void;
  locked: boolean;
}) {
  const columns: { key: keyof VocabRow; label: string; hint: string }[] = [
    { key: "item", label: "Vocab item", hint: "stress, phonemic transcription, part of speech" },
    { key: "definition", label: "Definition", hint: "level appropriate" },
    { key: "convey", label: "How will you convey the meaning?", hint: "situation, reading, picture, realia…" },
    { key: "clarification", label: "Clarification of meaning", hint: "visuals, CCQs + answers, examples" },
    { key: "form", label: "Form", hint: "countable? collocations, dependent prepositions" },
    { key: "problems", label: "Problems & solutions", hint: "meaning, form, pronunciation" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="border-b border-border-faint p-2 text-left text-xs text-muted">
                  {col.label}
                  <span className="block font-normal italic">{col.hint}</span>
                </th>
              ))}
              <th className="border-b border-border-faint p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) =>
                  col.key === "item" ? (
                    <td key={col.key} className="border-b border-border-faint p-1.5 align-top">
                      <PhonemicPopup
                        rows={3}
                        value={row[col.key]}
                        disabled={locked}
                        onChange={(v) => onChange(rows.map((r, x) => (x === i ? { ...r, [col.key]: v } : r)))}
                        className={inputClass}
                      />
                    </td>
                  ) : (
                    <td key={col.key} className="border-b border-border-faint p-1.5 align-top">
                      <textarea
                        rows={3}
                        value={row[col.key]}
                        disabled={locked}
                        onChange={(e) =>
                          onChange(rows.map((r, x) => (x === i ? { ...r, [col.key]: e.target.value } : r)))
                        }
                        className={inputClass}
                      />
                    </td>
                  )
                )}
                <td className="border-b border-border-faint p-1.5 align-top">
                  {!locked ? (
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter((_, x) => x !== i))}
                      className="text-destructive"
                      title="Remove"
                    >
                      ✕
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {!locked ? (
          <button
            type="button"
            onClick={() => onChange([...rows, emptyVocabRow()])}
            className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
          >
            + Add item
          </button>
        ) : null}
      </div>
    </div>
  );
}

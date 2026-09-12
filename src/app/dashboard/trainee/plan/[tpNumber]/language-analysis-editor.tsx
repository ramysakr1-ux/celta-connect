"use client";

import {
  ANALYSIS_SHEETS,
  emptyAnalysisBlock,
  emptyVocabRow,
  type AnalysisBlock,
  type LanguageAnalysisType,
  type VocabRow,
} from "@/lib/tp-plan-content";
import { bulletListProps } from "@/lib/bullet-list";
import { autosizeOnInput, useAutosize } from "@/lib/autosize";
import { PhonemicPopup } from "@/components/phonemic-popup";
import { CustomSelect } from "@/components/custom-select";

// design_handoff_trainee_lesson_plan §6, 13 Sep 2026. The analysis sheet no
// longer sits in a card of its own with a "click to add" header -- the door is
// in the plan's foot band now, and this unfolds below the sheet as the last
// band of the same document, sharing its radius and its ground.
//
// Fields, order and content are untouched: ANALYSIS_SHEETS still decides what
// a grammar, vocabulary or functional-language sheet asks for.

const SHEET = "oklch(99.2% 0.005 90)";
const TEAL = "var(--color-primary)";
const INK_WARM = "var(--color-ink-warm)";
const MUTED = "var(--color-muted)";
const FAINT = "var(--color-border-faint)";
const BORDER = "var(--color-border)";
const CARD = "var(--color-card)";
const INK = "var(--color-ink)";

const TYPES: { value: LanguageAnalysisType; label: string; noun: string }[] = [
  { value: "grammar", label: "Grammar", noun: "grammar" },
  { value: "vocab", label: "Vocabulary", noun: "vocabulary" },
  { value: "function", label: "Functional language", noun: "functional language" },
];

function boxedField(size = 13): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: SHEET,
    padding: "9px 12px",
    fontSize: size,
    lineHeight: 1.5,
    color: INK,
    outline: "none",
    resize: "none",
    overflowY: "hidden",
    minHeight: "1.5em",
  };
}

export function LanguageAnalysisEditor({
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
  open?: boolean;
  onToggle?: () => void;
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
  const autosize = useAutosize();
  const isVocab = type === "vocab";
  const sheet = !isVocab ? ANALYSIS_SHEETS[type] : null;
  const noun = TYPES.find((t) => t.value === type)!.noun;

  function updateBlock(index: number, patch: Partial<AnalysisBlock>) {
    onBlocksChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-b-[14px]"
      style={{ borderTop: `1px solid ${BORDER}`, background: SHEET, padding: "20px 26px 26px" }}
    >
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="font-serif" style={{ fontSize: 21, fontWeight: 600, color: INK_WARM }}>
          {isVocab ? "Vocabulary analysis" : type === "function" ? "Functional language analysis" : "Grammar analysis"}
        </h3>
        {sheet ? <p style={{ fontSize: 12, color: MUTED }}>{sheet.guide}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <div
          className="inline-flex rounded-full"
          style={{ border: `1px solid ${BORDER}`, background: CARD, padding: 3 }}
        >
          {TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={locked}
              onClick={() => onTypeChange(opt.value)}
              className="rounded-full transition-colors"
              style={{
                padding: "6px 15px",
                fontWeight: 600,
                fontSize: 12.5,
                background: type === opt.value ? TEAL : "transparent",
                color: type === opt.value ? "oklch(98.5% 0.006 90)" : MUTED,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3" style={{ fontSize: 12.5, color: INK }}>
          <span>Is {noun} the main aim of your lesson?</span>
          <Radio label="Yes" checked={isMainAim} disabled={locked} onSelect={() => onMainAimChange(true)} />
          <Radio label="No" checked={!isMainAim} disabled={locked} onSelect={() => onMainAimChange(false)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="uppercase" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: MUTED }}>
          Overall context of the lesson
        </label>
        <input
          type="text"
          value={context}
          disabled={locked}
          onChange={(e) => onContextChange(e.target.value)}
          data-dictate-label="Overall context"
          placeholder="e.g. Talking about life changes — a blog post about moving abroad"
          style={{ ...boxedField(13.5), background: CARD, minHeight: undefined }}
        />
      </div>

      {isVocab ? (
        <div className="flex flex-col gap-3">
          <VocabTable rows={vocabRows} onChange={onVocabRowsChange} locked={locked} autosize={autosize} />
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 12.5, fontWeight: 600, color: INK_WARM }}>Reference material</label>
            <p className="italic" style={{ fontSize: 11, color: MUTED }}>
              Which dictionary or reference you used — Cambridge, Oxford Learner&apos;s, Longman.
            </p>
            <textarea
              ref={autosize}
              rows={1}
              value={vocabReference}
              disabled={locked}
              onInput={autosizeOnInput}
              onChange={(e) => onVocabReferenceChange(e.target.value)}
              data-dictate-label="Reference material"
              style={boxedField()}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {blocks.map((block, i) => (
            <div
              key={i}
              style={{ borderRadius: 11, border: `1px solid ${FAINT}`, background: CARD, padding: "4px 18px 16px" }}
            >
              <div className="flex items-center justify-between" style={{ padding: "10px 0 2px" }}>
                <h4 className="font-serif" style={{ fontSize: 17, fontWeight: 600, color: INK }}>
                  {sheet!.blockName} {i + 1}
                </h4>
                {!locked && blocks.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onBlocksChange(blocks.filter((_, bi) => bi !== i))}
                    style={{ fontSize: 12.5, color: "var(--color-destructive)" }}
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
                    <FieldRow key={key} label={field.label} hint={field.hint}>
                      <div className="flex flex-col gap-2">
                        {pairs.map((pair, pi) => (
                          <div key={pi} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <textarea
                              ref={autosize}
                              rows={2}
                              value={pair.problem}
                              disabled={locked}
                              onInput={autosizeOnInput}
                              onChange={(e) =>
                                updateBlock(i, {
                                  [key]: pairs.map((p, x) => (x === pi ? { ...p, problem: e.target.value } : p)),
                                } as Partial<AnalysisBlock>)
                              }
                              placeholder="Problem"
                              data-dictate-label={`${field.label} — problem`}
                              style={boxedField()}
                              {...bulletListProps}
                            />
                            <textarea
                              ref={autosize}
                              rows={2}
                              value={pair.solution}
                              disabled={locked}
                              onInput={autosizeOnInput}
                              onChange={(e) =>
                                updateBlock(i, {
                                  [key]: pairs.map((p, x) => (x === pi ? { ...p, solution: e.target.value } : p)),
                                } as Partial<AnalysisBlock>)
                              }
                              placeholder="Solution"
                              data-dictate-label={`${field.label} — solution`}
                              style={boxedField()}
                              {...bulletListProps}
                            />
                          </div>
                        ))}
                        {!locked ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateBlock(i, { [key]: [...pairs, { problem: "", solution: "" }] } as Partial<AnalysisBlock>)
                            }
                            className="self-start"
                            style={{ fontSize: 12.5, color: TEAL }}
                          >
                            + Add another problem
                          </button>
                        ) : null}
                      </div>
                    </FieldRow>
                  );
                }

                const value = (block[key] as string | undefined) ?? "";
                return (
                  <FieldRow key={key} label={field.label} hint={field.hint}>
                    {field.type === "select" ? (
                      <CustomSelect
                        value={value}
                        disabled={locked}
                        onChange={(v) => updateBlock(i, { [key]: v } as Partial<AnalysisBlock>)}
                        options={(field.options ?? []).map((opt) => ({ value: opt, label: opt || "— choose —" }))}
                      />
                    ) : field.type === "input" ? (
                      <input
                        type="text"
                        value={value}
                        disabled={locked}
                        onChange={(e) => updateBlock(i, { [key]: e.target.value } as Partial<AnalysisBlock>)}
                        data-dictate-label={field.label}
                        style={{ ...boxedField(), minHeight: undefined }}
                      />
                    ) : field.type === "phon" ? (
                      <PhonemicPopup
                        value={value}
                        disabled={locked}
                        onChange={(v) => updateBlock(i, { [key]: v } as Partial<AnalysisBlock>)}
                        className="w-full rounded-[8px] border border-border bg-[oklch(99.2%_0.005_90)] px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                      />
                    ) : (
                      // No mic of its own: the plan has one Dictate button --
                      // two faces of it, identity band and bottom bar -- and it
                      // writes into whichever box has the cursor, this one
                      // included (Ramy, 12 Sep 2026).
                      <textarea
                        ref={autosize}
                        rows={1}
                        value={value}
                        disabled={locked}
                        onInput={autosizeOnInput}
                        onChange={(e) => updateBlock(i, { [key]: e.target.value } as Partial<AnalysisBlock>)}
                        data-dictate-label={field.label}
                        style={boxedField()}
                        {...bulletListProps}
                      />
                    )}
                  </FieldRow>
                );
              })}
            </div>
          ))}
          {!locked ? (
            <div style={{ borderTop: `1px solid ${FAINT}`, paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => onBlocksChange([...blocks, emptyAnalysisBlock()])}
                className="rounded-full"
                style={{ border: `1px dashed ${BORDER}`, padding: "7px 16px", fontSize: 13, color: MUTED }}
              >
                + Add another {sheet!.blockName.toLowerCase()}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-[212px_minmax(0,1fr)] sm:items-start sm:gap-[18px]"
      style={{ borderTop: `1px solid ${FAINT}`, padding: "13px 0" }}
    >
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: INK_WARM }}>{label}</p>
        {hint ? (
          <p className="italic" style={{ fontSize: 11, color: MUTED }}>
            {hint}
          </p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Radio({
  label,
  checked,
  disabled,
  onSelect,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="inline-flex items-center gap-1.5"
      style={{ fontSize: 12.5, color: INK }}
      aria-pressed={checked}
    >
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 13, height: 13, border: `1.5px solid ${checked ? TEAL : BORDER}` }}
      >
        {checked ? <span className="rounded-full" style={{ width: 6, height: 6, background: TEAL }} /> : null}
      </span>
      {label}
    </button>
  );
}

function VocabTable({
  rows,
  onChange,
  locked,
  autosize,
}: {
  rows: VocabRow[];
  onChange: (rows: VocabRow[]) => void;
  locked: boolean;
  autosize: (el: HTMLTextAreaElement | null) => void;
}) {
  const columns: { key: keyof VocabRow; label: string; hint: string; width: string }[] = [
    { key: "item", label: "Vocab item", hint: "stress, phonemic transcription, part of speech", width: "16%" },
    { key: "definition", label: "Definition", hint: "level appropriate", width: "18%" },
    { key: "convey", label: "How will you convey the meaning?", hint: "situation, reading, picture, realia…", width: "17%" },
    { key: "clarification", label: "Clarification of meaning", hint: "visuals, CCQs + answers, examples", width: "20%" },
    { key: "form", label: "Form", hint: "countable? collocations, dependent prepositions", width: "14%" },
    { key: "problems", label: "Problems & solutions", hint: "meaning, form, pronunciation", width: "15%" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto" style={{ borderRadius: 10, border: `1px solid ${FAINT}` }}>
        <table className="w-full border-collapse" style={{ minWidth: 900, fontSize: 13 }}>
          <thead>
            <tr style={{ background: CARD }}>
              {columns.map((col) => (
                <th key={col.key} className="text-left align-top" style={{ padding: 10, width: col.width }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: INK_WARM }}>{col.label}</span>
                  <span className="block italic" style={{ fontSize: 10.5, fontWeight: 400, color: MUTED }}>
                    {col.hint}
                  </span>
                </th>
              ))}
              <th style={{ padding: 10, width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? "oklch(97.6% 0.01 88)" : undefined }}>
                {columns.map((col) =>
                  col.key === "item" ? (
                    <td key={col.key} className="align-top" style={{ padding: "9px 10px" }}>
                      <PhonemicPopup
                        rows={2}
                        value={row[col.key]}
                        disabled={locked}
                        onChange={(v) => onChange(rows.map((r, x) => (x === i ? { ...r, [col.key]: v } : r)))}
                        className="w-full rounded-[8px] border border-border bg-[oklch(99.2%_0.005_90)] px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-primary"
                      />
                    </td>
                  ) : (
                    <td key={col.key} className="align-top" style={{ padding: "9px 10px" }}>
                      <textarea
                        ref={autosize}
                        rows={1}
                        value={row[col.key]}
                        disabled={locked}
                        onInput={autosizeOnInput}
                        onChange={(e) => onChange(rows.map((r, x) => (x === i ? { ...r, [col.key]: e.target.value } : r)))}
                        data-dictate-label={col.label}
                        style={{ ...boxedField(13), padding: "6px 9px", color: INK_WARM }}
                      />
                    </td>
                  )
                )}
                <td className="align-top" style={{ padding: "9px 6px" }}>
                  {!locked ? (
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter((_, x) => x !== i))}
                      style={{ color: "var(--color-destructive)", fontSize: 12 }}
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
      {!locked ? (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyVocabRow()])}
          className="self-start rounded-full"
          style={{ border: `1px dashed ${BORDER}`, padding: "7px 16px", fontSize: 13, color: MUTED }}
        >
          + Add item
        </button>
      ) : null}
    </div>
  );
}

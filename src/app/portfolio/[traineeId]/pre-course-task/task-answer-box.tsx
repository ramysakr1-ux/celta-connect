"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { savePreCourseTaskAnswer } from "@/app/portfolio/[traineeId]/pre-course-task/actions";
import {
  answerHasContent,
  parseAnswer,
  type StructuredAnswer,
  type TaskShape,
} from "@/lib/pre-course-task-shape";

// Ramy, 28 Aug 2026: the pre-course task is answered in Connect, not on
// paper -- and "structured, worksheet would be good," so a task renders as
// the thing Cambridge actually asks for (Correct/Not buttons, matching
// dropdowns, a box per word) rather than one undifferentiated text area.
//
// Continuous debounced autosave throughout, same shape the filmed-
// observation task form already uses: no submit button, because the task is
// explicitly never graded and never handed in, so there is nothing to
// submit to.

const INPUT = "rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary";
const ROW_LABEL = "text-sm text-ink";

function RowIndex({ n }: { n: number }) {
  return <span className="w-5 shrink-0 pt-2 text-xs tabular-nums text-muted">{n}</span>;
}

export function TaskAnswerBox({
  itemId,
  initialResponse,
  readOnly,
  shape,
}: {
  itemId: string;
  initialResponse: string;
  readOnly: boolean;
  shape: TaskShape | null;
}) {
  const [value, setValue] = useState<StructuredAnswer>(() =>
    shape && shape.kind !== "open" ? parseAnswer(initialResponse) : {}
  );
  const [plain, setPlain] = useState(initialResponse);
  const [saved, setSaved] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skips the save the initial mount would otherwise fire, which would
  // write every untouched task back to the DB just for opening the page.
  const dirtyRef = useRef(false);
  const structured = Boolean(shape) && shape!.kind !== "open";

  useEffect(() => {
    if (readOnly || !dirtyRef.current) return;
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("item_id", itemId);
      if (structured) {
        // Saves "" rather than "{}" when nothing is filled in, so an empty
        // shell never counts towards progress or the roster column.
        fd.set("response", answerHasContent(value) ? JSON.stringify(value) : "");
        fd.set("response_kind", "json");
      } else {
        fd.set("response", plain);
      }
      void savePreCourseTaskAnswer(fd).then(() => setSaved(true));
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, plain, itemId, readOnly, structured]);

  const set = useCallback((key: string, v: StructuredAnswer[string]) => {
    dirtyRef.current = true;
    setValue((prev) => ({ ...prev, [key]: v }));
  }, []);

  const str = (key: string): string => {
    const v = value[key];
    return typeof v === "string" ? v : "";
  };
  const cell = (key: string): { choice?: string; text?: string } => {
    const v = value[key];
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  };

  // ---- read-only (staff viewing a candidate's answers) -----------------
  if (readOnly) {
    if (!structured) {
      return plain.trim() ? (
        <p className="whitespace-pre-wrap rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink">{plain}</p>
      ) : (
        <p className="rounded-[6px] border border-dashed border-border px-3 py-2 text-sm text-muted">Not answered yet.</p>
      );
    }
    if (!answerHasContent(value)) {
      return <p className="rounded-[6px] border border-dashed border-border px-3 py-2 text-sm text-muted">Not answered yet.</p>;
    }
    return (
      <div className="flex flex-col gap-1.5 rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm">
        {Object.entries(value).map(([k, v]) => (
          <p key={k} className="text-ink">
            <span className="text-muted">{k === "_text" ? "" : `${Number(k) + 1}. `}</span>
            {Array.isArray(v)
              ? v.join(", ")
              : typeof v === "string"
                ? v
                : [v.choice, v.text].filter(Boolean).join(" — ")}
          </p>
        ))}
      </div>
    );
  }

  const savedLabel = <span className="text-[11px] text-muted">{saved ? "Saved" : "Saving…"}</span>;

  // ---- open ------------------------------------------------------------
  if (!structured) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          value={plain}
          onChange={(e) => {
            dirtyRef.current = true;
            setPlain(e.target.value);
          }}
          rows={3}
          placeholder="Write your answer…"
          className={INPUT}
        />
        {savedLabel}
      </div>
    );
  }

  const s = shape!;

  return (
    <div className="flex flex-col gap-2">
      {s.kind === "parts" ? (
        <div className="flex flex-col gap-3">
          {s.parts.map((part, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label className={ROW_LABEL}>
                <span className="mr-1.5 text-xs tabular-nums text-muted">{i + 1}</span>
                {part}
              </label>
              <textarea value={str(String(i))} onChange={(e) => set(String(i), e.target.value)} rows={2} placeholder="Write your answer…" className={INPUT} />
            </div>
          ))}
        </div>
      ) : null}

      {s.kind === "rows_text" ? (
        <div className="flex flex-col gap-3">
          {s.rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-start gap-1">
                <RowIndex n={i + 1} />
                <span className="flex-1 pt-1.5 text-sm text-ink">{row}</span>
              </div>
              <div className={`ml-5 grid gap-2 ${s.cols.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {s.cols.map((col, c) => (
                  <input
                    key={c}
                    type="text"
                    value={str(`${i}.${c}`)}
                    onChange={(e) => set(`${i}.${c}`, e.target.value)}
                    placeholder={col}
                    className={INPUT}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {s.kind === "rows_choice" || s.kind === "rows_choice_text" ? (
        <div className="flex flex-col divide-y divide-border-faint">
          {s.rows.map((row, i) => {
            const c = cell(String(i));
            return (
              <div key={i} className="flex flex-col gap-2 py-2.5 first:pt-0">
                <div className="flex flex-wrap items-start gap-2">
                  <RowIndex n={i + 1} />
                  <span className="min-w-[12rem] flex-1 pt-1.5 text-sm text-ink">{row}</span>
                  <span className="flex shrink-0 gap-1.5 pt-1">
                    {s.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={c.choice === opt}
                        onClick={() => set(String(i), { ...c, choice: c.choice === opt ? undefined : opt })}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          c.choice === opt ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted trainee-hover-fill"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </span>
                </div>
                {s.kind === "rows_choice_text" && c.choice === s.text_when ? (
                  <input
                    type="text"
                    value={c.text ?? ""}
                    onChange={(e) => set(String(i), { ...c, text: e.target.value })}
                    placeholder={s.text_label}
                    className={`${INPUT} ml-5`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {s.kind === "rows_select" ? (
        <div className="flex flex-col divide-y divide-border-faint">
          {s.rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 py-2 first:pt-0">
              <RowIndex n={i + 1} />
              <span className="min-w-[10rem] flex-1 text-sm text-ink">{row}</span>
              <select value={str(String(i))} onChange={(e) => set(String(i), e.target.value)} className={`${INPUT} shrink-0 py-1.5`}>
                <option value="">Choose…</option>
                {s.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}

      {s.kind === "checklist" ? (
        <div className="flex flex-col gap-2">
          {(() => {
            const picked = Array.isArray(value["picked"]) ? (value["picked"] as string[]) : [];
            const atLimit = picked.length >= s.pick;
            return (
              <>
                <p className="text-xs text-muted">
                  Pick {s.pick} — {picked.length} chosen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {s.options.map((opt) => {
                    const on = picked.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={on}
                        // Deliberately blocks a sixth pick rather than
                        // silently dropping the oldest -- the question asks
                        // for a top five, so the limit is the point.
                        disabled={!on && atLimit}
                        onClick={() => set("picked", on ? picked.filter((p) => p !== opt) : [...picked, opt])}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted trainee-hover-fill"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      ) : null}

      {savedLabel}
    </div>
  );
}

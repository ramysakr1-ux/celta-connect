"use client";

import { useActionState } from "react";
import { TpPointStatusPill } from "@/lib/status-pill";
import { ProcedureDisplay } from "@/components/tp-library/procedure-display";
import type { Database } from "@/lib/supabase/types";

type TpPoint = Database["public"]["Tables"]["tp_points"]["Row"];

export interface ReviewFormState {
  error: string | null;
}

export function TpPointReviewForm({
  point,
  coursebookId,
  updateAction,
  setStatusAction,
}: {
  point: TpPoint;
  coursebookId: string;
  updateAction: (prevState: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
  setStatusAction: (formData: FormData) => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(updateAction, { error: null });

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          TP{point.tp_number} &middot; slot {point.sequence_index} &middot; {point.density_tier}
        </span>
        <TpPointStatusPill status={point.status} />
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="point_id" value={point.id} />
        <input type="hidden" name="coursebook_id" value={coursebookId} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Main aim</label>
          <textarea
            name="main_lesson_aim"
            defaultValue={point.main_lesson_aim}
            rows={2}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Sub aim</label>
          <input
            name="sub_aim"
            defaultValue={point.sub_aim ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Materials</label>
          <textarea
            name="materials_description"
            defaultValue={point.materials_description ?? ""}
            rows={2}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Page references</label>
          <input
            name="page_references"
            defaultValue={point.page_references ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>

        {point.procedure ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Procedure (generated)</label>
            <div className="rounded-[6px] border border-border bg-card px-3 py-3">
              <ProcedureDisplay tier={point.density_tier} procedure={point.procedure} />
            </div>
          </div>
        ) : null}

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-[6px] border border-primary px-3 py-1.5 text-sm font-medium text-primary disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save edits"}
        </button>
      </form>

      <div className="flex gap-3">
        {point.status !== "published" ? (
          <form action={setStatusAction}>
            <input type="hidden" name="point_id" value={point.id} />
            <input type="hidden" name="coursebook_id" value={coursebookId} />
            <input type="hidden" name="status" value="published" />
            <button
              type="submit"
              className="rounded-[6px] bg-primary px-3 py-1.5 text-sm font-medium text-card"
            >
              Publish
            </button>
          </form>
        ) : null}
        {point.status !== "archived" ? (
          <form action={setStatusAction}>
            <input type="hidden" name="point_id" value={point.id} />
            <input type="hidden" name="coursebook_id" value={coursebookId} />
            <input type="hidden" name="status" value="archived" />
            <button type="submit" className="text-sm text-destructive underline">
              Archive
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

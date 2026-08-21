"use client";

import { useActionState } from "react";
import { addVideoRecord, type FormState } from "@/app/trainer/(hub)/video/actions";

const initialState: FormState = { error: null };

export function AddVideoForm() {
  const [state, action, pending] = useActionState(addVideoRecord, initialState);

  return (
    <form action={action} className="sheet flex flex-col gap-3 p-6">
      <h2 className="font-serif text-lg text-ink">Add a video</h2>
      <p className="text-sm text-muted">
        Paste a link -- YouTube (unlisted is fine), Vimeo, a Google Drive share link, or anywhere else you&apos;ve
        hosted it. The video itself isn&apos;t uploaded to Connect, only the link.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm text-muted">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="OBS 1: CELTA Online -- Getting to know you"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm text-muted">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="video_url" className="text-sm text-muted">
          Video link
        </label>
        <input
          id="video_url"
          name="video_url"
          type="url"
          required
          placeholder="https://..."
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add video"}
      </button>
    </form>
  );
}

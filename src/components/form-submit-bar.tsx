// Forms.dc.html: the four "submitting locks this..." window.confirm()
// popups become a static warning line read on the bar itself, before the
// trainee/tutor ever clicks -- not a second confirmation step, just moved
// out of a dialog. Shared by the lesson plan, self-evaluation, tutor
// feedback and written assignment forms.
export function FormSubmitBar({
  warning,
  draftPending,
  submitPending,
  onSubmitAction,
  submitLabel = "Submit",
  submitDisabled = false,
  error,
}: {
  warning: string;
  draftPending: boolean;
  submitPending: boolean;
  onSubmitAction: (formData: FormData) => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  error?: string | null;
}) {
  return (
    <div className="sheet sticky bottom-4 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="size-1.5 shrink-0 rounded-full bg-gold" />
        <p className="text-xs text-muted">{warning}</p>
      </div>
      <div className="flex items-center gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={draftPending || submitPending}
          className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary disabled:opacity-60"
        >
          {draftPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="submit"
          formAction={onSubmitAction}
          disabled={draftPending || submitPending || submitDisabled}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {submitPending ? "Submitting…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

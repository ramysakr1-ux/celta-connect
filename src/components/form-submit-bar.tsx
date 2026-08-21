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
  hideDraftButton = false,
  raiseForMobileNav = false,
}: {
  warning: string;
  draftPending: boolean;
  submitPending: boolean;
  onSubmitAction: (formData: FormData) => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  error?: string | null;
  // for-claude-code-trainee-interface.md's Assignments tab: "no manual save
  // button" once real autosave exists -- opt-in per caller so the other 3
  // forms sharing this bar (lesson plan, self-evaluation, tutor feedback)
  // keep their manual button unchanged.
  hideDraftButton?: boolean;
  // specs/build-spec.md §7 mobile bottom tab bar (trainee-mobile-nav.tsx)
  // AND the floating chat pill (raiseForMobileNav on StaffChatDrawer, which
  // sits at bottom-20) both occupy the bottom of the screen below `md` on
  // every trainee page -- this needs to clear BOTH, stacked above the chat
  // pill rather than sharing its offset (bottom-20 alone made them overlap,
  // caught live). Only the 3 trainee-facing callers (lesson plan,
  // self-evaluation, written assignment) opt in; the trainer feedback form
  // has neither to clear.
  raiseForMobileNav?: boolean;
}) {
  return (
    <div
      className={`sheet sticky z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
        raiseForMobileNav ? "bottom-40 md:bottom-4" : "bottom-4"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="size-1.5 shrink-0 rounded-full bg-status-warning-text" />
        <p className="text-xs text-muted">{warning}</p>
      </div>
      <div className="flex items-center gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {hideDraftButton ? null : (
          <button
            type="submit"
            disabled={draftPending || submitPending}
            className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary disabled:opacity-60"
          >
            {draftPending ? "Saving…" : "Save draft"}
          </button>
        )}
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

// Split out of withdrawal-request-actions.ts 2026-08-27: a "use server"
// file can only export async functions (Server Actions) -- these plain
// const arrays were silently coming through as undefined on the client,
// crashing withdrawal-request-form.tsx with "confirmations.map is not a
// function" the moment it read WITHDRAW_CONFIRMATIONS/DEFER_CONFIRMATIONS.

export const WITHDRAWAL_REASON_TAGS = [
  "Personal circumstances",
  "Health",
  "Work commitments",
  "Financial",
  "The course is not right for me",
  "Prefer not to say",
] as const;

export const WITHDRAW_CONFIRMATIONS = [
  "I understand that withdrawing is final and cannot be reversed on this course.",
  "I understand that no further teaching practice will be scheduled and no further work of mine will be assessed.",
  "I understand my portfolio will be closed as it stands and retained by the centre.",
  "I understand that if I have been entered with Cambridge, my result will be reported as a withdrawal.",
] as const;

export const DEFER_CONFIRMATIONS = [
  "I understand a deferral is a request, not a decision, and depends on the centre agreeing and a place being available.",
  "I understand my portfolio will be frozen from my last day and no further work will be assessed until I return.",
  "I understand my work carries forward to the course I join, and that the centre will confirm what counts towards completion.",
  "I understand that if I do not return, the centre may record this as a withdrawal.",
] as const;

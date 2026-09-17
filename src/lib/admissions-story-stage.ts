// The five applicant stages the Course Story can open the Admissions room on
// (for-claude-code-demo-clock.md §3). A subset of applicants.stage, chosen
// because each is a row somebody would actually be looking at that day.
export const STORY_STAGES = ["submitted", "task_returned", "interview_booked", "offer_sent", "accepted"] as const;
export type StoryStage = (typeof STORY_STAGES)[number];

export function parseStoryStage(raw: string | null | undefined): StoryStage | null {
  return raw && (STORY_STAGES as readonly string[]).includes(raw) ? (raw as StoryStage) : null;
}

// Shared by the notebook's server actions, the client panel and the layout.
// Lives outside the "use server" file because only async functions survive
// as exports there -- a constant becomes a non-callable proxy in the client.
export const NOTEBOOK_PAPERS = ["blue", "pink", "cream", "mint", "lavender", "white"] as const;
export type NotebookPaper = (typeof NOTEBOOK_PAPERS)[number];

export interface TraineeNote {
  id: string;
  anchor_path: string;
  anchor_label: string;
  body: string;
  created_at: string;
  updated_at: string;
  /** Migration 0294: a voice note keeps its recording; body is the transcript. */
  audio_path?: string | null;
  audio_duration_seconds?: number | null;
  /** Signed for this page load -- never stored. */
  audio_url?: string | null;
}

/** The private bucket voice notes live in (migration 0294). */
export const NOTEBOOK_AUDIO_BUCKET = "trainee-notebook-audio";

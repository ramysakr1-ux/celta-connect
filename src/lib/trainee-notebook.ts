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
}

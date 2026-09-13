// Migration 0302. Plain module, no directive: a "use server" file may export
// only async functions, so the bucket name cannot live beside the actions
// that use it -- and both the candidate's upload and the tutor's signed link
// need it.
export const APPENDIX_BUCKET = "assignment-appendices";

export interface AppendixRecord {
  id: string;
  label: string | null;
  file_name: string;
  storage_path: string | null;
  link_url: string | null;
  size_bytes: number | null;
}

Migration 0269 was generated from the live pg_policies rows (every policy
whose USING/WITH CHECK mentioned current_center_id()) by replacing
`x = current_center_id()` with `x = any(public.my_center_ids())`. The
policies.json dump and the DOWN file that restores the originals live in the
session scratchpad, not the repo; regenerate from pg_policies if needed.

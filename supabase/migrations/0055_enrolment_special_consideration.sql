-- Checkpoint 11 (Enrolment forms, build-spec.md item 17). Scoped to what's
-- safely buildable from the spec's own prose -- the real Candidate
-- Agreement legal text and the exact Cambridge AI-use disclaimer wording
-- both need Ramy's real centre documents (the spec itself says the AI
-- disclaimer "is explicitly subject to constant review... so hold it as an
-- uploaded centre document rather than hardcoded text" -- not something to
-- fabricate). What IS safely buildable now: a special-consideration
-- declaration at enrolment (a real, well-specified field, Admin Handbook
-- territory, not a legal document), plus expanding the existing join-flow
-- checkboxes with two more real, plain-English disclosures the spec
-- explicitly names as required content (cross-course text-fingerprint
-- retention, AI-policy acknowledgment) -- see join-form.tsx and actions.ts.

alter table public.profiles
  add column special_consideration text;

comment on column public.profiles.special_consideration is
  'Declared at enrolment (build-spec.md: "special consideration... declared at enrolment"). Null/empty = nothing declared. Staff-visible only, never shown back to the candidate as a checklist item.';

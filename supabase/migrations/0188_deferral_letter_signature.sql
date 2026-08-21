-- Deferral/withdrawal are agreements, not notices issued to a candidate
-- (per the CELTA5 signature model verification this session) -- withdrawal
-- already captures a real co-signature at the point of agreement, but
-- deferral was routing through the same generic "I've read this"
-- acknowledged_at click every other formal letter (warning, fail-risk)
-- uses, where receipt (not agreement) is the correct, already-verified
-- semantics. This gives deferral letters specifically a real signature,
-- reusing the unified signature model (migration 0186) rather than
-- inventing a second signature mechanism.
alter table public.formal_letters
  add column candidate_signature_name text;

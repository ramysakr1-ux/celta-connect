-- for-claude-code-email-delivery-tracking-visible.md, follow-up: Ramy's
-- call (23 Aug) -- give the Centre Admin invite flow a real optional email
-- send, so delivery status has something to attach to on that roster too.
-- Stays optional: the bare shareable link (created_by copies it out
-- themselves) is still the default path, this only adds a second one.
alter table public.centre_admin_invites add column email text;

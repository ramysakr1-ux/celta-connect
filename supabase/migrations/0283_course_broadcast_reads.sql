-- Which tutor notices a trainee has actually read.
--
-- Ramy, 9 Sep 2026, on the Course Stream landing (option 4b): "From your
-- tutors" is meant to show an unread notice in full -- gold dot, bold title,
-- the body text -- and collapse a read one to its title and who sent it. That
-- distinction had nothing behind it. course_broadcasts carries pinned, sent_at
-- and three visibility columns, but no notion of a reader, and nothing
-- anywhere in the app had ever marked one as seen. Every notice was
-- permanently new.
--
-- One row per person per notice, written the first time they load a page that
-- shows it. Deliberately NOT append-only, unlike assessor_prep_marks: there is
-- no second event to record here -- a notice is read or it is not, there is no
-- un-reading it, and nobody else's decisions depend on when it happened. The
-- primary key is the pair, so a re-render is a no-op rather than a new row.
--
-- Only the reader can see or write their own rows. Staff are deliberately not
-- given a policy here: "has Amara read my notice yet" is a surveillance
-- question nobody asked for, and adding it later is one policy, whereas taking
-- it away once tutors have seen it is a conversation.

create table if not exists public.course_broadcast_reads (
  broadcast_id uuid not null references public.course_broadcasts (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (broadcast_id, trainee_id)
);

-- The landing asks "which of these has this one person read", so the trainee
-- leads the index; the primary key already covers the other direction.
create index if not exists course_broadcast_reads_trainee_idx
  on public.course_broadcast_reads (trainee_id, broadcast_id);

alter table public.course_broadcast_reads enable row level security;

drop policy if exists course_broadcast_reads_read on public.course_broadcast_reads;
drop policy if exists course_broadcast_reads_insert on public.course_broadcast_reads;

-- (select auth.uid()), not a bare auth.uid(): migration 0272 wrapped every
-- helper in a scalar subquery precisely because the bare form was being
-- re-evaluated once per row. A new policy must not reintroduce that.
create policy course_broadcast_reads_read
  on public.course_broadcast_reads for select
  using (trainee_id = (select auth.uid()));

create policy course_broadcast_reads_insert
  on public.course_broadcast_reads for insert
  with check (trainee_id = (select auth.uid()));

-- No update, no delete: read_at is set once and never moves.

notify pgrst, 'reload schema';

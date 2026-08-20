-- Run this once on the Supabase project to enable live score/odds pushes.
-- (Kept outside supabase/migrations/ because this project's database is
-- managed externally, not by Lovable's migration runner.)
--
-- The frontend (src/lib/use-live-updates.ts) subscribes to postgres_changes
-- on these tables and re-runs its loaders when a score or price moves.
-- Realtime needs the tables in the supabase_realtime publication, plus
-- REPLICA IDENTITY FULL so UPDATE payloads carry the whole row.

alter table public.events replica identity full;
alter table public.selections replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'selections'
  ) then
    alter publication supabase_realtime add table public.selections;
  end if;
end $$;

-- Each standalone scoreboard is stored as its own match record.
create table if not exists public.arena_matches (
  id uuid primary key,
  data jsonb not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arena_matches_data_object check (jsonb_typeof(data) = 'object')
);

create index if not exists arena_matches_status_updated_idx
  on public.arena_matches (status, updated_at desc);

alter table public.arena_matches enable row level security;

drop policy if exists "Anyone can view scoreboard matches" on public.arena_matches;
create policy "Anyone can view scoreboard matches"
  on public.arena_matches for select to anon, authenticated
  using (true);

drop policy if exists "Admins can create scoreboard matches" on public.arena_matches;
create policy "Admins can create scoreboard matches"
  on public.arena_matches for insert to authenticated
  with check (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "Admins can update scoreboard matches" on public.arena_matches;
create policy "Admins can update scoreboard matches"
  on public.arena_matches for update to authenticated
  using (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ));

grant select on public.arena_matches to anon, authenticated;
grant insert, update on public.arena_matches to authenticated;

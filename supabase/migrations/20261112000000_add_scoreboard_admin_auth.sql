-- Admins are existing Supabase Auth users explicitly granted scoreboard access.
create table if not exists public.arena_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.arena_admins enable row level security;
alter table public.arena_tournaments enable row level security;

drop policy if exists "Users can read their own admin status" on public.arena_admins;
create policy "Users can read their own admin status"
  on public.arena_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Anyone can view the scoreboard" on public.arena_tournaments;
create policy "Anyone can view the scoreboard"
  on public.arena_tournaments for select to anon, authenticated
  using (true);

drop policy if exists "Admins can create scoreboard" on public.arena_tournaments;
create policy "Admins can create scoreboard"
  on public.arena_tournaments for insert to authenticated
  with check (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "Admins can update scoreboard" on public.arena_tournaments;
create policy "Admins can update scoreboard"
  on public.arena_tournaments for update to authenticated
  using (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ));

grant select on public.arena_admins to authenticated;
grant select on public.arena_tournaments to anon, authenticated;
grant insert, update on public.arena_tournaments to authenticated;
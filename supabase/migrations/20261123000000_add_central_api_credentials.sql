create table if not exists public.arena_central_api_credentials (
  id integer primary key check (id = 1),
  token text not null check (length(trim(token)) > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);

alter table public.arena_central_api_credentials enable row level security;

drop policy if exists "Scoreboard admins can read central API credentials"
  on public.arena_central_api_credentials;
create policy "Scoreboard admins can read central API credentials"
  on public.arena_central_api_credentials for select to authenticated
  using (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "Scoreboard admins can create central API credentials"
  on public.arena_central_api_credentials;
create policy "Scoreboard admins can create central API credentials"
  on public.arena_central_api_credentials for insert to authenticated
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.arena_admins a
      where a.user_id = (select auth.uid())
    )
  );

drop policy if exists "Scoreboard admins can update central API credentials"
  on public.arena_central_api_credentials;
create policy "Scoreboard admins can update central API credentials"
  on public.arena_central_api_credentials for update to authenticated
  using (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ))
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.arena_admins a
      where a.user_id = (select auth.uid())
    )
  );

drop policy if exists "Scoreboard admins can delete central API credentials"
  on public.arena_central_api_credentials;
create policy "Scoreboard admins can delete central API credentials"
  on public.arena_central_api_credentials for delete to authenticated
  using (exists (
    select 1 from public.arena_admins a
    where a.user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.arena_central_api_credentials to authenticated;

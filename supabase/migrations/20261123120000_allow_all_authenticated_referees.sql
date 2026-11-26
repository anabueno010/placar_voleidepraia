drop policy if exists "Admins can create scoreboard matches" on public.arena_matches;
drop policy if exists "Admins can update scoreboard matches" on public.arena_matches;
drop policy if exists "Admins can create scoreboard" on public.arena_tournaments;
drop policy if exists "Admins can update scoreboard" on public.arena_tournaments;

create policy "Authenticated users can create scoreboard matches"
  on public.arena_matches for insert to authenticated
  with check (true);

create policy "Authenticated users can update scoreboard matches"
  on public.arena_matches for update to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can create scoreboard tournaments"
  on public.arena_tournaments for insert to authenticated
  with check (true);

create policy "Authenticated users can update scoreboard tournaments"
  on public.arena_tournaments for update to authenticated
  using (true)
  with check (true);

drop policy if exists "Scoreboard admins can read central API credentials"
  on public.arena_central_api_credentials;
drop policy if exists "Scoreboard admins can create central API credentials"
  on public.arena_central_api_credentials;
drop policy if exists "Scoreboard admins can update central API credentials"
  on public.arena_central_api_credentials;
drop policy if exists "Scoreboard admins can delete central API credentials"
  on public.arena_central_api_credentials;

drop policy if exists "Authenticated users can read central API credentials"
  on public.arena_central_api_credentials;
drop policy if exists "Authenticated users can create central API credentials"
  on public.arena_central_api_credentials;
drop policy if exists "Authenticated users can update central API credentials"
  on public.arena_central_api_credentials;
drop policy if exists "Authenticated users can delete central API credentials"
  on public.arena_central_api_credentials;

create policy "Authenticated users can read central API credentials"
  on public.arena_central_api_credentials for select to authenticated
  using (true);

create policy "Authenticated users can create central API credentials"
  on public.arena_central_api_credentials for insert to authenticated
  with check (updated_by = (select auth.uid()));

create policy "Authenticated users can update central API credentials"
  on public.arena_central_api_credentials for update to authenticated
  using (true)
  with check (updated_by = (select auth.uid()));

create policy "Authenticated users can delete central API credentials"
  on public.arena_central_api_credentials for delete to authenticated
  using (true);

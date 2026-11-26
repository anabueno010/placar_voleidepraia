-- Temporary test mode: allow the public scoreboard to create and edit matches.
-- Central API credentials remain restricted to authenticated users.
create policy "Anonymous users can create scoreboard matches"
  on public.arena_matches for insert to anon
  with check (true);

create policy "Anonymous users can update scoreboard matches"
  on public.arena_matches for update to anon
  using (true)
  with check (true);

grant insert, update on public.arena_matches to anon;

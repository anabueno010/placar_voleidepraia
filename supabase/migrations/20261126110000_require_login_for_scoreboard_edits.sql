-- End the temporary anonymous editing mode while keeping public read access.
drop policy if exists "Anonymous users can create scoreboard matches" on public.arena_matches;
drop policy if exists "Anonymous users can update scoreboard matches" on public.arena_matches;
revoke insert, update, delete on public.arena_matches from anon;

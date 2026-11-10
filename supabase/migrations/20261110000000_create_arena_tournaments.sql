-- Tournament snapshots are stored as JSON so the browser can restore the
-- complete bracket and current match without losing fields as the UI evolves.
create table if not exists public.arena_tournaments (
  id uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint arena_tournaments_data_object check (jsonb_typeof(data) = 'object')
);

create index if not exists arena_tournaments_updated_at_idx
  on public.arena_tournaments (updated_at desc);

alter table public.arena_tournaments enable row level security;

-- The scoreboard currently has no sign-in flow. Keep rows private until an
-- authenticated admin workflow is added; do not grant anonymous write access.

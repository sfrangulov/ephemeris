-- ephemeris RLS (spec §5).
-- Shared registry tables are public-read; writes happen only via the secret
-- key (service_role), which bypasses RLS. Per-user tables are owner-scoped,
-- with public read of profiles flagged is_public for the /u/<slug> share page.

alter table packages enable row level security;
alter table download_daily enable row level security;
alter table star_daily enable row level security;
alter table watchlist enable row level security;
alter table profiles enable row level security;

create policy "public read" on packages
  for select using (true);
create policy "public read" on download_daily
  for select using (true);
create policy "public read" on star_daily
  for select using (true);

create policy "own watchlist" on watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public profile read" on profiles
  for select using (is_public = true);

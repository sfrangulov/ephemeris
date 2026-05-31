-- per-version weekly download snapshots (research doc 2026-05-31: download share
-- per version). shared, public-read registry written only by jobs (secret key),
-- like download_daily/star_daily. one row per package, version, npm last-week
-- window-end. stable releases only (prereleases dropped at capture). raw counts;
-- "share" is derived at read time, never stored. no backfill: npm exposes
-- per-version downloads for last-week only, so the archive starts at deploy.

create table version_download_weekly (
  package_id bigint not null references packages (id) on delete cascade,
  week_ending date not null,
  version text not null,
  downloads int not null,
  primary key (package_id, week_ending, version)
);

alter table version_download_weekly enable row level security;

create policy "public read" on version_download_weekly
  for select using (true);

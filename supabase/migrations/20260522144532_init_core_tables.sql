-- ephemeris core schema (spec §5).
-- packages/download_daily/star_daily are a shared, public-read registry written
-- only by jobs (secret key). watchlist/profiles are per-user.

create table packages (
  id bigint generated always as identity primary key,
  name text unique not null,
  repo_owner text,
  repo_name text,
  latest_version text,
  last_published_at timestamptz,
  backfill_status text not null default 'none'
    check (backfill_status in ('none', 'pending', 'done', 'truncated')),
  created_at timestamptz default now(),
  last_synced_at timestamptz
);

create table download_daily (
  package_id bigint not null references packages (id) on delete cascade,
  day date not null,
  downloads int not null,
  primary key (package_id, day)
);

create table star_daily (
  package_id bigint not null references packages (id) on delete cascade,
  day date not null,
  stars_total int not null,
  stars_delta int not null,
  primary key (package_id, day)
);

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slug text unique not null,
  is_public boolean not null default false
);

create table watchlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  package_id bigint not null references packages (id) on delete cascade,
  added_at timestamptz default now(),
  primary key (user_id, package_id)
);

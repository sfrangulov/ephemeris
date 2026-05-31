-- Badge read path: collapse the 4 sequential round-trips in loadPortfolio /
-- loadBadgePackage into ONE call. The function is iad1->hnd1 latency-bound
-- (function region co-located to hnd1 via vercel.json), so cutting 4 hops to 1
-- removes ~3 trans-region RTTs from every cache MISS. Downloads are date-bounded
-- to the trailing ~95 days (covers the 13-week window with a buffer) to stop the
-- previously unbounded all-time scan from growing forever; STAR history stays
-- UNBOUNDED because star_daily holds cumulative totals — dropping old rows would
-- collapse starsTotal to 0 for low-activity packages (honest-data A4 regression).
--
-- SECURITY DEFINER + service_role-only: the functions bypass RLS and enforce the
-- privacy gate themselves (private profile => null unless p_viewer is the owner).
-- They are REVOKEd from public/anon/authenticated so a caller holding only the
-- publishable key cannot pass an arbitrary p_viewer to unlock a private profile;
-- only the trusted server (admin/secret key => service_role) may call them.
--
-- The today-UTC row filter and ALL weekly bucketing / momentum / quantile math
-- stay in TypeScript (lib/portfolio.ts, lib/badge-pkg.ts) — this function only
-- replaces the raw multi-query fetch, never the honest-data transforms.

-- Portfolio badge + dashboard view: profile gate, watchlist->packages, per-pkg
-- date-bounded downloads + unbounded cumulative stars. Returns null when the
-- slug is unknown or the profile is private and p_viewer is not its owner.
create or replace function public.portfolio_badge(p_slug text, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with prof as (
    select user_id, is_public from profiles where slug = p_slug
  )
  select case
    when (select user_id from prof) is null then null
    when not (select is_public from prof)
         and (select user_id from prof) is distinct from p_viewer then null
    else jsonb_build_object(
      'profile', jsonb_build_object(
        'user_id', (select user_id from prof),
        'is_public', (select is_public from prof)
      ),
      'packages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pk.id,
          'name', pk.name,
          'latest_version', pk.latest_version,
          'last_published_at', pk.last_published_at,
          'last_synced_at', pk.last_synced_at,
          'downloads', coalesce((
            select jsonb_agg(
              jsonb_build_object('day', d.day, 'downloads', d.downloads)
              order by d.day
            )
            from download_daily d
            where d.package_id = pk.id
              and d.day >= ((now() at time zone 'utc')::date - 95)
          ), '[]'::jsonb),
          'stars', coalesce((
            select jsonb_agg(
              jsonb_build_object('day', s.day, 'stars_total', s.stars_total, 'stars_delta', s.stars_delta)
              order by s.day
            )
            from star_daily s
            where s.package_id = pk.id
          ), '[]'::jsonb)
        ))
        from watchlist w
        join packages pk on pk.id = w.package_id
        where w.user_id = (select user_id from prof)
      ), '[]'::jsonb)
    )
  end;
$$;

-- Per-package badge: same profile gate + single-package-by-name + watchlist
-- membership check. Returns null on unknown slug/pkg, private-not-owner, or a
-- package not on this profile's watchlist.
create or replace function public.package_badge(p_slug text, p_pkg text, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with prof as (
    select user_id, is_public from profiles where slug = p_slug
  ), pk as (
    select id, name, last_synced_at from packages where name = p_pkg
  )
  select case
    when (select user_id from prof) is null then null
    when not (select is_public from prof)
         and (select user_id from prof) is distinct from p_viewer then null
    when (select id from pk) is null then null
    when not exists (
      select 1 from watchlist w
      where w.user_id = (select user_id from prof)
        and w.package_id = (select id from pk)
    ) then null
    else jsonb_build_object(
      'name', (select name from pk),
      'last_synced_at', (select last_synced_at from pk),
      'downloads', coalesce((
        select jsonb_agg(
          jsonb_build_object('day', d.day, 'downloads', d.downloads)
          order by d.day
        )
        from download_daily d
        where d.package_id = (select id from pk)
          and d.day >= ((now() at time zone 'utc')::date - 95)
      ), '[]'::jsonb),
      'stars', coalesce((
        select jsonb_agg(
          jsonb_build_object('day', s.day, 'stars_total', s.stars_total, 'stars_delta', s.stars_delta)
          order by s.day
        )
        from star_daily s
        where s.package_id = (select id from pk)
      ), '[]'::jsonb)
    )
  end;
$$;

-- LOAD-BEARING: SECURITY DEFINER functions are EXECUTE-able by PUBLIC by default.
-- Without this revoke, an anon caller could pass the owner's user_id as p_viewer
-- and unlock a private profile through the publishable key. Restrict to the
-- trusted server role only.
revoke execute on function public.portfolio_badge(text, uuid) from public, anon, authenticated;
revoke execute on function public.package_badge(text, text, uuid) from public, anon, authenticated;
grant execute on function public.portfolio_badge(text, uuid) to service_role;
grant execute on function public.package_badge(text, text, uuid) to service_role;

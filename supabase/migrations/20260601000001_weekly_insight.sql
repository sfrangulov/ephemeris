-- Weekly-insight pre-gen cache (oss-selection 2026-06-01, ephemeris-zx6).
-- The 6h sync computes a grounded insight stack per profile (compute -> AI
-- select+phrase the lead -> deterministic supporting lines) and caches it here.
-- The /u surface reads the cached stack only — no per-request LLM call, no
-- version-data join on the hot path (the version-EOL rule runs sync-side).
--
-- Payload shape: { "stack": [{ "text": "...", "recommends": bool }, ...],
--                  "generated_at": "<iso>" }. Lead is stack[0].

alter table profiles add column if not exists weekly_insight jsonb;

-- Re-expose the cached payload through the existing single-chokepoint RPC so the
-- dashboard read path stays one round-trip. Additive: badge consumers ignore the
-- new field. The privacy gate is unchanged — a private profile still returns
-- null unless p_viewer is the owner, so weekly_insight never leaks.
create or replace function public.portfolio_badge(p_slug text, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with prof as (
    select user_id, is_public, weekly_insight from profiles where slug = p_slug
  )
  select case
    when (select user_id from prof) is null then null
    when not (select is_public from prof)
         and (select user_id from prof) is distinct from p_viewer then null
    else jsonb_build_object(
      'profile', jsonb_build_object(
        'user_id', (select user_id from prof),
        'is_public', (select is_public from prof),
        'weekly_insight', (select weekly_insight from prof)
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

-- LOAD-BEARING (mirrors 20260531102318_badge_rpc.sql): re-assert the privacy
-- ACL explicitly. `create or replace function` on the same signature preserves
-- existing privileges, but stating them here keeps every migration that touches
-- this SECURITY DEFINER function self-contained — a future replace can never
-- silently leave it EXECUTE-able by anon/authenticated (which could pass an
-- arbitrary p_viewer to unlock a private profile through the publishable key).
revoke execute on function public.portfolio_badge(text, uuid) from public, anon, authenticated;
grant execute on function public.portfolio_badge(text, uuid) to service_role;

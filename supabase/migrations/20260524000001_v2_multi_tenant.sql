-- v2 multi-tenant: profiles default public; track sync-request time;
-- expose watchlist publicly when the owning profile is public so /u/[slug]
-- renders under the anon (publishable) key without service-role.

alter table profiles alter column is_public set default true;
alter table profiles add column last_sync_request_at timestamptz;

create policy "public watchlist read" on watchlist
  for select using (
    exists (
      select 1 from profiles
      where profiles.user_id = watchlist.user_id
        and profiles.is_public = true
    )
  );

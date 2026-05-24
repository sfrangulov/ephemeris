# ephemeris v2 — multi-tenant Owned Identity SaaS

**Date:** 2026-05-24
**Beads:** umbrella `ephemeris-zu3`, spec `ephemeris-84j`
**Supersedes (positioning only):** `docs/superpowers/specs/2026-05-22-ephemeris-design.md` (§M5/M7, single-owner sections). Data model and ingestion contracts from that spec remain in force unless explicitly amended below.

## Why this exists

MVP shipped as a single-owner observatory: `OWNER_GITHUB_LOGIN=sfrangulov` gates writes, the dashboard reads every package in the registry without per-user filtering, the `watchlist` and `profiles` tables exist but no code uses them, and `/u/[slug]` was never built. The schema was always multi-tenant; the code was not.

v2 closes that gap and pivots the product framing from «my observatory» to «the observatory platform — one per maintainer, sharable, embeddable». The distribution loop is: maintainer logs in → portfolio auto-populates → public `/u/[slug]` page is live → maintainer drops `/badge/[slug]` into a repo README → README readers see the badge → click through → land on the maintainer's observatory → some sign in for their own. The product grows on the back of npm READMEs, not marketing.

Brainstorming session 2026-05-24 (this spec) chose the «layered SaaS, not pivot» shape: dashboard, public share page, and badge live as three layers of the same product surface. Identity is hard-bound to GitHub login = npm maintainer (no separate npm-username field in v2).

## Product changes (summary)

| Surface | MVP (today) | v2 |
|---|---|---|
| Root `/` | redirect → `/dashboard` | marketing teaser + embedded `/u/sfrangulov` demo + login CTA |
| Portfolio view | `/dashboard` shows ALL packages, edit chrome gated by `OWNER_GITHUB_LOGIN` | `/u/[slug]` shows that user's watchlist; edit chrome appears when `auth.uid() == profile.user_id` |
| `/dashboard` | canonical view | 301 → `/u/[my-slug]` (logged-in) or `/login` (logged-out) |
| Watchlist | unused; dashboard reads everything | auto-only, populated from `fetchPackagesByMaintainer(slug)` |
| Public read | one global URL | per-slug; `is_public=false` → 404 |
| Badge | one global `/badge.svg` | `/badge/[slug]`; old URL 301 → `/badge/sfrangulov` |
| Sync trigger | manual FAB for sfrangulov + 6h cron for one maintainer | manual FAB still sfrangulov-only; 6h cron iterates all profiles; new users get inline bootstrap in `auth/callback` |
| Manual package add/remove | sidebar `AddPackage`/`RemovePackage` (owner only) | removed — watchlist is auto-derived |

## Routing & access model

| URL | Logged-out | Logged-in (other-view) | Logged-in (self-view) |
|---|---|---|---|
| `/` | marketing teaser, embedded `/u/sfrangulov` demo, login CTA | 302 → `/u/[my-slug]` | 302 → `/u/[my-slug]` |
| `/u/[slug]` | render if `profiles.is_public=true`, else 404 | same | same + edit chrome |
| `/dashboard` | 302 → `/login` | 301 → `/u/[my-slug]` | 301 → `/u/[my-slug]` |
| `/login` | render | 302 → `/u/[my-slug]` | same |
| `/badge/[slug]` | public SVG | same | same |
| `/badge.svg` | 301 → `/badge/sfrangulov` | same | same |
| `/api/sync` POST | 401 | 403 (not owner) | 403 unless `user.login === OWNER_GITHUB_LOGIN` |
| `/api/profile` POST | 401 | 403 (not own profile) | 200 (toggle `is_public`) |

**Self-view edit chrome on `/u/[my-slug]`:**

- Toggle «public profile» / «private profile» — writes `profiles.is_public`. Local optimistic, server-truth.
- Copy-snippet button: `[![ephemeris](${origin}/badge/${slug})](${origin}/u/${slug})`. Single click → clipboard, transient «copied» state.
- Sync FAB — only when `user.login === OWNER_GITHUB_LOGIN`. Same behaviour as MVP (dispatch full `sync.yml` workflow).

**Privacy posture for 404:** private profiles return `notFound()` (Next 404 page). Never «this profile is private» — that confirms a slug exists and leaks the namespace.

## Data model & RLS

**One migration** (`supabase/migrations/2026052414XXXX_v2_multi_tenant.sql`):

```sql
-- profile defaults to public; track sync-request time for future rate-limit work
alter table profiles alter column is_public set default true;
alter table profiles add column last_sync_request_at timestamptz;

-- watchlist becomes public-readable for public profiles, so /u/[slug] can
-- render under the anon (publishable) key without service-role
create policy "public watchlist read" on watchlist
  for select using (
    exists (
      select 1 from profiles
      where profiles.user_id = watchlist.user_id
        and profiles.is_public = true
    )
  );
```

**Unchanged:**

- `packages`, `download_daily`, `star_daily` — global registry, public read, service-role write. A given package row is shared across watchlists; we do not duplicate per user.
- Existing RLS policies on `packages`/`download_daily`/`star_daily`/`profiles` (own profile r/w + public read of `is_public=true` profiles) — intact.
- `auth/callback` already upserts `profiles { user_id, slug: github_login }`; we extend it (see Sync), do not rewrite it.

**Identity binding (v2 constraint):** `profiles.slug = user_metadata.user_name (github login) = npm maintainer username` are the same string for all users. Maintainers whose GitHub login differs from their npm username see an empty portfolio. Acceptable trade in v2 (≈20% of OSS maintainers); a future spec adds a separate `npm_username` column with onboarding capture.

## Portfolio loader

`lib/portfolio.ts::loadPortfolio` currently takes no arguments and reads every row in `packages`. New signature:

```ts
export const loadPortfolio = cache(async (slug: string): Promise<PortfolioSnapshot> => {
  // 1. resolve slug → user_id, require is_public OR auth.uid()===user_id
  // 2. select package_id list from watchlist where user_id=$1
  // 3. existing logic, but `select … in (package_ids)` everywhere
})
```

The cache key is the slug, so the layout and the page both share one query in the same request.

`/u/[slug]/page.tsx` consumes `loadPortfolio(slug)`; if `notFound()` is thrown (private + not owner, or unknown slug) the route returns Next 404. The matrix component (`PortfolioMatrix`) takes the same `rows` shape it does today.

## Sync pipeline

### Recurring (every 6h, `.github/workflows/sync.yml` → `scripts/sync.ts`)

Refactor `scripts/sync.ts` to iterate over profiles instead of a single hard-coded maintainer:

1. **Discovery** — replace `const maintainer = process.env.NPM_MAINTAINER || 'sfrangulov'` with `select slug from profiles`. For each slug:
   - `fetchPackagesByMaintainer(slug)` (existing function)
   - `packages.upsert({ name }, { onConflict: 'name', ignoreDuplicates: true })` — global registry stays one row per package name
   - `watchlist.upsert([{ user_id, package_id }, …], { onConflict: 'user_id,package_id', ignoreDuplicates: true })` — link to this profile
2. **Per-package downloads + meta + current stars** — iterate over the whole `packages` table (source of truth is the table, not any one slug). Logic unchanged from MVP.
3. **One-time stargazer backfill for `backfill_status='pending'`** — logic unchanged.

Removals:
- `NPM_MAINTAINER` env (workflow + script + repo variable) deprecated, deleted after deploy.
- No new env required.

### On-signup bootstrap (`app/auth/callback/route.ts`)

After the existing `profiles.upsert`, before redirect, run inline:

1. `fetchPackagesByMaintainer(slug)` — if 0 results, skip remaining steps (slug ≠ npm maintainer, empty profile is the correct state).
2. `packages.upsert([{ name }, …], { onConflict: 'name', ignoreDuplicates: true })` for the discovered names.
3. `watchlist.upsert(…)` linking the new profile to those package ids.
4. For each newly-linked package (use service-role admin client, since callback runs server-side):
   - `fetchDownloadsRange(name, today-40d, today)` → upsert `download_daily`
   - `fetchPackageMeta(name)` → update `latest_version`, `last_published_at`, `repo_owner`, `repo_name`, `backfill_status='pending'`
   - If `repo_owner/repo_name` resolved AND `GITHUB_TOKEN` present: `fetchRepoStats` → upsert one `star_daily` row for today (current total, delta from 0). **No** `backfillStargazers` — that's expensive and runs in the next cron.
5. Set `packages.last_synced_at = now()` per package.
6. Redirect to `/u/[slug]` (changed from `/dashboard`).

Latency budget: ~0.5–1s per package; typical maintainer ≤30 packages → <30s; fits comfortably in Vercel's default 300s function timeout. If a maintainer has 200+ packages the redirect blocks for ~2min — acceptable (one-time, only for prolific maintainers, who are the target audience).

Failure handling: any per-package error logs and continues (mirrors `scripts/sync.ts`). A failed bootstrap leaves an empty/partial profile; the next 6h cron completes it.

### Manual sync (FAB)

No changes. `/api/sync` POST keeps the `OWNER_GITHUB_LOGIN` check; FAB only rendered when `user.login === OWNER_GITHUB_LOGIN`. The dispatched workflow runs the recurring pipeline (now per-profile iteration), so a sergei-press refreshes everyone's data — acceptable side-effect.

## Auth & onboarding flow

1. Visitor lands on `/` (marketing teaser + demo). Clicks «sign in».
2. `/login` → GitHub OAuth via Supabase.
3. Callback at `/auth/callback?code=…`:
   - exchange code → session
   - upsert `profiles { user_id, slug: github_login, is_public: true }` (default is now true)
   - inline bootstrap sync (see above)
   - redirect → `/u/[slug]`
4. New maintainer sees their populated portfolio immediately. If `fetchPackagesByMaintainer` returned 0 — they see an empty-state explainer: «no npm packages found for maintainer `<slug>`. ephemeris binds your GitHub login to your npm maintainer name; if they differ, this is the expected state for now».

## Marketing root

`/` becomes a single-screen static-feeling page that nevertheless honours `PRODUCT.md` anti-references. No three-column feature row, no testimonials, no «get started for free» button.

Composition (top → bottom):

- Wordmark `ephemeris` + sublabel «observatory for npm portfolios» (sentence case, mono, muted).
- One sentence of factual copy: «daily downloads and github stars for a maintainer's packages, with weekly momentum.»
- Live embed of `/u/sfrangulov` matrix (server-rendered iframe-equivalent: the actual `<PortfolioMatrix>` component with `loadPortfolio('sfrangulov')`). The demo IS the marketing.
- Single CTA: «sign in with github» → `/login`.
- Tiny footer: link to source, link to demo profile.

No client-only animation, no gradient. Same tokens, same grid texture, same fonts as the dashboard.

## Migration & deletion

### SQL

Single migration (above). Apply via Supabase MCP `apply_migration`.

### Backstop data seed (one-time, manual, before frontend deploy)

```sql
-- existing sfrangulov profile was created when default was false; flip it
-- so the marketing root and the public /u/sfrangulov page render under anon.
update profiles set is_public = true where slug = 'sfrangulov';

-- populate watchlist for sfrangulov from existing packages so v2 routes
-- render a full portfolio the moment they go live (no 6h wait).
insert into watchlist (user_id, package_id)
select p.user_id, pkg.id
from profiles p
cross join packages pkg
where p.slug = 'sfrangulov'
on conflict (user_id, package_id) do nothing;
```

Runs before merge. Idempotent. Both statements MUST execute or `/` and `/u/sfrangulov` return 404 to anon visitors.

### Code deletions

- `app/(app)/` directory — contents move to `app/u/[slug]/`. Drop the `(app)` route group entirely.
- `components/dashboard/add-package.tsx`, `components/dashboard/remove-package.tsx` — auto-only watchlist has no manual add/remove.
- `app/api/packages/route.ts` — corresponding endpoint dies with the components.
- `app/(auth)/login/page.tsx` copy: replace «one maintainer's portfolio» with multi-user framing.

### Code retained against earlier brainstorming claim

- `OWNER_GITHUB_LOGIN` env — kept (sync FAB gate only).
- `app/api/sync/route.ts` — kept, OWNER gate intact.
- `app/badge.svg/route.ts` — replaced with a 301 redirect to `/badge/sfrangulov`. Existing READMEs/embeds keep working.

## Out of scope (explicit)

- Per-package badges (`/badge/[slug]/[pkg]/{dl-momentum,sparkline,stars-momentum}`). Separate spec.
- Badge light/dark theme via `<picture>` pattern. Dark-only first.
- Per-user manual sync FAB and accompanying rate-limit infrastructure. (`last_sync_request_at` column added now for forward-compat; not read in v2.)
- Separate `npm_username` field and onboarding capture screen. v2 binds slug to GitHub login.
- Discovery surfaces (public-profiles index, leaderboard, search).
- Alerts, digest emails, monetization, custom domain.
- Live re-derivation of watchlist on maintainer changes (`fetchPackagesByMaintainer` only adds; we never remove from `watchlist` on subsequent runs in v2).
- Onboarding wizard for the empty-profile case (we show a one-sentence explainer and stop).

## Open questions deferred

- **What if two GitHub users want the same npm maintainer name?** github login is unique; the npm-maintainer collision is not possible under the v2 binding constraint.
- **Removed-from-maintainership case:** if a package is unpublished or maintainer revoked, `fetchPackagesByMaintainer` stops returning it. We do not delete from `watchlist` in v2 — the package and its history persist on the user's portfolio. (Removing belongs to the future manual-edit feature.)
- **`/u/[slug]` for unknown slug vs private slug:** both return 404. (Documented in Routing.)

## Acceptance criteria (high level — plan expands)

1. A non-sfrangulov user can sign in with GitHub and immediately see their npm portfolio at `/u/[their-login]` with current downloads and stars.
2. `/u/[their-login]` is publicly accessible without auth and renders identically to the owner's view minus the edit chrome.
3. The portfolio matrix on `/u/sfrangulov` matches what is at `/dashboard` today (no data regression for the existing user).
4. `/dashboard` and `/badge.svg` redirect appropriately.
5. The 6h cron continues to keep all profiles fresh without manual intervention.
6. `OWNER_GITHUB_LOGIN=sfrangulov` continues to be the gate for the sync FAB and only for that.

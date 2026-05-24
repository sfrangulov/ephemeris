# ephemeris — handover (2026-05-24)

**What it is:** multi-tenant observatory for npm portfolios. Sign in → `/u/<github-login>` auto-populates → embed `/badge/<slug>` in your repo READMEs. Live: <https://ephemeris-dev.vercel.app>.

For full context read in this order: [`README.md`](README.md) → [`CLAUDE.md`](CLAUDE.md) (file map + rules) → [`docs/superpowers/specs/2026-05-24-ephemeris-v2-multi-tenant-design.md`](docs/superpowers/specs/2026-05-24-ephemeris-v2-multi-tenant-design.md) (current architecture).

## Current state

Both umbrella epics are closed:
- `ephemeris-b42` — MVP (M0–M6 shipped 2026-05-22).
- `ephemeris-zu3` — v2 multi-tenant (40+ commits, shipped 2026-05-24).

Prod is on `https://ephemeris-dev.vercel.app`, deployed via `vercel --prod` (CLI, not git integration). Vercel project `ephemeris` (scope `sergeis-projects-580f7155`), linked through `.vercel/` (gitignored). Supabase project `ephemeris` (ref `hvmgpohpvlmejzhyaqng`, region ap-northeast-1, Postgres 17). The 6h sync workflow is `.github/workflows/sync.yml` → `scripts/sync.ts`.

Env on Vercel prod (see `.env.example` for shape):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — client
- `SUPABASE_SECRET_KEY` — admin client (sync write, callback bootstrap)
- `OWNER_USER_ID` — operator gate (Sergei's Supabase `auth.users.id`); the sync FAB only renders for this user. Note: the gate is on `user.id`, not on `user_metadata.user_name` (which is mutable via `supabase.auth.updateUser`).
- `GITHUB_TOKEN` — PAT used by `/api/sync` (manual FAB) to dispatch the GitHub Actions workflow. The recurring cron itself uses the auto-provisioned Actions token, not this one.

## Open work (beads)

```
ephemeris-138 · P3 · e2e: bootstrap flow for non-sfrangulov maintainer
ephemeris-1or · P3 · spec: decouple npm_username from github login
ephemeris-3ir · P3 · spec: per-package badges (momentum / sparkline / stars)
ephemeris-rkx · P3 · unit test: loadPortfolio slug-filter behavior
```

`bd ready` to grab the next one; `bd show <id>` for details.

## Known traps

- **Today's UTC `download_daily` row is filtered before bucketing** (`lib/portfolio.ts`). npm Downloads API returns 0 for the current day until aggregation catches up; including it shifts the trailing-7d window vs npm's `/point/last-week`. Don't re-introduce. See `DESIGN.md` §Honest data layer.
- **Sync writes to prod.** `scripts/sync.ts` is idempotent (composite-PK upserts), but the local dry-run hits real prod Supabase + npm + GitHub APIs.
- **Workflow `sync.yml` runs on Node 22**, not the default Actions Node. Uses `npm install` (not `npm ci`) because of an `@emnapi` drift on lockfile checkout.
- **Identity binding (v2):** `profiles.slug = github login = npm maintainer username`. Maintainers whose github login differs from their npm username see empty portfolios. Filed as `ephemeris-1or`.
- **Bootstrap runs on first login only.** Profile-exists check guards it. Don't switch to a blind `upsert(ignoreDuplicates)` flow that would force re-sync on every callback (~8s wasted per login for sfrangulov).
- **Manual sync gate is `user.id === OWNER_USER_ID`**, not `user_metadata.user_name === OWNER_GITHUB_LOGIN`. The latter is mutable client-side via `supabase.auth.updateUser`. Don't regress this — `DESIGN.md` anti-patterns calls it out.

## What's NOT in v2 (intentional)

- Per-package badges (epic `ephemeris-3ir`)
- Light/dark badge via `<picture>` pattern (the single SVG already auto-flips via `prefers-color-scheme`)
- Per-user sync FAB + rate-limit infrastructure (operator-only for now)
- Alerts, digest emails, monetization, custom domain
- Discovery surfaces (public profiles index, leaderboard)
- Manual add/remove watchlist UI (auto-only by design)

## Quick commands

```bash
npm run dev               # localhost:3000
npm test                  # 34 tests
npm run build             # prod build
npx tsc --noEmit          # typecheck
vercel --prod             # promote local to prod
bd ready                  # next available task
```

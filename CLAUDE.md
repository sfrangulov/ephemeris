# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
pnpm install
pnpm dev                  # http://localhost:3000
pnpm test                 # vitest, 60 tests (pure-function tests only — no DB mocking)
pnpm build                # production build, must succeed before deploy
npx tsc --noEmit          # typecheck, must be 0 errors
```

Manual sync (writes to prod Supabase — idempotent):

```bash
set -a; . ./.env.local; set +a; npx tsx scripts/sync.ts
```

Browser smoke (Playwright MCP) belongs at the end of any UI/route change.

## Architecture Overview

**Product:** multi-tenant owned-identity SaaS. Each maintainer signs in with GitHub and gets a public `/u/<github-login>` portfolio page (`/u/[slug]`), an embeddable portfolio badge (`/badge/[slug]`, `?n=N` row count), and four per-package badge variants (`/badge/[slug]/<pkg>/{momentum,sparkline,stars,card}.svg`, `?theme=dark|light|auto`, default `dark`). The dashboard for the maintainer is the same `/u/[my-slug]` page with edit chrome. Primary domain: `ephemeris.tools`.

**Stack:** Next.js 16 App Router (RSC, Turbopack) on Vercel · Supabase (Postgres + Auth + RLS) · shadcn/ui + Tailwind v4 · IBM Plex Sans / JetBrains Mono · Vitest · GitHub Actions worker.

**Sync pipeline:**
- `scripts/sync.ts` runs every 6h via `.github/workflows/sync.yml` — iterates `profiles`, discovers each maintainer's npm packages, upserts `packages` + `watchlist` rows, then per-package fetches downloads (last 40d), registry meta, current stargazers; one-time star-history backfill for newly-resolved repos.
- `app/auth/callback/route.ts` runs an inline lightweight bootstrap (discovery + downloads + current stars, no stargazer backfill) on the FIRST login only — returning users skip it. Both paths share `lib/sync.ts::syncPackage` (extracted to avoid drift).

**Data model:** `packages`/`download_daily`/`star_daily` are a global registry (public read, service-role write). `profiles` (user_id, slug, is_public) and `watchlist` (user_id, package_id) are per-user with RLS — watchlist becomes public-readable when the owning profile is public.

**Permissions:**
- Anonymous: read public profiles + the marketing root + badges.
- Authenticated owner of profile: edit chrome (toggle is_public via `/api/profile`, copy badge markdown).
- Platform operator (`OWNER_USER_ID` env, sfrangulov): manual sync FAB → `/api/sync` → dispatches the full workflow. Gate is `user.id === OWNER_USER_ID` (NOT `user_metadata.user_name` — that's mutable via `supabase.auth.updateUser`).

**Source of truth docs:**
- `PRODUCT.md` — voice, register, anti-references (read before adding any visible surface)
- `DESIGN.md` — tokens, components, the honest data layer invariants (load-bearing)
- `docs/superpowers/specs/2026-05-24-ephemeris-v2-multi-tenant-design.md` — current architecture
- `docs/superpowers/plans/2026-05-24-ephemeris-v2-multi-tenant.md` — implementation history
- `HANDOVER.md` — MVP-era state (kept for historical context; superseded by v2 spec)

## Conventions & Patterns

**Honest data layer (load-bearing — see `DESIGN.md`):** today's UTC `download_daily` row is filtered before bucketing; `momentumStatus` requires both 5% AND `sqrt(prev)` AND `prev ≥ 20`; `globalMaxDl = quantile(0.9)`; freshness pill uses `min(last_synced_at)`. Changing these is a regression even if visually OK.

**File layout:**
- `app/u/[slug]/` — canonical portfolio route (layout + page)
- `app/badge/[slug]/route.ts` — portfolio badge SVG
- `app/badge/[slug]/[...rest]/route.ts` — per-package badge SVG (single GET, switches on the last segment ∈ `{momentum,sparkline,stars,card}.svg`; `[...rest]` collects pkg segments before that)
- `app/api/{profile,sync}/` — POST endpoints (profile = own-row toggle; sync = OWNER-only workflow dispatch)
- `app/auth/callback/` — OAuth + first-login bootstrap
- `lib/portfolio.ts` — `loadPortfolio(slug, viewerUserId?)`, single chokepoint for the dashboard view
- `lib/badge.ts` — `loadBadge(slug, topN?)`, plus the shared palette: `COLORS` (dark) + `LIGHT_COLORS` (light, with deepened success/destructive for AA), `fmtCompact`/`signedCompact`
- `lib/badge-pkg.ts` — `loadBadgePackage(slug, pkgName, viewerUserId?)` + four pure render functions (`renderMomentum`/`renderSparkline`/`renderStars`/`renderCard`) + `Theme` type
- `lib/freshness.ts` — `relAgo(iso)` shared by portfolio and per-package loaders
- `lib/sync.ts` — shared `syncPackage` (cron + bootstrap)
- `lib/viewer.ts` — `getViewer()` cached per-request auth helper
- `lib/slug.ts` — slug charset validation (GitHub login rules)

**Voice/tone (from PRODUCT.md):** technical, terse, lowercase for chrome. no marketing words. no exclamations. no emoji. no em-dashes in copy (use `.`, `,`, `:`, or `·`). sentence case for prose. test the rendered surface in a browser before claiming done.

**TDD scope:** library functions get unit tests (vitest in `__tests__/`, currently 60 tests across `aggregate`, `format`, `badge`, `badge-pkg`). RSC pages, route handlers, and Supabase orchestration (incl. `loadPortfolio`/`loadBadgePackage`) are verified via build + Playwright smoke, not mocked tests.

**Slug validation:** GitHub login charset (`/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/`). Validated at every dynamic route entry — `notFound()` on miss.

**Privacy posture:** private profiles return `notFound()` (Next 404), never «this profile is private» — that confirms slug existence.

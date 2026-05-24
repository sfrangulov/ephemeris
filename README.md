# ephemeris

[![license](https://img.shields.io/github/license/sfrangulov/ephemeris?style=flat-square&label=license)](LICENSE)
[![stars](https://img.shields.io/github/stars/sfrangulov/ephemeris?style=flat-square&label=stars)](https://github.com/sfrangulov/ephemeris/stargazers)
[![last commit](https://img.shields.io/github/last-commit/sfrangulov/ephemeris?style=flat-square&label=last%20commit)](https://github.com/sfrangulov/ephemeris/commits/main)
[![vercel](https://img.shields.io/website?style=flat-square&url=https%3A%2F%2Fephemeris.tools&label=vercel&up_message=live&down_message=offline)](https://ephemeris.tools)
[![next.js](https://img.shields.io/badge/next.js-16-black?style=flat-square)](https://nextjs.org)
[![supabase](https://img.shields.io/badge/supabase-postgres%20%2B%20auth-3ecf8e?style=flat-square)](https://supabase.com)

observatory for npm portfolios. daily downloads + github stars + weekly momentum, one row per package.

**live:** https://ephemeris.tools
**demo profile:** https://ephemeris.tools/u/sfrangulov

[![ephemeris](https://ephemeris.tools/badge/sfrangulov)](https://ephemeris.tools/u/sfrangulov)

## what it is

an instrument, not a marketing site. the canonical view is a date × package matrix modeled on a literal astronomical ephemeris: rows are your packages sorted by traffic, columns are trailing weeks, each cell is a magnitude-scaled dot whose color encodes week-over-week change. the brightest packages sit on top; the dimming ones sit on the bottom. glance and leave.

the product name `ephemeris` is an astronomical table of celestial positions over time. the metaphor is observation — positions of objects (packages) plotted across time.

## for maintainers

1. sign in with github at https://ephemeris.tools/login
2. your `/u/<github-login>` page populates on first login (one inline sync of all packages where your github login is also your npm maintainer name)
3. drop the embeddable badge in your repo READMEs
4. your portfolio re-syncs every 6h

identity is currently bound to GitHub login = npm maintainer username; if they differ, your portfolio is empty for now.

## badges

per-owner embed, automatic light/dark theme via `prefers-color-scheme`:

```md
[![ephemeris](https://ephemeris.tools/badge/<your-github-login>)](https://ephemeris.tools/u/<your-github-login>)
```

`?n=N` controls row count (default 5, cap 50):

```md
![ephemeris top-10](https://ephemeris.tools/badge/<slug>?n=10)
```

the legacy `/badge.svg` URL 308-redirects to `/badge/sfrangulov` for backwards compat with the v1 single-owner embed.

## stack

- Next.js 16 App Router (RSC, Turbopack) on Vercel
- Supabase (Postgres + Auth + RLS) — multi-tenant from the schema up
- GitHub Actions worker for the 6h sync pipeline (npm Downloads API + GitHub stargazers)
- shadcn/ui + Tailwind v4 + IBM Plex Sans / JetBrains Mono
- Vitest

## honest data layer (load-bearing)

these invariants live in `lib/portfolio.ts` and `lib/aggregate.ts`. breaking them is a regression even if the UI looks fine.

- `momentumStatus` classifies as `up`/`dn` only when the change clears BOTH a relative band (5%) AND a Poisson floor (`sqrt(prev)`), AND `prev ≥ 20`. a 2→3 swing is not a trend.
- `globalMaxDl` is `quantile(0.9)` of all non-zero weekly buckets across the portfolio — not `Math.max(...)`. one outlier week must not crush every other card's silhouette.
- `starsSeries` is built from real `star_daily` rows, bucketed last-cumulative-value-per-week. never a flat stub.
- freshness pill is `min(last_synced_at)`, not `max`. it must report the worst row, not the best.
- today's UTC `download_daily` row is excluded before bucketing — npm returns `0` for the current day until aggregation catches up (~24h). including it shifts the trailing-7d window forward by a day vs npm's canonical `/point/last-week` and silently under-reports.

## local dev

```bash
cp .env.example .env.local   # fill in supabase + github values
pnpm install
pnpm dev                     # http://localhost:3000
pnpm test                    # vitest, 60 tests
pnpm build                   # production build
```

## docs

- `PRODUCT.md` — register, voice, anti-references
- `DESIGN.md` — tokens, components, honest data layer
- `docs/superpowers/specs/` — design specs (v1 single-owner, v2 multi-tenant)
- `docs/superpowers/plans/` — implementation plans

## license

MIT. © 2026 sergei frangulov ([github](https://github.com/sfrangulov)).

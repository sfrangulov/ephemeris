# per-package badges

**Date:** 2026-05-24
**Beads:** `ephemeris-3ir`
**Builds on:** `docs/superpowers/specs/2026-05-24-ephemeris-v2-multi-tenant-design.md`

## Why this exists

v2 shipped one badge per maintainer — `/badge/[slug]` returns a 760px wide multi-row SVG showing the top-N watchlist as a table. That works for a portfolio link on a personal page, but it does not solve the distribution loop. The loop needs a badge that goes into the README of an *individual* package, alongside the shields.io row a maintainer already has (`npm version`, `downloads`, `license`). One README → one badge → one click → `/u/<slug>` landing.

The portfolio badge does not fit a README row: too wide, too dense, irrelevant to that one package. Per-package badges are the surface that actually rides in other people's READMEs and pulls traffic.

## What ships

Four endpoints, all under `/badge/[slug]/[...pkg]/`:

| Variant | Size | Content |
|---|---|---|
| `momentum.svg` | ~125×20 | `↑ 12.4k/wk` — arrow + last-week downloads, right segment status-colored |
| `sparkline.svg` | ~130×20 | 12-week download line, no numbers, dark segment |
| `stars.svg` | ~115×20 | `★ 124  +5/w` — total stars + weekly delta, dark segment |
| `card.svg` | 440×120 | name + freshness header · 12w sparkline · bottom row: `dl/wk` label + value + signed delta, `stars` label + value + weekly delta |

Micros (`momentum`, `sparkline`, `stars`) target the shields.io row — Verdana 11px, 20px tall, 24px dark left segment with the brand dot logo, content segment on the right. Card targets a standalone block under the shields row — JetBrains Mono, same brand language as the dashboard.

Both surfaces ship together. Each maintainer picks whichever fits their README.

## URL & routing

```
app/badge/[slug]/route.ts                  ← exists, untouched (portfolio badge)
app/badge/[slug]/[...rest]/route.ts       ← new, single handler
```

`[...rest]` is a Next catch-all that must be terminal (the App Router does not allow `[...x]/[y]`). The handler does the split itself: the last element of `rest` is the variant filename (`momentum.svg | sparkline.svg | stars.svg | card.svg`), everything before is the npm package name. Unscoped names take one segment (`["cron"]`); scoped names take two (`["@sfrangulov","shared-memory-mcp"]`). `pkgSegments.join("/")` reconstructs the npm name. Unknown variants 404.

URL examples:

```
/badge/sfrangulov/skill-graveyard/momentum.svg
/badge/sfrangulov/skill-graveyard/sparkline.svg
/badge/sfrangulov/skill-graveyard/stars.svg
/badge/sfrangulov/skill-graveyard/card.svg
/badge/sfrangulov/@sfrangulov/shared-memory-mcp/momentum.svg
```

## Access & errors

Identical posture to `loadPortfolio` — privacy never confirmed.

| Condition | Response |
|---|---|
| `isValidSlug(slug) === false` | `notFound()` |
| slug unknown | `notFound()` |
| profile private, viewer ≠ owner | `notFound()` |
| pkg not in `watchlist` for this slug | `notFound()` |
| variant not in whitelist | `notFound()` |
| pkg in watchlist, no `download_daily` rows yet (just added, pre-sync) | render SVG with `dl/wk = 0`, no arrow, empty sparkline |
| pkg in watchlist, no `star_daily` rows | render `★ N` without `+N/w` tail (card: `★ N · —`) |

Zero on-demand npm registry calls. Zero lazy-sync. Watchlist membership is the gate; anything not in `watchlist` cannot be embedded as a badge for that slug. New packages enter watchlist via the existing 6h sync workflow or first-login bootstrap.

## Data layer

New `lib/badge-pkg.ts::loadBadgePackage(slug, pkgName)` — single-package snapshot:

```ts
interface BadgePackage {
  name: string;
  weeks: number[];           // 12 trailing weekly sums, newest last
  lastWeekDownloads: number;
  deltaDownloads: number;    // last - prev
  status: Status;            // momentumStatus(last, prev)
  starsTotal: number;
  deltaStars: number;        // sum(stars_delta) over the last 7 calendar days
  freshness: string | null;  // relAgo(package.last_synced_at)
}
```

Single SQL pass:
1. `profiles` by slug → resolve `user_id`, gate by `is_public` or viewer match.
2. `packages` where `name = pkgName` join `watchlist` where `user_id = profile.user_id` → 404 if no row.
3. `download_daily` + `star_daily` for that one `package_id`, ordered by day.

**Honest data invariants (inherited from `DESIGN.md`):**
- Today's UTC row excluded from bucketing — npm aggregates ~24h late, including today under-reports the trailing week and skews w/w delta.
- `momentumStatus` requires both 5% AND `sqrt(prev)` AND `prev ≥ 20`. Below 20 weekly downloads, every change is counting noise → `flat`. No green arrows on 2→3 swings.
- Sparkline normalizes 0..1 to the package's own min/max over 12 weeks, not to a global quantile. Per-package badge has no portfolio context to compare against.
- `freshness` is `relAgo(package.last_synced_at)` for that one package, not the portfolio `min(last_synced_at)`.

## Caching

```
Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=600
```

Data refreshes every 6h via the sync workflow; between syncs the SVG is byte-identical. 1h cache (vs portfolio badge's 300s) acknowledges that per-package badges will be served at much higher volume — once per README impression per camo refresh.

GitHub camo honors `Cache-Control` up to ~24h, so 1h lands in reality. Worst-case staleness in a README ≈ sync interval + cache window = ~7h. Acceptable for weekly download metrics.

SWR 10 min — while a fresh version revalidates, camo gets stale without blocking. No Next ISR / data cache; edge `Cache-Control` is the entire strategy.

## Implementation map

```
lib/badge-pkg.ts                                              ← new
  loadBadgePackage(slug, pkgName): Promise<BadgePackage | null>
  renderMomentum(data, theme): string
  renderSparkline(data, theme): string
  renderStars(data, theme): string
  renderCard(data, theme): string

  reuses from lib/badge.ts:
    COLORS, LIGHT_COLORS, fmtCompact, signedCompact

  reuses from lib/aggregate.ts:
    weeklyBuckets, momentumStatus

app/badge/[slug]/[...rest]/route.ts                          ← new
  one GET handler. Parses `rest`: last = variant, prefix = pkg segments.
  Switches on variant, calls render*, sets Cache-Control.

__tests__/badge-pkg.test.ts                                   ← new
  render* are pure (BadgePackage in, string out): assert SVG contains
    arrow ↑/↓/· per status, fmtCompact'd numbers, correct viewBox.
  loadBadgePackage NOT tested — Supabase orchestration belongs to
    build + Playwright smoke, not mocked tests (CLAUDE.md §TDD scope).
```

## TBD

Two follow-ups inside this spec's implementation cycle, not separate epics:

- **Palette calibration.** Brand dot is green (`#34a866`); momentum `up` colors the entire right segment the same green, risk of visual merge. Decide between (a) keeping green/green and relying on dark left-segment frame to separate, (b) switching brand dot to a neutral outline / `--success` only on momentum, (c) introducing a third brand color. Prototype both, eyeball in the rendered HTML mockup from brainstorming session.
- **Light theme.** All four variants flip via `@media (prefers-color-scheme: light)` inside `<style>` (same approach as portfolio badge in `app/badge/[slug]/route.ts`). Concrete light-mode values land with palette calibration above — same calibration pass covers both themes.

## Out of scope

- Lazy-sync for packages not in watchlist. Discussed and rejected — race conditions, abuse surface, network in hot path. Watchlist membership stays the gate.
- Per-package public-badge override (badge of a package whose maintainer profile is private). Rejected — privacy posture stays uniform with portfolio badge.
- Animated SVG / `prefers-reduced-motion`. The data is too slow-moving (6h sync) to justify motion, and animation breaks GitHub camo (static-image only).
- Custom dimensions via query string (`?w=200&h=24`). YAGNI; if requested later, add as `?` opt-in without touching the default path.

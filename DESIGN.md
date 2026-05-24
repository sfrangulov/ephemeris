# ephemeris — Design System

## Theme

Dark-only. Physical scene: maintainer glancing at portfolio momentum on a 14" laptop screen at 23:00 in a dimly-lit room. A light theme would feel wrong (clinical, daytime, marketing). Same palette in `:root` and `.dark` to avoid light-mode flash during hydration.

## Color Strategy

**Restrained.** Tinted slate neutrals carry the surface. One desaturated blueprint blue accent (OKLCH 0.65 0.16 257) marks primary actions and the brand. Semantic-status hues are reserved for data state, never decoration.

Tokens (OKLCH, ported from Palantir Blueprint v5):

| Role | Token | Use |
|---|---|---|
| `--background` | 0.245 0.014 253 | App shell, sidebar |
| `--card` | 0.324 0.016 260 | Elevated surfaces |
| `--muted` | 0.362 0.018 258 | Inputs, secondary surfaces |
| `--muted-foreground` | 0.680 0.025 258 | Labels, hints, captions |
| `--foreground` | 0.976 0.003 265 | Primary text |
| `--border` | 0.399 0.023 258 | 1px dividers, ring-shadows |
| `--primary` | 0.655 0.160 257 | Brand, CTA, focus ring |
| `--success` | 0.640 0.137 155 | Rising momentum |
| `--destructive` | 0.676 0.156 20 | Falling momentum, danger |
| `--warning` | 0.753 0.144 66 | Soft attention |
| `--turquoise` | 0.753 0.130 185 | Freshness indicator |

## Typography

- **Sans:** IBM Plex Sans (next/font, latin subset, weights 400/500/600/700). Picked over Geist because Geist is one of the saturated AI-default faces. Plex Sans is acceptable; not load-bearing for brand.
- **Mono:** **JetBrains Mono** (`--font-jb-mono`). Switched from IBM Plex Mono after AI-slop critique flagged Plex Mono as the next-default-after-Geist. All numbers use the `.mono` class with `font-variant-numeric: tabular-nums`. Mono is brand-load-bearing because almost every glance the user makes is on numbers.
- **Heading kerning:** `letter-spacing: -0.03em; font-weight: 600` on `h1/h2/h3`.
- **Scale (density-dense):** `text-[9px]` uppercase tracking `0.14em` for chrome labels; `text-[10px]` / `text-[11px]` / `text-[12px]` for table cells and captions; `text-xs` body; `text-sm` paragraphs. No hero-size headings anywhere — the dashboard is a logbook, not a marketing page.
- **Casing:** lowercase wordmark and chrome labels by convention; tables headers MAY be uppercase tracked-out when they border a data block. Sentence case for prose.

## The view: date × package matrix

The canonical (and only) view on `/u/[slug]` is `PortfolioMatrix` — a table modeled on a literal astronomical ephemeris. The same component renders the live demo on the marketing root `/`. This is non-negotiable design: the product name promises positions over time.

- **Rows** are packages, sorted by `dl/wk` descending (brightest first), one row per package. No "flagship" or "tier" partitions — the sort order is the hierarchy.
- **Columns** are trailing weeks, leftmost = oldest, rightmost = `now`. Column count is `max(weeks.length across packages)`; when sync history is short, the table is narrow — honest.
- **Cell** is a `MagDot` whose **diameter encodes magnitude** by the stellar formula `m = 10 − 2.5·log₁₀(dl)`; clamped to `[0, 10]`. Brighter = larger. Color encodes per-package week-over-week change with the same Poisson noise floor used by `momentumStatus` (else: muted-foreground).
- **Right-side numeric columns**: `dl/wk` (mono), signed `Δ` (status-colored mono), `★` (muted mono).
- **Header**: one mono line above the table — `N PACKAGES · Σ dl/wk · ±N% W/W · N↑ N↓ N·`. No StatStrip, no PortfolioChart, no portfolio sparkline, no aggregate momentum chart, no 4-cell summary rail.
- **Footer of the matrix** documents the magnitude formula in caption type.

If a future iteration adds another view (e.g. matrix on log axis, or a printable bulletin), it MUST coexist with the matrix as a sibling — not replace it. Card grids and per-package sparkline cards are explicitly retired.

## Components

| Component | Where | Notes |
|---|---|---|
| `AppTopbar` | `app/u/[slug]/layout.tsx` | Sticky 52px header. Left: 10px green dot + lowercase "ephemeris" wordmark. Right: freshness pill (7px pulsing `bg-success` + relative time bound to `min(last_synced_at)`) + `UserMenu` or `sign in` link. No section nav (placeholder items were a trust leak). The sidebar variant from MVP is retired. |
| `PortfolioMatrix` | `app/u/[slug]/page.tsx` + `app/page.tsx` (demo) | The view. Section above is canonical. Sticky `<thead>` over the scrolling `<tbody>` keeps column labels visible. No client JS; pure server render. |
| `PublicToggle` | self-view chrome on `/u/[my-slug]` | Toggle `profiles.is_public` via POST `/api/profile`. Optimistic update, reverts on error. Only rendered when `auth.uid() === profile.user_id`. |
| `CopyBadge` | self-view chrome on `/u/[my-slug]` | Copies the markdown snippet `[![ephemeris](${origin}/badge/${slug})](${origin}/u/${slug})` to clipboard. Transient «copied» state via icon swap. |
| `SyncButton` (FAB) | self-view, operator-only | Bottom-right floating button. Gated by `user.id === process.env.OWNER_USER_ID` (immutable id, NOT `user_metadata.user_name`). POSTs `/api/sync` which dispatches the GitHub Actions workflow. |
| `Badge SVG` | `app/badge/[slug]/route.ts` | One URL, both themes via `<style>` with `@media (prefers-color-scheme: light)`. Chrome (bg/fg/muted/faint/border) uses CSS classes; status hues (success/destructive on deltas + active dots) stay inline because they carry semantic meaning identical across themes. `?n=N` query controls row count (default 5, cap 50); SVG height is derived from row count. |

## Motion

- Entrance: `fade-up` 0.5s ease-out from `translateY(12px)` (CSS keyframe). The matrix itself does not stagger row-by-row — it loads as a single artifact.
- Live sync indicator: `glow-pulse 3s ease-in-out infinite` on the 7px dot in the topbar freshness pill.
- Tactile: `active:scale-[0.98]` on buttons. No bounce. No elastic. No layout-property animation.

## Layout

- App shell: 52px sticky topbar + viewport-locked `<main>` (`h-[100dvh] overflow-hidden`). Inner column `mx-auto max-w-[1080px] px-8 pb-6 pt-7`, `flex flex-col`. The page header is `shrink-0`, the matrix is `flex-1 min-h-0`, the self-view chrome strip is `shrink-0`. Only the matrix's `tbody` wrapper scrolls.
- 24px `grid-texture` overlay on the main canvas. Opacity 0.5, pointer-events-none, behind content. Note: flagged as a saturated dev-tool pattern in the AI-slop audit; kept for now because removing it costs identity without yet earning a replacement signature.
- Login: single centered column, max-w 340, atop the same `grid-texture`. No split-screen, no decorative right panel, no fake telemetry mockup.
- Marketing root `/`: same viewport-lock as `/u/[slug]`; wordmark + sublabel + single factual sentence + `/u/sfrangulov` demo matrix (flex-1) + footer with copyright link. Demo IS the marketing. Logged-in users 302 to `/u/[my-slug]`.

## Icons

`@phosphor-icons/react`. Server components use `/ssr` entry (`@phosphor-icons/react/ssr`) to avoid `createContext` in RSC. `weight="regular"` default; `weight="bold"` on small affordances; `weight="fill"` on status badges.

## Honest data layer (load-bearing)

These rules live in `lib/portfolio.ts` and `lib/aggregate.ts`. Breaking them is a regression even if the UI looks fine.

- **`momentumStatus(last, prev)`** classifies as `up`/`dn` ONLY when the change clears both a relative band (5%) AND a Poisson floor (`sqrt(prev)`), AND `prev ≥ 20`. Low-volume noise is forced `flat`. A 2→3 swing is not a trend.
- **`globalMaxDl`** is `quantile(0.9)` of all non-zero weekly buckets across the portfolio — NOT `Math.max(...)`. One outlier week must not crush every other card's silhouette.
- **`starsSeries`** is built from real `star_daily` rows, bucketed as last-cumulative-value-per-week. Never a flat-stub like `weeks.map(() => starsTotal)` — that fabricates a stable trend.
- **Freshness pill** is `min(last_synced_at)`, NOT `max`. The pill must report the worst row, not the best.
- **`sumWeekly`** left-zero-pads packages with shorter histories; flag as a known limitation when surfacing 13-week portfolio totals (the early weeks under-report until backfill is complete).
- **Today's `download_daily` row is excluded** in `loadPortfolio` before bucketing. The npm Downloads API returns `0` for the current UTC day until aggregation catches up (~24h lag). Including it shifts the trailing-7d window forward by one day vs npm's canonical `/point/last-week` and silently under-reports both `dl/wk` and the w/w delta — for the docx-to-md flagship the difference was 6.2k vs npm's 7.2k. Same reason we don't trust the most recent star_daily row blindly: ingested-now ≠ measured-now.

## Naming Conventions

- Files: kebab-case.
- Components: PascalCase, default export only for pages and layouts.
- Tokens: CSS custom properties via `@theme inline` (Tailwind v4).
- Status type: `"up" | "flat" | "dn"` everywhere; lookup tables `Record<Status, string>`.

## Anti-patterns (refuse on sight)

- **Card grid of per-package sparklines.** Retired. Use the matrix.
- **"FLAGSHIP" / "QUIET" / "primary" tier badges.** Sort order IS the hierarchy.
- **Aggregate portfolio sparkline above the matrix.** Adds nothing the row data doesn't already show; removed.
- **4-cell stat strip ("downloads/wk · downloads/13wk · stars · momentum").** Inline header line replaces it.
- **Fake instrument readouts ("INSTRUMENT · IDLE", "AWAITING AUTH", "NOT LOADED").** Cosplay. A real instrument shows real telemetry or nothing.
- **`observatory` caption under the wordmark on the portfolio page.** Topbar stays bare — metaphor lives in the data treatment (magnitudes, date matrix), not in chrome labels. The marketing root `/` is the one sanctioned place that uses the "observatory for npm portfolios" sublabel (sets framing for first-time visitors); inside the app it's a violation.
- **Gradient text** (`background-clip: text`).
- **Glassmorphism as decoration.**
- **`text-white` / `text-black`** — always use tokens (`text-primary-foreground`, `text-foreground`).
- **Em dashes (`—`) in copy.** Use periods, commas, colons, or `·`.
- **Marketing words** ("Track the orbit of your packages.", "Sign in to your observatory."). Sentence-case factual lines only.
- **Side-stripe borders > 1px.** No sanctioned exceptions remain (the `package-card` 3px stripe was removed with the card).
- **Centered hero / H1 layout.** The login is a centered modal, not a hero. The marketing root `/` is left-aligned, not centered.
- **Manual `AddPackage` / `RemovePackage` UI on the portfolio.** Retired in v2 — watchlists are auto-derived from npm via the maintainer slug. Adding inline package controls is reintroducing the v1 model.
- **Gating privileged actions on `user_metadata`.** `user_metadata.user_name` is mutable by the user via `supabase.auth.updateUser`. The sync FAB gate (and any future operator-only action) MUST check `user.id === process.env.OWNER_USER_ID`. Past audit caught this in `/api/sync` — same trap reapplies everywhere.
- **Inline `fill` on badge chrome.** The badge SVG carries both themes via `<style>` + `@media (prefers-color-scheme: light)`. Chrome elements (bg, fg, muted, faint, border) must use CSS classes; only status hues (success/destructive deltas + active dots) stay inline.
- **Outer-page scroll on viewport-locked surfaces.** `/u/[slug]` and `/` are `h-[100dvh] overflow-hidden`. The matrix's `<tbody>` is the only scroller. Adding `overflow-auto` to `<main>` reintroduces the v1 scroll-the-whole-thing pattern.

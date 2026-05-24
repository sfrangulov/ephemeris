# ephemeris v2 — multi-tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ephemeris from single-owner (`OWNER_GITHUB_LOGIN`-gated) to multi-tenant Owned Identity SaaS: per-user `/u/[slug]` portfolio pages, per-slug embeddable badges, auto-only watchlists bound to `slug = github login = npm maintainer`, marketing teaser at `/`.

**Spec:** `docs/superpowers/specs/2026-05-24-ephemeris-v2-multi-tenant-design.md` (read this first; this plan implements that spec, no architectural decisions live here).

**Architecture:** The existing schema (`profiles`, `watchlist`) is already multi-tenant ready; v2 wires the code through it. New canonical URL `/u/[slug]` replaces `/dashboard` (which becomes a redirect). Recurring 6h cron switches from one hardcoded maintainer to iterating `profiles` rows. `auth/callback` gains an inline lightweight sync so new users see a populated portfolio on first redirect. `OWNER_GITHUB_LOGIN` env is retained solely as the gate for the manual sync FAB.

**Tech Stack:** Next 16 App Router (RSC), Supabase (Postgres + RLS + GoTrue), TypeScript, Vitest, Tailwind v4, shadcn/ui, GitHub Actions for cron sync.

---

## File map

**Create:**
- `supabase/migrations/<ts>_v2_multi_tenant.sql` — schema migration
- `app/u/[slug]/layout.tsx` — topbar wrapper (parameterized via slug)
- `app/u/[slug]/page.tsx` — portfolio matrix per slug
- `app/dashboard/page.tsx` — redirect shim → `/u/[my-slug]` or `/login`
- `app/badge/[slug].svg/route.ts` — per-slug badge SVG endpoint
- `app/api/profile/route.ts` — POST toggle `is_public`
- `components/dashboard/public-toggle.tsx` — client toggle for `is_public`
- `components/dashboard/copy-badge.tsx` — client copy-to-clipboard snippet
- `__tests__/portfolio-filter.test.ts` — unit tests for new pure helpers

**Modify:**
- `lib/portfolio.ts` — `loadPortfolio(slug: string)` signature, watchlist filter, optional `viewerUserId` for private-self-view
- `lib/badge.ts` — `loadBadge(slug: string)` signature
- `app/page.tsx` — marketing teaser with embedded `/u/sfrangulov` matrix
- `app/auth/callback/route.ts` — inline bootstrap sync after profile upsert, redirect to `/u/[slug]`
- `app/badge.svg/route.ts` — replace body with 301 permanent redirect to `/badge/sfrangulov.svg`
- `app/(auth)/login/page.tsx` — copy update (no «one maintainer» phrasing)
- `components/layout/app-topbar.tsx` — accept optional `slug` prop; show edit chrome only when self-view; remove `AddPackage` import
- `scripts/sync.ts` — iterate `profiles`, drop `NPM_MAINTAINER` env
- `.github/workflows/sync.yml` — remove `NPM_MAINTAINER` repo-variable reference

**Delete:**
- `app/(app)/layout.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/` directory
- `components/dashboard/add-package.tsx`
- `components/dashboard/remove-package.tsx`
- `app/api/packages/route.ts` (and `app/api/packages/` if empty)

---

## Phase 1 — Schema migration

### Task 1.1: Write migration SQL

**Files:**
- Create: `supabase/migrations/20260524000001_v2_multi_tenant.sql`

- [ ] **Step 1: Create the file**

```sql
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
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with `name="v2_multi_tenant"` and the SQL above. Verify success in MCP response.

- [ ] **Step 3: Apply backstop seed (sfrangulov)**

Use `mcp__plugin_supabase_supabase__execute_sql` with:

```sql
update profiles set is_public = true where slug = 'sfrangulov';

insert into watchlist (user_id, package_id)
select p.user_id, pkg.id
from profiles p
cross join packages pkg
where p.slug = 'sfrangulov'
on conflict (user_id, package_id) do nothing;
```

Verify: re-query `select count(*) from watchlist where user_id = (select user_id from profiles where slug='sfrangulov');` returns 16.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260524000001_v2_multi_tenant.sql
git commit -m "feat(db): v2 multi-tenant — public-default profiles, public watchlist read, sync timestamp column"
```

---

## Phase 2 — Portfolio loader refactor

### Task 2.1: Refactor `loadPortfolio` to take a slug

**Files:**
- Modify: `lib/portfolio.ts` (entire `loadPortfolio` function)

- [ ] **Step 1: Replace `loadPortfolio` signature and body**

Replace the existing `export const loadPortfolio = cache(async (): Promise<PortfolioSnapshot> => {` block (lines 33–119) with:

```ts
/**
 * Load a maintainer's portfolio by profile slug. Throws `notFound()` if the
 * slug is unknown or the profile is private and not viewed by its owner.
 * Cached per request via React `cache()` keyed on slug+viewer.
 */
export const loadPortfolio = cache(
  async (
    slug: string,
    viewerUserId: string | null = null,
  ): Promise<PortfolioSnapshot> => {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, is_public")
      .eq("slug", slug)
      .maybeSingle();
    if (!profile) notFound();
    if (!profile.is_public && profile.user_id !== viewerUserId) notFound();

    const { data: watchlistRows } = await supabase
      .from("watchlist")
      .select("package_id")
      .eq("user_id", profile.user_id);
    const ids = (watchlistRows ?? []).map((r) => r.package_id);
    if (ids.length === 0) {
      return { packages: [], freshness: null, globalMaxDl: 0, weeklyTotals: [] };
    }

    const { data: packages } = await supabase
      .from("packages")
      .select("id, name, latest_version, last_published_at, last_synced_at")
      .in("id", ids);

    const pkgIds = (packages ?? []).map((p) => p.id);
    const [{ data: downloads }, { data: starsData }] = await Promise.all([
      supabase
        .from("download_daily")
        .select("package_id, day, downloads")
        .in("package_id", pkgIds)
        .order("day"),
      supabase
        .from("star_daily")
        .select("package_id, day, stars_total, stars_delta")
        .in("package_id", pkgIds)
        .order("day"),
    ]);

    const dlByPkg = new Map<number, { day: string; downloads: number }[]>();
    for (const row of downloads ?? []) {
      const list = dlByPkg.get(row.package_id) ?? [];
      list.push({ day: row.day, downloads: row.downloads });
      dlByPkg.set(row.package_id, list);
    }
    const starByPkg = new Map<
      number,
      { day: string; stars_total: number; stars_delta: number }[]
    >();
    for (const row of starsData ?? []) {
      const list = starByPkg.get(row.package_id) ?? [];
      list.push(row);
      starByPkg.set(row.package_id, list);
    }

    const enriched: PortfolioPackage[] = (packages ?? []).map((p) => {
      const weeks = weeklyBuckets(dlByPkg.get(p.id) ?? [], 13);
      const last = weeks.at(-1) ?? 0;
      const prev = weeks.at(-2) ?? 0;
      const starHistory = starByPkg.get(p.id) ?? [];
      const lastStar = starHistory.at(-1);
      const starsTotal = lastStar?.stars_total ?? 0;
      return {
        id: p.id,
        name: p.name,
        latestVersion: p.latest_version,
        lastPublishedAt: p.last_published_at,
        weeks,
        status: momentumStatus(last, prev),
        lastWeekDownloads: last,
        deltaDownloads: last - prev,
        starsTotal,
        deltaStars: lastStar?.stars_delta ?? 0,
        starsSeries: weeklyStars(starHistory, weeks.length),
      };
    });

    enriched.sort((a, b) => b.lastWeekDownloads - a.lastWeekDownloads);

    const allBuckets = enriched.flatMap((p) => p.weeks).filter((v) => v > 0);
    const globalMaxDl = quantile(allBuckets, 0.9);
    const weeklyTotals = sumWeekly(enriched.map((p) => p.weeks));

    const oldestSync = (packages ?? [])
      .map((p) => p.last_synced_at as string | null)
      .filter((s): s is string => Boolean(s))
      .sort()
      .at(0) ?? null;

    return {
      packages: enriched,
      freshness: relAgo(oldestSync),
      globalMaxDl,
      weeklyTotals,
    };
  },
);
```

- [ ] **Step 2: Add `notFound` import at top of file**

Change line 2 from `import { createClient } from "@/lib/supabase/server";` to:

```ts
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (Existing call sites in `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `lib/badge.ts` will now fail with «expected 1-2 arguments» — that's expected; they get fixed in later phases. Verify the error is ONLY those call sites.)

- [ ] **Step 4: Commit**

```bash
git add lib/portfolio.ts
git commit -m "refactor(portfolio): loadPortfolio(slug, viewerUserId?) — filter by watchlist, 404 unknown/private"
```

### Task 2.2: Refactor `loadBadge` to take a slug

**Files:**
- Modify: `lib/badge.ts` (the `loadBadge` function only)

- [ ] **Step 1: Replace `loadBadge` body**

Replace lines 23–46 (`export async function loadBadge(): Promise<BadgeData>` through its closing `}`) with:

```ts
export async function loadBadge(slug: string): Promise<BadgeData> {
  const snap = await loadPortfolio(slug);
  const rows: BadgeRow[] = snap.packages.slice(0, TOP_N).map((p) => {
    const tail = p.weeks.slice(-WEEKS);
    const weeks =
      tail.length < WEEKS
        ? [...new Array<number>(WEEKS - tail.length).fill(0), ...tail]
        : tail;
    return {
      name: p.name,
      weeks,
      lastWeekDownloads: p.lastWeekDownloads,
      deltaDownloads: p.deltaDownloads,
      status: p.status,
      starsTotal: p.starsTotal,
    };
  });
  return {
    rows,
    freshness: snap.freshness,
    totalPackages: snap.packages.length,
    totalWeeklyDownloads: snap.weeklyTotals.at(-1) ?? 0,
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: same call-site errors as before (now `app/badge.svg/route.ts` also fails) — these are fixed in Phase 5.

- [ ] **Step 3: Commit**

```bash
git add lib/badge.ts
git commit -m "refactor(badge): loadBadge(slug) — delegate to loadPortfolio per-slug"
```

---

## Phase 3 — Routes: `/u/[slug]` portfolio page

### Task 3.1: Create `/u/[slug]/layout.tsx`

**Files:**
- Create: `app/u/[slug]/layout.tsx`

- [ ] **Step 1: Create file**

```tsx
import { AppTopbar, type TopbarUser } from "@/components/layout/app-topbar";
import { SyncButton } from "@/components/dashboard/sync-button";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/portfolio";

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  const viewerUserId = user?.id ?? null;
  const snapshot = await loadPortfolio(slug, viewerUserId);

  const login = user?.user_metadata?.user_name as string | undefined;
  const topbarUser: TopbarUser | null = user
    ? {
        login: login ?? user.id.slice(0, 8),
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          login ??
          "",
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined) ?? null,
        isOwner: Boolean(
          process.env.OWNER_GITHUB_LOGIN &&
            login === process.env.OWNER_GITHUB_LOGIN,
        ),
      }
    : null;

  const isSelfView = Boolean(login && login === slug);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppTopbar user={topbarUser} freshness={snapshot.freshness ?? undefined} />
      <main className="grid-texture relative min-w-0 flex-1 overflow-auto scroll-thin">
        <div className="relative z-10 mx-auto max-w-[1080px] px-8 pb-16 pt-7">
          {children}
        </div>
      </main>
      {isSelfView && topbarUser?.isOwner && <SyncButton />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/u/[slug]/layout.tsx
git commit -m "feat(u/[slug]): layout — topbar + sync FAB only for owner self-view"
```

### Task 3.2: Create `/u/[slug]/page.tsx` (matrix only; chrome wired in Phase 7)

**Files:**
- Create: `app/u/[slug]/page.tsx`

- [ ] **Step 1: Create file**

```tsx
import { PackageIcon } from "@phosphor-icons/react/ssr";
import { PortfolioMatrix } from "@/components/dashboard/portfolio-matrix";
import { fmt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/portfolio";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  const login = user?.user_metadata?.user_name as string | undefined;
  const isSelfView = Boolean(login && login === slug);

  const snapshot = await loadPortfolio(slug, user?.id ?? null);
  const { packages: pkgs, weeklyTotals } = snapshot;

  const rows = pkgs.map((p) => ({
    name: p.name,
    version: p.latestVersion,
    weeks: p.weeks,
    status: p.status,
    lastWeekDownloads: p.lastWeekDownloads,
    deltaDownloads: p.deltaDownloads,
    starsTotal: p.starsTotal,
    lastPublishedAt: p.lastPublishedAt,
  }));

  const totalLast = weeklyTotals.at(-1) ?? 0;
  const totalPrev = weeklyTotals.at(-2) ?? 0;
  const totalRatio = totalPrev > 0 ? (totalLast - totalPrev) / totalPrev : 0;
  const rising = rows.filter((r) => r.status === "up").length;
  const falling = rows.filter((r) => r.status === "dn").length;
  const flat = rows.length - rising - falling;

  return (
    <>
      <header className="mono flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        <span className="text-foreground/80">{rows.length} packages</span>
        <span>
          Σ <span className="text-foreground/80">{fmt(totalLast)}</span> dl/wk
        </span>
        <span className={totalRatio >= 0 ? "text-success" : "text-destructive"}>
          {totalRatio >= 0 ? "+" : "−"}
          {Math.abs(totalRatio * 100).toFixed(1)}% w/w
        </span>
        <span>
          <span className="text-success">{rising}↑</span>{" "}
          <span className="text-destructive">{falling}↓</span>{" "}
          <span>{flat}·</span>
        </span>
        <span className="ml-auto text-foreground/60">/u/{slug}</span>
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-[calc(var(--radius)*2)] border border-dashed border-border/70 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageIcon className="size-6" weight="regular" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base">no npm packages found</h2>
            <p className="max-w-[42ch] text-sm text-muted-foreground">
              {isSelfView
                ? `ephemeris looks for packages where '${slug}' is an npm maintainer. if your github login differs from your npm username, this is the expected state for now.`
                : `nothing tracked for ${slug} yet.`}
            </p>
          </div>
        </div>
      ) : (
        <PortfolioMatrix rows={rows} />
      )}
    </>
  );
}
```

Note: edit chrome (`PublicToggle`, `CopyBadge`) is wired in Task 7.4 once those components exist.

- [ ] **Step 2: Verify route compiles**

Run: `npx tsc --noEmit`
Expected: errors only on `PublicToggle` and `CopyBadge` (not yet created — added in Phase 7) and on `app/(app)/*` (deleted later).

- [ ] **Step 3: Commit**

```bash
git add app/u/[slug]/page.tsx
git commit -m "feat(u/[slug]): portfolio page — matrix + self-view edit chrome stubs"
```

### Task 3.3: Browser-verify `/u/sfrangulov` renders

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Wait until «Ready in …ms». Note: `app/page.tsx` may 500 at this point (still references old code) — that's fine.

- [ ] **Step 2: Open `http://localhost:3000/u/sfrangulov`**

Use Playwright MCP: `mcp__plugin_playwright_playwright__browser_navigate` to `http://localhost:3000/u/sfrangulov`.

Expected: matrix renders with 16 packages, freshness pill in topbar, no edit chrome (anon).

- [ ] **Step 3: Visit unknown slug**

Navigate to `http://localhost:3000/u/does-not-exist`.
Expected: Next.js 404 page.

- [ ] **Step 4: Stop dev server**

---

## Phase 4 — `/dashboard` redirect

### Task 4.1: Delete `app/(app)/` (the old `/dashboard` route)

**Files:**
- Delete: `app/(app)/layout.tsx`
- Delete: `app/(app)/dashboard/page.tsx`
- Delete: `app/(app)/` directory

- [ ] **Step 1: Remove directory**

Run: `rm -rf "app/(app)"`

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: errors should reduce. (Remaining errors are limited to `AddPackage`/`app/api/packages` and the old `app/badge.svg/route.ts` call sites — fixed in later phases.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(app): drop (app) route group — replaced by /u/[slug]"
```

### Task 4.2: Create `app/dashboard/page.tsx` as redirect shim

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create file**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardRedirect() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const login = auth?.user?.user_metadata?.user_name as string | undefined;
  if (!login) redirect("/login");
  redirect(`/u/${login}`);
}
```

- [ ] **Step 2: Browser-verify**

With dev server running, navigate to `http://localhost:3000/dashboard` (anon — log out if needed). Expected: redirect to `/login`. Log in and navigate again — expected redirect to `/u/sfrangulov`.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(dashboard): redirect shim → /u/[slug] or /login"
```

---

## Phase 5 — Badge per-slug

### Task 5.1: Create `/badge/[slug].svg` route

**Files:**
- Create: `app/badge/[slug].svg/route.ts`

- [ ] **Step 1: Create directory and file**

Run: `mkdir -p "app/badge/[slug].svg"`

Then create `app/badge/[slug].svg/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  COLORS,
  dotColor,
  dotSize,
  fmtCompact,
  loadBadge,
  signedCompact,
} from "@/lib/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 760;
const H = 250;
const PAD_X = 18;
const HEADER_H = 46;
const ROW_H = 30;
const FOOTER_H = 26;
const NAME_W = 200;
const WEEKS_W = 252;
const NUM_W = 56;
const DELTA_W = 56;
const STAR_W = 56;
const GAP = 10;
const NAME_X = PAD_X;
const WEEKS_X = NAME_X + NAME_W;
const WEEKS_SLOT = WEEKS_W / 7;
const NUM_X = WEEKS_X + WEEKS_W + GAP;
const DELTA_X = NUM_X + NUM_W + GAP;
const STAR_X = DELTA_X + DELTA_W + GAP;
const DOT_SCALE = 1.6;
const FONT =
  "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, monospace";

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === "&") return "&amp;";
    if (c === '"') return "&quot;";
    return c;
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { rows, freshness, totalPackages, totalWeeklyDownloads } =
    await loadBadge(slug);

  const cells = rows
    .map((r, ri) => {
      const y = HEADER_H + ri * ROW_H + ROW_H / 2;
      const baselineY = y + 4;
      const dots = r.weeks
        .map((dl, i, arr) => {
          const cx = WEEKS_X + WEEKS_SLOT * i + WEEKS_SLOT / 2;
          if (dl <= 0) {
            return `<circle cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${COLORS.muted}" opacity="0.2"/>`;
          }
          const d = dotSize(dl, DOT_SCALE);
          const color = dotColor(dl, arr[i - 1]);
          return `<circle cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" r="${(d / 2).toFixed(1)}" fill="${color}" opacity="0.85"/>`;
        })
        .join("");
      const deltaColor =
        r.status === "up"
          ? COLORS.success
          : r.status === "dn"
            ? COLORS.destructive
            : COLORS.muted;
      return [
        `<text x="${NAME_X}" y="${baselineY}" font-size="12" fill="${COLORS.fg}">${escapeXml(r.name)}</text>`,
        dots,
        `<text x="${NUM_X + NUM_W}" y="${baselineY}" font-size="12" fill="${COLORS.fg}" text-anchor="end">${fmtCompact(r.lastWeekDownloads)}</text>`,
        `<text x="${DELTA_X + DELTA_W}" y="${baselineY}" font-size="12" fill="${deltaColor}" text-anchor="end">${signedCompact(r.deltaDownloads)}</text>`,
        `<text x="${STAR_X + STAR_W}" y="${baselineY}" font-size="12" fill="${COLORS.muted}" text-anchor="end">★ ${fmtCompact(r.starsTotal)}</text>`,
      ].join("");
    })
    .join("\n  ");

  const headerSummary = `${totalPackages} pkgs · Σ ${fmtCompact(totalWeeklyDownloads)} dl/wk`;
  const tableTop = HEADER_H - 8;
  const footerY = H - FOOTER_H;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <rect width="${W}" height="${H}" fill="${COLORS.bg}"/>
  <circle cx="${PAD_X + 6}" cy="22" r="5" fill="${COLORS.success}"/>
  <text x="${PAD_X + 18}" y="26" font-size="14" font-weight="700" fill="${COLORS.fg}">ephemeris/${escapeXml(slug)}</text>
  <text x="${W - PAD_X}" y="26" font-size="11" fill="${COLORS.muted}" text-anchor="end">${escapeXml(headerSummary)}</text>
  <line x1="0" y1="${tableTop}" x2="${W}" y2="${tableTop}" stroke="${COLORS.border}"/>
  ${cells}
  <line x1="0" y1="${footerY}" x2="${W}" y2="${footerY}" stroke="${COLORS.border}"/>
  <text x="${PAD_X}" y="${H - 8}" font-size="10" fill="${COLORS.faint}">ephemeris-dev.vercel.app/u/${escapeXml(slug)}</text>
  <text x="${W - PAD_X}" y="${H - 8}" font-size="10" fill="${COLORS.faint}" text-anchor="end">${escapeXml(freshness ?? "")}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
```

- [ ] **Step 2: Browser-verify**

Start `npm run dev`, then with Playwright MCP navigate to `http://localhost:3000/badge/sfrangulov.svg`. Expected: SVG renders showing sfrangulov's top-5 packages with «ephemeris/sfrangulov» header. If Next 16 doesn't accept the `[slug].svg` directory name, fallback: rename to `app/badge/[slug]/route.ts` and accept that URLs become `/badge/sfrangulov` (Content-Type still SVG; works in GitHub markdown).

- [ ] **Step 3: Commit**

```bash
git add "app/badge/[slug].svg"
git commit -m "feat(badge): /badge/[slug].svg — per-maintainer portfolio badge"
```

### Task 5.2: Convert old `/badge.svg` to 301 redirect

**Files:**
- Modify: `app/badge.svg/route.ts` (replace entire body)

- [ ] **Step 1: Replace file contents**

```ts
import { permanentRedirect } from "next/navigation";

export const runtime = "nodejs";

export function GET() {
  permanentRedirect("/badge/sfrangulov.svg");
}
```

- [ ] **Step 2: Browser-verify**

Navigate to `http://localhost:3000/badge.svg`. Expected: 301 redirect to `/badge/sfrangulov.svg`, SVG renders.

- [ ] **Step 3: Commit**

```bash
git add app/badge.svg/route.ts
git commit -m "feat(badge): 301 /badge.svg → /badge/sfrangulov.svg (keep legacy embeds alive)"
```

---

## Phase 6 — Marketing root `/`

### Task 6.1: Replace `app/page.tsx` with marketing teaser

**Files:**
- Modify: `app/page.tsx` (replace entire file)

- [ ] **Step 1: Read the current file to record what's being replaced**

Run: `cat app/page.tsx` (just to confirm — file is short, currently a redirect or theme-check stub).

- [ ] **Step 2: Replace file**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortfolioMatrix } from "@/components/dashboard/portfolio-matrix";
import { fmt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/portfolio";

const DEMO_SLUG = "sfrangulov";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const login = auth?.user?.user_metadata?.user_name as string | undefined;
  if (login) redirect(`/u/${login}`);

  const snapshot = await loadPortfolio(DEMO_SLUG);
  const rows = snapshot.packages.map((p) => ({
    name: p.name,
    version: p.latestVersion,
    weeks: p.weeks,
    status: p.status,
    lastWeekDownloads: p.lastWeekDownloads,
    deltaDownloads: p.deltaDownloads,
    starsTotal: p.starsTotal,
    lastPublishedAt: p.lastPublishedAt,
  }));
  const totalLast = snapshot.weeklyTotals.at(-1) ?? 0;

  return (
    <main className="grid-texture relative min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-[1080px] px-8 py-12">
        <header className="flex items-baseline justify-between">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-full bg-success" />
            <div className="text-[13px] font-bold lowercase tracking-[0.04em]">
              ephemeris
            </div>
            <span className="ml-2 text-[11px] text-muted-foreground">
              observatory for npm portfolios
            </span>
          </div>
          <Link
            href="/login"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            sign in with github →
          </Link>
        </header>

        <p className="mt-6 max-w-[60ch] text-sm text-muted-foreground">
          daily download counts and github stars for a maintainer's packages,
          with weekly momentum. one row per package, sorted by traffic. embed
          the badge in your readme.
        </p>

        <section className="mt-10">
          <div className="mono mb-3 flex items-baseline gap-4 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <span className="text-foreground/80">/u/{DEMO_SLUG}</span>
            <span>{rows.length} packages</span>
            <span>Σ {fmt(totalLast)} dl/wk</span>
            <span className="ml-auto text-foreground/60">live demo</span>
          </div>
          {rows.length > 0 && <PortfolioMatrix rows={rows} />}
        </section>

        <footer className="mt-12 flex items-center gap-6 border-t border-border/40 pt-6 text-[11px] text-muted-foreground/70">
          <Link href={`/u/${DEMO_SLUG}`} className="hover:text-foreground">
            view /u/{DEMO_SLUG}
          </Link>
          <a
            href="https://github.com/sfrangulov/ephemeris"
            className="hover:text-foreground"
          >
            source
          </a>
          <span className="ml-auto">read-only public data</span>
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Browser-verify**

Restart dev server. Navigate to `http://localhost:3000/`. Expected: marketing teaser renders with embedded demo matrix; no auth required.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(root): marketing teaser with /u/sfrangulov live demo"
```

---

## Phase 7 — Edit chrome on self-view

### Task 7.1: Create `/api/profile` POST endpoint

**Files:**
- Create: `app/api/profile/route.ts`

- [ ] **Step 1: Create file**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { is_public?: boolean };
  if (typeof body.is_public !== "boolean") {
    return NextResponse.json({ error: "is_public boolean required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("profiles")
    .update({ is_public: body.is_public })
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/profile/route.ts
git commit -m "feat(api/profile): POST toggle is_public for current user"
```

### Task 7.2: Create `PublicToggle` component

**Files:**
- Create: `components/dashboard/public-toggle.tsx`

- [ ] **Step 1: Create file**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PublicToggle({
  slug,
  initialPublic,
}: {
  slug: string;
  initialPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const next = !isPublic;
    setIsPublic(next);
    startTransition(async () => {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_public: next }),
      });
      if (!r.ok) {
        setIsPublic(!next);
        return;
      }
      router.refresh();
    });
  }

  void slug; // explicit: slug is passed for future per-profile context, currently unused

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="flex items-center gap-2 transition-colors hover:text-foreground disabled:opacity-50"
    >
      <span
        className={`size-[7px] rounded-full ${isPublic ? "bg-success" : "bg-muted-foreground/40"}`}
      />
      profile {isPublic ? "public" : "private"} · toggle
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/public-toggle.tsx
git commit -m "feat(toggle): client toggle for profile.is_public"
```

### Task 7.3: Create `CopyBadge` component

**Files:**
- Create: `components/dashboard/copy-badge.tsx`

- [ ] **Step 1: Create file**

```tsx
"use client";

import { useState } from "react";
import { ClipboardIcon, CheckIcon } from "@phosphor-icons/react";

export function CopyBadge({ origin, slug }: { origin: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `[![ephemeris](${origin}/badge/${slug}.svg)](${origin}/u/${slug})`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 transition-colors hover:text-foreground"
    >
      {copied ? (
        <CheckIcon className="size-3" weight="bold" />
      ) : (
        <ClipboardIcon className="size-3" weight="regular" />
      )}
      {copied ? "copied" : "copy badge markdown"}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/copy-badge.tsx
git commit -m "feat(badge): copy-markdown button for self-view"
```

### Task 7.4: Wire edit chrome into `/u/[slug]/page.tsx`

**Files:**
- Modify: `app/u/[slug]/page.tsx`

- [ ] **Step 1: Add imports at top of file**

After the `import { loadPortfolio } from "@/lib/portfolio";` line, add:

```ts
import { headers } from "next/headers";
import { PublicToggle } from "@/components/dashboard/public-toggle";
import { CopyBadge } from "@/components/dashboard/copy-badge";
```

- [ ] **Step 2: Add `profile` fetch + `origin` derivation**

Inside `ProfilePage`, after the `const { packages: pkgs, weeklyTotals } = snapshot;` line and before `const rows = pkgs.map(...)`, insert:

```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("is_public")
  .eq("slug", slug)
  .single();

const host = (await headers()).get("host") ?? "ephemeris-dev.vercel.app";
const proto = host.startsWith("localhost") ? "http" : "https";
const origin = `${proto}://${host}`;
```

- [ ] **Step 3: Render the chrome section**

At the end of the JSX, BEFORE the closing `</>`, add:

```tsx
{isSelfView && (
  <section className="mono mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/40 pt-6 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
    <PublicToggle slug={slug} initialPublic={profile?.is_public ?? true} />
    <CopyBadge origin={origin} slug={slug} />
  </section>
)}
```

- [ ] **Step 4: Browser-verify**

Restart dev server. Log in as sfrangulov. Navigate to `http://localhost:3000/u/sfrangulov`. Expected: edit chrome section appears below matrix with public-toggle and copy-badge. Click toggle → see «private» state; reload — confirm persists in DOM. Open `/u/sfrangulov` in incognito (anon) — confirm 404 (because private). Toggle back to public via owner session. Click copy → see «copied» state, paste anywhere to verify snippet matches `[![ephemeris](http://localhost:3000/badge/sfrangulov.svg)](http://localhost:3000/u/sfrangulov)`.

- [ ] **Step 5: Commit**

```bash
git add app/u/[slug]/page.tsx
git commit -m "feat(u/[slug]): wire public-toggle + copy-badge chrome into self-view"
```

### Task 7.5: Remove `AddPackage` from topbar

**Files:**
- Modify: `components/layout/app-topbar.tsx` (remove lines referencing AddPackage)

- [ ] **Step 1: Edit file**

Remove line 3 (`import { AddPackage } from "@/components/dashboard/add-package";`).
Remove line 34 (`{user?.isOwner && <AddPackage />}`).

- [ ] **Step 2: Commit**

```bash
git add components/layout/app-topbar.tsx
git commit -m "chore(topbar): drop AddPackage — watchlist is auto-only in v2"
```

---

## Phase 8 — Sync pipeline refactor

### Task 8.1: Rewrite `scripts/sync.ts` to iterate profiles

**Files:**
- Modify: `scripts/sync.ts` (replace `main` function)

- [ ] **Step 1: Replace the file contents**

```ts
/**
 * Unified portfolio sync (GitHub Actions worker). For each profile:
 *   1. discover packages from npm by maintainer = profile.slug
 *   2. register new packages, link them in that user's watchlist
 * Then globally (all known packages):
 *   3. downloads + registry meta + current stars
 *   4. one-time stargazer-history backfill for backfill_status='pending'
 *
 * Runs outside Next (no serverless timeout). Idempotent via composite-PK
 * upserts. Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GITHUB_TOKEN.
 * Local: `set -a; . ./.env.local; set +a; npx tsx scripts/sync.ts`
 */
import { createAdminClient } from "../lib/supabase/admin";
import {
  fetchPackagesByMaintainer,
  fetchDownloadsRange,
  fetchPackageMeta,
} from "../lib/npm";
import { fetchRepoStats, backfillStargazers } from "../lib/github";
import { starDailyFromTimestamps } from "../lib/aggregate";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  const supabase = createAdminClient();

  // 1+2. Per-profile discovery and watchlist linking.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("user_id, slug");
  if (profErr) throw new Error(`profiles: ${profErr.message}`);
  console.log(`iterating ${profiles?.length ?? 0} profiles`);

  for (const profile of profiles ?? []) {
    try {
      const names = await fetchPackagesByMaintainer(profile.slug);
      if (names.length === 0) {
        console.log(`discovered 0 packages for ${profile.slug}`);
        continue;
      }
      console.log(`discovered ${names.length} packages for ${profile.slug}`);
      await supabase.from("packages").upsert(
        names.map((name) => ({ name })),
        { onConflict: "name", ignoreDuplicates: true },
      );
      const { data: pkgRows } = await supabase
        .from("packages")
        .select("id, name")
        .in("name", names);
      const links = (pkgRows ?? []).map((p) => ({
        user_id: profile.user_id,
        package_id: p.id,
      }));
      if (links.length) {
        await supabase
          .from("watchlist")
          .upsert(links, { onConflict: "user_id,package_id", ignoreDuplicates: true });
      }
    } catch (e) {
      console.error(`discovery ${profile.slug}: ${String(e)}`);
    }
  }

  // 3. Downloads + metadata + current stars for ALL packages.
  const { data: packages, error: pkgErr } = await supabase
    .from("packages")
    .select("*");
  if (pkgErr) throw new Error(pkgErr.message);

  const now = new Date();
  const to = isoDate(now);
  const from = isoDate(new Date(now.getTime() - 40 * 86_400_000));

  for (const pkg of packages ?? []) {
    try {
      try {
        const points = await fetchDownloadsRange(pkg.name, from, to);
        const rows = points
          .filter((p) => p.downloads != null)
          .map((p) => ({
            package_id: pkg.id,
            day: p.day,
            downloads: p.downloads,
          }));
        if (rows.length) {
          await supabase
            .from("download_daily")
            .upsert(rows, { onConflict: "package_id,day" });
        }
      } catch (e) {
        if (!String(e).includes("404")) throw e;
      }

      const meta = await fetchPackageMeta(pkg.name);
      const update: Record<string, unknown> = {
        latest_version: meta.latestVersion,
        last_published_at: meta.lastPublishedAt,
        last_synced_at: now.toISOString(),
      };
      if (meta.repo) {
        update.repo_owner = meta.repo.owner;
        update.repo_name = meta.repo.repo;
        if (pkg.backfill_status === "none") update.backfill_status = "pending";
      }
      await supabase.from("packages").update(update).eq("id", pkg.id);

      const owner = meta.repo?.owner ?? pkg.repo_owner;
      const repo = meta.repo?.repo ?? pkg.repo_name;
      if (owner && repo && githubToken) {
        const stats = await fetchRepoStats(owner, repo, githubToken);
        const { data: prior } = await supabase
          .from("star_daily")
          .select("stars_total")
          .eq("package_id", pkg.id)
          .lt("day", to)
          .order("day", { ascending: false })
          .limit(1)
          .maybeSingle();
        const prevTotal = prior?.stars_total ?? 0;
        await supabase.from("star_daily").upsert(
          {
            package_id: pkg.id,
            day: to,
            stars_total: stats.stars,
            stars_delta: stats.stars - prevTotal,
          },
          { onConflict: "package_id,day" },
        );
      }
      console.log(`synced ${pkg.name}`);
    } catch (e) {
      console.error(`sync ${pkg.name}: ${String(e)}`);
    }
  }

  // 4. One-time star-history backfill for newly-resolved repos.
  if (!githubToken) {
    console.warn("no GITHUB_TOKEN: skipping star backfill");
    return;
  }
  const { data: pending } = await supabase
    .from("packages")
    .select("id, name, repo_owner, repo_name")
    .eq("backfill_status", "pending")
    .not("repo_owner", "is", null)
    .not("repo_name", "is", null);
  for (const pkg of pending ?? []) {
    try {
      const { timestamps, truncated } = await backfillStargazers(
        pkg.repo_owner!,
        pkg.repo_name!,
        githubToken,
      );
      const rows = starDailyFromTimestamps(timestamps).map((r) => ({
        package_id: pkg.id,
        ...r,
      }));
      if (rows.length) {
        await supabase
          .from("star_daily")
          .upsert(rows, { onConflict: "package_id,day" });
      }
      await supabase
        .from("packages")
        .update({ backfill_status: truncated ? "truncated" : "done" })
        .eq("id", pkg.id);
      console.log(
        `backfilled ${pkg.name}: ${rows.length} star-days${truncated ? " (truncated)" : ""}`,
      );
    } catch (e) {
      console.error(`backfill ${pkg.name}: ${String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Local dry-run**

Run: `set -a; . ./.env.local; set +a; npx tsx scripts/sync.ts 2>&1 | head -60`
Expected: log line «iterating N profiles», «discovered K packages for sfrangulov», then per-package sync logs. No errors.

- [ ] **Step 3: Update sync.yml to drop NPM_MAINTAINER**

Open `.github/workflows/sync.yml`. Remove any line passing `NPM_MAINTAINER:` to the script step. If the file references it as a repo-variable, delete that reference.

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: 29 passing tests (unchanged).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.ts .github/workflows/sync.yml
git commit -m "feat(sync): iterate profiles instead of single NPM_MAINTAINER env"
```

---

## Phase 9 — Auth callback bootstrap

### Task 9.1: Add inline bootstrap to `auth/callback`

**Files:**
- Modify: `app/auth/callback/route.ts` (replace entire file)

- [ ] **Step 1: Replace file**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchPackagesByMaintainer,
  fetchDownloadsRange,
  fetchPackageMeta,
} from "@/lib/npm";
import { fetchRepoStats } from "@/lib/github";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * OAuth callback. Exchanges code for session, ensures a profile row,
 * runs a lightweight first-sync (discovery + recent downloads + current
 * stars, no stargazer backfill), then redirects to /u/[slug].
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchErr) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const slug =
    (user.user_metadata?.user_name as string | undefined) ?? user.id.slice(0, 8);

  // 1. ensure profile exists
  await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, slug },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  // 2. lightweight bootstrap sync (best-effort; failures don't block redirect)
  try {
    await bootstrapSync(user.id, slug);
  } catch (e) {
    console.error(`bootstrap ${slug}: ${String(e)}`);
  }

  return NextResponse.redirect(`${origin}/u/${slug}`);
}

async function bootstrapSync(userId: string, slug: string) {
  const admin = createAdminClient();
  const githubToken = process.env.GITHUB_TOKEN;

  const names = await fetchPackagesByMaintainer(slug);
  if (names.length === 0) return;

  await admin
    .from("packages")
    .upsert(names.map((name) => ({ name })), {
      onConflict: "name",
      ignoreDuplicates: true,
    });

  const { data: pkgRows } = await admin
    .from("packages")
    .select("id, name, repo_owner, repo_name, backfill_status")
    .in("name", names);
  const pkgs = pkgRows ?? [];

  if (pkgs.length) {
    await admin.from("watchlist").upsert(
      pkgs.map((p) => ({ user_id: userId, package_id: p.id })),
      { onConflict: "user_id,package_id", ignoreDuplicates: true },
    );
  }

  const now = new Date();
  const to = isoDate(now);
  const from = isoDate(new Date(now.getTime() - 40 * 86_400_000));

  for (const pkg of pkgs) {
    try {
      try {
        const points = await fetchDownloadsRange(pkg.name, from, to);
        const rows = points
          .filter((p) => p.downloads != null)
          .map((p) => ({ package_id: pkg.id, day: p.day, downloads: p.downloads }));
        if (rows.length) {
          await admin
            .from("download_daily")
            .upsert(rows, { onConflict: "package_id,day" });
        }
      } catch (e) {
        if (!String(e).includes("404")) throw e;
      }

      const meta = await fetchPackageMeta(pkg.name);
      const update: Record<string, unknown> = {
        latest_version: meta.latestVersion,
        last_published_at: meta.lastPublishedAt,
        last_synced_at: now.toISOString(),
      };
      if (meta.repo) {
        update.repo_owner = meta.repo.owner;
        update.repo_name = meta.repo.repo;
        if (pkg.backfill_status === "none") update.backfill_status = "pending";
      }
      await admin.from("packages").update(update).eq("id", pkg.id);

      const owner = meta.repo?.owner ?? pkg.repo_owner;
      const repo = meta.repo?.repo ?? pkg.repo_name;
      if (owner && repo && githubToken) {
        const stats = await fetchRepoStats(owner, repo, githubToken);
        await admin.from("star_daily").upsert(
          {
            package_id: pkg.id,
            day: to,
            stars_total: stats.stars,
            stars_delta: stats.stars,
          },
          { onConflict: "package_id,day" },
        );
      }
    } catch (e) {
      console.error(`bootstrap ${pkg.name}: ${String(e)}`);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat(auth): inline bootstrap sync on first login, redirect to /u/[slug]"
```

### Task 9.2: Browser end-to-end test

- [ ] **Step 1: Local sign-in flow (sfrangulov)**

Start dev server. Open `http://localhost:3000/login`. Sign in via GitHub. Expected: redirect to `http://localhost:3000/u/sfrangulov` with populated matrix. Console shows no bootstrap errors.

- [ ] **Step 2: Logout, re-login — confirm idempotent**

Log out (via UserMenu). Sign in again. Expected: same redirect, no duplicate package rows, no errors.

- [ ] **Step 3: Test with empty-maintainer fake account (optional)**

If a second GitHub account is available with no npm packages, sign in. Expected: redirect to `/u/[their-login]` with empty-state explainer rendered.

---

## Phase 10 — Cleanup

### Task 10.1: Delete unused files

**Files:**
- Delete: `components/dashboard/add-package.tsx`
- Delete: `components/dashboard/remove-package.tsx`
- Delete: `app/api/packages/route.ts`
- Delete: `app/api/packages/` directory if empty

- [ ] **Step 1: Verify no remaining references**

Run: `grep -rn "AddPackage\|RemovePackage\|api/packages" --include="*.ts" --include="*.tsx" .`
Expected: no results (all imports already removed in earlier tasks).

- [ ] **Step 2: Delete files**

Run:
```bash
rm components/dashboard/add-package.tsx
rm components/dashboard/remove-package.tsx
rm -rf app/api/packages
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove single-owner add/remove/api-packages — superseded by auto watchlist"
```

### Task 10.2: Update login copy

**Files:**
- Modify: `app/(auth)/login/page.tsx` (line 49–51)

- [ ] **Step 1: Edit copy**

Replace:
```tsx
        <p className="mt-1 text-[11px] text-muted-foreground">
          npm downloads and github stars for one maintainer&rsquo;s portfolio.
        </p>
```
with:
```tsx
        <p className="mt-1 text-[11px] text-muted-foreground">
          npm downloads and github stars for your packages. one row per package.
        </p>
```

- [ ] **Step 2: Commit**

```bash
git add app/(auth)/login/page.tsx
git commit -m "chore(login): copy update — multi-user framing"
```

### Task 10.3: Final verification suite

- [ ] **Step 1: Full typecheck + build + tests**

Run:
```bash
npx tsc --noEmit
npm run build
npm test
```
Expected: all green, 29 tests passing.

- [ ] **Step 2: Browser smoke tests with dev server**

Start `npm run dev`. Walk through (Playwright MCP):
1. `/` — marketing teaser + demo matrix renders.
2. `/u/sfrangulov` — 16-package matrix renders, no edit chrome (anon).
3. `/u/does-not-exist` — Next 404.
4. `/badge/sfrangulov.svg` — SVG renders.
5. `/badge.svg` — redirects to `/badge/sfrangulov.svg`.
6. `/dashboard` (anon) — redirects to `/login`.
7. Log in → land on `/u/sfrangulov` with edit chrome (toggle + copy + sync FAB) visible.
8. Toggle public→private, reload — verify state persists; reload again as anon — confirm 404; toggle back via owner session.
9. Click copy badge — confirm clipboard has correct markdown snippet.
10. Click sync FAB — confirm `/api/sync` POST returns 200, workflow dispatched.

- [ ] **Step 3: Deploy to Vercel preview**

Run: `vercel`
Expected: preview URL. Repeat smoke tests 1–6 against the preview (steps 7–10 require GitHub OAuth which may need callback URL update for preview).

- [ ] **Step 4: Promote to production**

Run: `vercel --prod`
Expected: prod URL. Repeat smoke tests 1–9 against prod. Step 10 should work since OAuth callback is configured for prod.

- [ ] **Step 5: Delete `NPM_MAINTAINER` repo variable**

In GitHub repo settings → Actions → Variables, delete `NPM_MAINTAINER`. (Script no longer reads it; this removes the dead config.)

- [ ] **Step 6: Tag release**

```bash
git tag v2.0.0-multi-tenant
git push origin v2.0.0-multi-tenant
```

---

## Acceptance verification (from spec §Acceptance)

After Phase 10:

1. ✅ A non-sfrangulov user can sign in with GitHub and see their portfolio at `/u/[their-login]` — verified by Task 9.2 step 3.
2. ✅ `/u/[their-login]` publicly accessible (`is_public=true` default + Phase 1 RLS) — verified by Task 10.3 step 2.
3. ✅ `/u/sfrangulov` matches the old `/dashboard` data (loadPortfolio with sfrangulov watchlist = 16 packages from backstop seed) — Task 3.3 + 10.3.
4. ✅ `/dashboard` and `/badge.svg` redirect — Tasks 4.1, 5.2, 10.3.
5. ✅ 6h cron iterates all profiles — Task 8.1 step 2.
6. ✅ `OWNER_GITHUB_LOGIN` gates only the sync FAB — Phase 7 isolated this; Task 3.1 conditional render.

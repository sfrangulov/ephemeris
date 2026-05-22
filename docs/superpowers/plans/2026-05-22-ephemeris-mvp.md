# ephemeris MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dark-only npm portfolio dashboard (downloads + stars history with momentum deltas) with GitHub-auth portfolios and public read-only sharing.

**Architecture:** Next.js App Router on Vercel + Supabase (Postgres/Auth/RLS). Daily snapshot via Vercel Cron; one-time star-history backfill via GitHub Actions writing to Supabase with the service-role key. Pure ingestion logic lives in tested `lib/` modules.

**Tech Stack:** Next.js, TypeScript, shadcn/ui + Recharts, Supabase JS, Vitest, Geist fonts. Design language: Palantir Blueprint v5 (dark only) — see `docs/superpowers/specs/2026-05-22-ephemeris-design.md` and `docs/design/mockup-dashboard.html`.

**Execution skills to load at build time (NOT before):** `vercel:nextjs`, `vercel:shadcn`, `vercel:react-best-practices`, `impeccable` (for UI tasks).

---

## File Structure

```
app/
  (auth)/login/page.tsx          # GitHub OAuth entry
  (app)/layout.tsx               # shell: <AppSidebar/> + <main>
  (app)/dashboard/page.tsx       # portfolio overview (server component)
  u/[slug]/page.tsx              # public read-only dashboard
  api/cron/snapshot/route.ts     # Vercel Cron daily snapshot
  api/packages/route.ts          # add/remove package to watchlist
  globals.css                    # Blueprint v5 dark tokens + helpers
components/
  layout/app-sidebar.tsx
  dashboard/stat-strip.tsx
  dashboard/package-grid.tsx
  dashboard/package-card.tsx     # layout B (dl area + stars line)
  dashboard/dual-chart.tsx       # Recharts dl+stars
lib/
  npm.ts                         # downloads + metadata fetchers
  github.ts                      # repo stats + stargazer backfill
  aggregate.ts                   # weekly buckets, status, day-bucketing  (PURE, TDD)
  supabase/server.ts             # server client
  supabase/admin.ts              # service-role client (jobs only)
supabase/migrations/             # SQL migrations
scripts/backfill.ts              # GitHub Actions worker entry
.github/workflows/backfill.yml
__tests__/                       # Vitest
```

---

## Milestone M0 — Scaffold & infra

### Task 0.1: Next.js + TypeScript + Vitest scaffold

**Files:** project root.

- [ ] **Step 1: Create app**

Run:
```bash
cd ~/projects/ephemeris
npx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir=false --import-alias "@/*" --no-turbopack
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true },
  resolve: { alias: { "@": new URL("./", import.meta.url).pathname } },
});
```

- [ ] **Step 3: Add test script** to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Verify** `npm test` runs (0 tests) and `npm run build` succeeds.

- [ ] **Step 5: Commit** `chore: scaffold next + vitest`.

### Task 0.2: shadcn/ui + Geist + Blueprint v5 dark tokens

**Files:** Create `globals.css`; `app/layout.tsx`.

- [ ] **Step 1: Init shadcn**: `npx shadcn@latest init` (dark base color), then `npx shadcn@latest add card button chart`.
- [ ] **Step 2: Install Geist**: `npm i geist`. Wire `GeistSans`/`GeistMono` in `app/layout.tsx`, add `className="dark"` to `<html>` (dark only — no theme toggle).
- [ ] **Step 3:** Paste the dark `:root.dark` OKLCH token block + `glass-card`, `grid-texture`, scrollbar, `fade-up`/`stagger` helpers from the spec §7 into `globals.css`. Set `--radius: 0.2rem`; headings `letter-spacing: -0.03em; font-weight: 600`.
- [ ] **Step 4: Verify** a throwaway `<div className="glass-card">` renders on dark bg with correct card color. Remove throwaway.
- [ ] **Step 5: Commit** `feat: blueprint v5 dark theme + geist`.

### Task 0.3: Supabase project + clients + env

- [ ] **Step 1:** Create Supabase project (dashboard). Capture `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Add to `.env.local` and Vercel env. Add `CRON_SECRET` (random).
- [ ] **Step 2:** `npm i @supabase/supabase-js @supabase/ssr`.
- [ ] **Step 3:** Create `lib/supabase/server.ts` (cookie-based SSR client) and `lib/supabase/admin.ts` (service-role client; throw if used in browser).
- [ ] **Step 4: Commit** `feat: supabase clients + env`.

---

## Milestone M1 — Data model & RLS

### Task 1.1: Core tables migration

**Files:** Create `supabase/migrations/0001_init.sql`.

- [ ] **Step 1: Write SQL** (tables per spec §5):

```sql
create table packages (
  id bigint generated always as identity primary key,
  name text unique not null,
  repo_owner text, repo_name text,
  latest_version text, last_published_at timestamptz,
  backfill_status text not null default 'none'
    check (backfill_status in ('none','pending','done','truncated')),
  created_at timestamptz default now(),
  last_synced_at timestamptz
);
create table download_daily (
  package_id bigint references packages(id) on delete cascade,
  day date not null, downloads int not null,
  primary key (package_id, day)
);
create table star_daily (
  package_id bigint references packages(id) on delete cascade,
  day date not null, stars_total int not null, stars_delta int not null,
  primary key (package_id, day)
);
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug text unique not null, is_public boolean not null default false
);
create table watchlist (
  user_id uuid references auth.users(id) on delete cascade,
  package_id bigint references packages(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (user_id, package_id)
);
```

- [ ] **Step 2: Apply** via Supabase SQL editor or `supabase db push`. Verify tables exist.
- [ ] **Step 3: Commit** `feat: core schema`.

### Task 1.2: RLS policies migration

**Files:** Create `supabase/migrations/0002_rls.sql`.

- [ ] **Step 1: Write SQL** — `packages/download_daily/star_daily` = public read, service-role write; `watchlist/profiles` = owner-only, plus public read of `profiles` where `is_public`:

```sql
alter table packages enable row level security;
alter table download_daily enable row level security;
alter table star_daily enable row level security;
alter table watchlist enable row level security;
alter table profiles enable row level security;

create policy "public read" on packages for select using (true);
create policy "public read" on download_daily for select using (true);
create policy "public read" on star_daily for select using (true);

create policy "own watchlist" on watchlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public profile read" on profiles for select
  using (is_public = true);
```
(Writes to shared tables happen via service-role, which bypasses RLS.)

- [ ] **Step 2: Apply + verify** anon can select packages, cannot insert.
- [ ] **Step 3: Commit** `feat: rls policies`.

---

## Milestone M2 — Ingestion library (PURE LOGIC, full TDD)

### Task 2.1: `aggregate.ts` — weekly buckets + status

**Files:** Create `lib/aggregate.ts`, `__tests__/aggregate.test.ts`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { weeklyBuckets, momentumStatus } from "@/lib/aggregate";

describe("weeklyBuckets", () => {
  it("buckets trailing 7-day sums, newest last", () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({ day: `d${i}`, downloads: 1 }));
    const w = weeklyBuckets(daily, 2);
    expect(w).toEqual([7, 7]);
  });
  it("returns [] for empty input", () => {
    expect(weeklyBuckets([], 13)).toEqual([]);
  });
});

describe("momentumStatus", () => {
  it("up when last > prev by >5%", () => expect(momentumStatus(110, 100)).toBe("up"));
  it("down when last < prev by >5%", () => expect(momentumStatus(90, 100)).toBe("dn"));
  it("flat within +-5%", () => expect(momentumStatus(102, 100)).toBe("flat"));
  it("up from zero prev with positive last", () => expect(momentumStatus(5, 0)).toBe("up"));
});
```

- [ ] **Step 2: Run** `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type Status = "up" | "flat" | "dn";
export interface DailyPoint { day: string; downloads: number; }

export function weeklyBuckets(daily: DailyPoint[], maxWeeks = 13): number[] {
  if (!daily.length) return [];
  const vals = daily.slice(-maxWeeks * 7).map((d) => d.downloads);
  const weeks: number[] = [];
  for (let i = vals.length; i > 0 && weeks.length < maxWeeks; i -= 7) {
    weeks.push(vals.slice(Math.max(0, i - 7), i).reduce((a, b) => a + b, 0));
  }
  return weeks.reverse();
}

export function momentumStatus(last: number, prev: number): Status {
  const ratio = prev > 0 ? (last - prev) / prev : last === 0 ? 0 : 1;
  return ratio > 0.05 ? "up" : ratio < -0.05 ? "dn" : "flat";
}
```

- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: aggregate weekly buckets + status`.

### Task 2.2: `aggregate.ts` — stargazer day-bucketing

**Files:** Modify `lib/aggregate.ts`; `__tests__/aggregate.test.ts`.

- [ ] **Step 1: Add failing test**

```ts
import { starDailyFromTimestamps } from "@/lib/aggregate";
it("buckets starred_at into cumulative daily totals with deltas", () => {
  const ts = ["2026-01-01T10:00:00Z", "2026-01-01T20:00:00Z", "2026-01-03T00:00:00Z"];
  expect(starDailyFromTimestamps(ts)).toEqual([
    { day: "2026-01-01", stars_total: 2, stars_delta: 2 },
    { day: "2026-01-03", stars_total: 3, stars_delta: 1 },
  ]);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```ts
export interface StarDay { day: string; stars_total: number; stars_delta: number; }
export function starDailyFromTimestamps(starredAt: string[]): StarDay[] {
  const byDay = new Map<string, number>();
  for (const t of starredAt) {
    const day = t.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.keys()].sort();
  let total = 0;
  return days.map((day) => {
    const delta = byDay.get(day)!;
    total += delta;
    return { day, stars_total: total, stars_delta: delta };
  });
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: stargazer day-bucketing`.

### Task 2.3: `lib/npm.ts` — fetchers

**Files:** Create `lib/npm.ts`, `__tests__/npm.test.ts`.

- [ ] **Step 1: Write tests** mocking `fetch` for: (a) `fetchPackageMeta` normalizes `repository.url` `git+https://github.com/o/r.git` → `{ owner:"o", repo:"r" }` + reads `dist-tags.latest` and `time[latest]`; (b) `fetchDownloadsRange` encodes scoped name with `%2F` in the URL.

```ts
import { describe, it, expect, vi } from "vitest";
import { parseRepo, downloadsUrl } from "@/lib/npm";
it("parseRepo strips git+ and .git", () =>
  expect(parseRepo("git+https://github.com/o/r.git")).toEqual({ owner: "o", repo: "r" }));
it("parseRepo returns null for non-github", () =>
  expect(parseRepo("https://gitlab.com/o/r")).toBeNull());
it("downloadsUrl encodes scoped slash", () =>
  expect(downloadsUrl("2026-01-01", "2026-02-01", "@s/n"))
    .toContain("/range/2026-01-01:2026-02-01/@s%2Fn"));
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `parseRepo`, `downloadsUrl`, and async `fetchPackageMeta`/`fetchDownloadsRange` (use the proven logic from `prototype/fetch.sh`). Endpoints: `https://api.npmjs.org/downloads/range/{from}:{to}/{enc}`, `https://registry.npmjs.org/{enc}`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: npm fetchers`.

### Task 2.4: `lib/github.ts` — repo stats + backfill

**Files:** Create `lib/github.ts`, `__tests__/github.test.ts`.

- [ ] **Step 1: Write test** for `parseLinkHeader` pagination + that `backfillStargazers` stops at 400 pages (returns `{ truncated: true }`). Mock `fetch`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `fetchRepoStats(owner,repo,token)` (GET `/repos/{o}/{r}` → stargazers_count/forks_count) and `backfillStargazers(owner,repo,token)` paginating `/repos/{o}/{r}/stargazers?per_page=100` with header `Accept: application/vnd.github.star+json`, collecting `starred_at`, capping at 400 pages → `{ timestamps, truncated }`. Feed into `starDailyFromTimestamps`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: github fetchers + backfill`.

---

## Milestone M3 — Snapshot cron (Vercel)

### Task 3.1: Snapshot route

**Files:** Create `app/api/cron/snapshot/route.ts`; `vercel.json`.

- [ ] **Step 1:** Add `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/snapshot", "schedule": "0 6 * * *" }] }
```
- [ ] **Step 2:** Implement route: assert `Authorization: Bearer ${CRON_SECRET}`; load all `packages`; for each: `fetchDownloadsRange` (last ~40 days) → upsert `download_daily`; `fetchPackageMeta` → update `latest_version`/`last_published_at`/repo; if repo present `fetchRepoStats` → upsert today's `star_daily` (`stars_delta` = today_total − last_total); if repo present and `backfill_status='none'` set `'pending'`. Use `lib/supabase/admin.ts`. Idempotent via upsert on PK.
- [ ] **Step 3: Test** locally: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/snapshot` → 200, rows appear; re-run → no duplicates.
- [ ] **Step 4: Commit** `feat: daily snapshot cron`.

---

## Milestone M4 — Backfill worker (GitHub Actions)

### Task 4.1: Worker script + workflow

**Files:** Create `scripts/backfill.ts`, `.github/workflows/backfill.yml`.

- [ ] **Step 1:** `scripts/backfill.ts`: select `packages` where `backfill_status='pending'` and repo set; for each run `backfillStargazers` (token from `GITHUB_TOKEN`), upsert `star_daily` history, set `backfill_status` to `'done'` or `'truncated'`. Service-role client.
- [ ] **Step 2:** `.github/workflows/backfill.yml`: `schedule: cron "*/15 * * * *"` + `workflow_dispatch`; checkout, setup-node, `npx tsx scripts/backfill.ts`; env `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Add repo secrets.
- [ ] **Step 3: Verify** dispatch run backfills a `pending` repo and flips status.
- [ ] **Step 4: Commit** `feat: stargazer backfill worker`.

---

## Milestone M5 — Auth & watchlist

### Task 5.1: GitHub OAuth

- [ ] **Step 1:** Enable GitHub provider in Supabase Auth; set callback. `app/(auth)/login/page.tsx` with `signInWithOAuth({ provider: "github" })`; auth callback route.
- [ ] **Step 2:** On first login, create `profiles` row with `slug` = github handle.
- [ ] **Step 3: Verify** login round-trip; `auth.uid()` available server-side.
- [ ] **Step 4: Commit** `feat: github oauth + profile`.

### Task 5.2: Add/remove package

**Files:** Create `app/api/packages/route.ts`.

- [ ] **Step 1:** POST `{name}`: validate via `fetchPackageMeta` (404 → 400 "пакет не найден"); upsert into `packages` (resolve repo); insert into `watchlist` for `auth.uid()`. DELETE removes the watchlist row.
- [ ] **Step 2: Test** add `n8n-nodes-docx-to-md` → row in watchlist + package; add bad name → 400.
- [ ] **Step 3: Commit** `feat: add/remove package`.

---

## Milestone M6 — Dashboard UI

> Load `impeccable` + `vercel:shadcn` here. Match `docs/design/mockup-dashboard.html` exactly (tokens, sizing, layout B card). Each task: build component, render with seeded/sample data, visually verify against the mockup, commit.

### Task 6.1: App shell + sidebar
**Files:** `app/(app)/layout.tsx`, `components/layout/app-sidebar.tsx`.
- [ ] Build 236px `aside` (border-r), logo `n / situation`, nav (Обзор/Скачивания/Звёзды/Алерты) with active-dot marker, package list, dashed "Добавить пакет", bottom sync indicator + user menu. Mirror `app-sidebar.tsx` pattern from ai-data-analyst. Verify against mockup. Commit.

### Task 6.2: Stat strip
**Files:** `components/dashboard/stat-strip.tsx`.
- [ ] Bordered horizontal strip, 4 cells (DL/нед, всего ★, DL/13нед, пакетов в норме) with label/value/delta. Props typed. Commit.

### Task 6.3: Dual chart
**Files:** `components/dashboard/dual-chart.tsx`.
- [ ] Recharts: downloads `Area` (status color, gradient) + stars `Line` (primary blue), `isAnimationActive=false`, endpoints dotted. Props `{ weeks: number[]; stars: number[]; status }`. Commit.

### Task 6.4: Package card (layout B)
**Files:** `components/dashboard/package-card.tsx`.
- [ ] Header: name + `v{version}` chip + status. Left status stripe (3px, semantic). Hero: two numbers with colored series-dots. `<DualChart/>`. Footer: delta + `обновлён {rel}`. `rel()` relative-date helper (port from `prototype/gen.py`). Commit.

### Task 6.5: Grid + page
**Files:** `components/dashboard/package-grid.tsx`, `app/(app)/dashboard/page.tsx`.
- [ ] Server component: load watchlist for `auth.uid()`, join `download_daily`/`star_daily`, compute `weeklyBuckets`/`momentumStatus`, **sort by last-week downloads desc**, render strip + grid (3-col → 2-col responsive). Commit.

---

## Milestone M7 — Public share

### Task 7.1: `/u/[slug]`
**Files:** `app/u/[slug]/page.tsx`.
- [ ] Server component: resolve `profiles` where `slug` and `is_public`; render same grid read-only (no add button); 404 if not public. Add "Сделать публичным" toggle in settings. Commit.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §3 stack → M0; §5 model → M1; §6 ingestion → M2; §3/§4 jobs → M3+M4; §1/§5 auth+share → M5+M7; §7 UI → M6; §8 errors → handled in 5.2/3.1/2.x; killer-feature §9 → stars line in 6.3/6.4 (honest flat render). No gap.
- **Placeholder scan:** logic tasks (M2) carry full code + tests; UI tasks (M6) deliberately reference the validated mockup + design skills rather than inlining full JSX (design-time work) — paths and responsibilities are concrete.
- **Type consistency:** `Status` ("up"|"flat"|"dn"), `DailyPoint`, `StarDay`, `weeklyBuckets`, `momentumStatus`, `starDailyFromTimestamps`, `parseRepo`, `backfillStargazers` consistent across M2/M3/M4/M6.

## Execution (next session)

Two options when resuming:
1. **Subagent-driven (recommended)** — fresh subagent per task, review between tasks (`superpowers:subagent-driven-development`).
2. **Inline** — batch with checkpoints (`superpowers:executing-plans`).

# Per-Package Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four per-package badge endpoints under `/badge/[slug]/[...pkg]/{momentum,sparkline,stars,card}.svg` driven by a single Next route handler, fed by one Supabase loader, watchlist-gated, with edge caching.

**Architecture:** All logic lives in one new file `lib/badge-pkg.ts` (loader + four pure render functions, ~250 LOC). One catch-all route at `app/badge/[slug]/[...pkg]/[variant]/route.ts` dispatches on `variant`. Reuses `COLORS`/`LIGHT_COLORS`/`fmtCompact`/`signedCompact` from `lib/badge.ts` and `weeklyBuckets`/`momentumStatus` from `lib/aggregate.ts`. TDD on pure render functions only; loader and route are Supabase-orchestration / RSC and verified by build + browser smoke per CLAUDE.md §TDD scope.

**Tech Stack:** Next.js 16 App Router (`route.ts` handlers) · TypeScript · Supabase JS client · Vitest · Tailwind (irrelevant here; SVG only).

**Reference:** `docs/superpowers/specs/2026-05-24-per-package-badges-design.md`

---

## File map

| File | Purpose | Status |
|---|---|---|
| `lib/badge-pkg.ts` | `BadgePackage` type, `loadBadgePackage`, four `render*` SVG functions, local `styleBlock()` helper | create |
| `app/badge/[slug]/[...rest]/route.ts` | Single GET handler. `rest` is the catch-all; last segment = variant, rest joined = npm pkg name. Validates, loads, dispatches, sets Cache-Control. | create |
| `__tests__/badge-pkg.test.ts` | Unit tests for four `render*` functions (pure: `BadgePackage` in, SVG string out) | create |

No existing files are modified.

---

### Task 1: `BadgePackage` type + `loadBadgePackage`

**Files:**
- Create: `lib/badge-pkg.ts`

Single Supabase round-trip: resolve slug → profile → watchlist (gated by pkgName) → packages row → download_daily + star_daily for that one package_id. Mirrors `lib/portfolio.ts` honest-data invariants: today's UTC row excluded before bucketing, 12-week sparkline window, weekly star delta as `sum(stars_delta)` over the last 7 calendar days.

- [ ] **Step 1: Create file with type + loader**

```ts
// lib/badge-pkg.ts
import { createClient } from "@/lib/supabase/server";
import { momentumStatus, weeklyBuckets, type Status } from "@/lib/aggregate";

export interface BadgePackage {
  name: string;
  weeks: number[];           // 12 trailing weekly sums, newest last
  lastWeekDownloads: number;
  deltaDownloads: number;    // last - prev
  status: Status;
  starsTotal: number;
  deltaStars: number;        // sum(stars_delta) over the last 7 calendar days
  freshness: string | null;  // relAgo(packages.last_synced_at)
}

const WEEKS = 12;

export async function loadBadgePackage(
  slug: string,
  pkgName: string,
  viewerUserId: string | null = null,
): Promise<BadgePackage | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, is_public")
    .eq("slug", slug)
    .maybeSingle();
  if (!profile) return null;
  if (!profile.is_public && profile.user_id !== viewerUserId) return null;

  const { data: pkg } = await supabase
    .from("packages")
    .select("id, name, last_synced_at")
    .eq("name", pkgName)
    .maybeSingle();
  if (!pkg) return null;

  const { data: watch } = await supabase
    .from("watchlist")
    .select("user_id")
    .eq("user_id", profile.user_id)
    .eq("package_id", pkg.id)
    .maybeSingle();
  if (!watch) return null;

  const [{ data: downloads }, { data: stars }] = await Promise.all([
    supabase
      .from("download_daily")
      .select("day, downloads")
      .eq("package_id", pkg.id)
      .order("day"),
    supabase
      .from("star_daily")
      .select("day, stars_total, stars_delta")
      .eq("package_id", pkg.id)
      .order("day"),
  ]);

  // Same honest-data rule as lib/portfolio.ts: today's UTC row under-reports
  // because npm aggregates ~24h late.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const dailyFiltered = (downloads ?? []).filter((r) => r.day < todayUtc);
  const weeks = weeklyBuckets(dailyFiltered, WEEKS);
  const last = weeks.at(-1) ?? 0;
  const prev = weeks.at(-2) ?? 0;

  const starHistory = stars ?? [];
  const starsTotal = starHistory.at(-1)?.stars_total ?? 0;
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const deltaStars = starHistory
    .filter((r) => r.day > cutoff)
    .reduce((sum, r) => sum + (r.stars_delta ?? 0), 0);

  return {
    name: pkg.name,
    weeks,
    lastWeekDownloads: last,
    deltaDownloads: last - prev,
    status: momentumStatus(last, prev),
    starsTotal,
    deltaStars,
    freshness: relAgo(pkg.last_synced_at),
  };
}

function relAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 26) return `${hrs}h ago`;
  return "stale";
}
```

- [ ] **Step 2: Typecheck passes**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/badge-pkg.ts
git commit -m "feat(badge-pkg): loadBadgePackage — single-pkg snapshot for per-pkg badges"
```

---

### Task 2: `renderMomentum` (TDD)

**Files:**
- Modify: `lib/badge-pkg.ts` (append render function + supporting `styleBlock` helper)
- Test: `__tests__/badge-pkg.test.ts`

Right segment is `success` color when `status === "up"`, `destructive` when `"dn"`, dark `#1d1f24` when `"flat"`. Arrow glyph follows status: `↑`/`↓`/`·`. Brand dot logo on the left (24px dark segment). Verdana 11 (matches shields.io neighbors).

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/badge-pkg.test.ts
import { describe, it, expect } from "vitest";
import {
  renderMomentum,
  renderSparkline,
  renderStars,
  renderCard,
  type BadgePackage,
} from "../lib/badge-pkg";

const base: BadgePackage = {
  name: "skill-graveyard",
  weeks: [100, 120, 140, 150, 160, 180, 200, 220, 240, 280, 300, 340],
  lastWeekDownloads: 340,
  deltaDownloads: 40,
  status: "up",
  starsTotal: 124,
  deltaStars: 5,
  freshness: "2h ago",
};

describe("renderMomentum", () => {
  it("up: green segment, ↑ arrow, compacted value", () => {
    const svg = renderMomentum(base);
    expect(svg).toContain("↑");
    expect(svg).toContain("#34a866");
    expect(svg).toContain("340");
    expect(svg).toContain("/wk");
    expect(svg).toMatch(/<svg[^>]*width="\d+"/);
  });

  it("dn: red segment, ↓ arrow", () => {
    const svg = renderMomentum({ ...base, status: "dn", deltaDownloads: -40 });
    expect(svg).toContain("↓");
    expect(svg).toContain("#df6256");
  });

  it("flat: dark segment, · glyph, no status hue", () => {
    const svg = renderMomentum({ ...base, status: "flat", deltaDownloads: 5 });
    expect(svg).toContain("·");
    expect(svg).not.toContain("#34a866");
    expect(svg).not.toContain("#df6256");
  });

  it("brand dot logo present (green circle, left segment)", () => {
    const svg = renderMomentum(base);
    expect(svg).toMatch(/<circle [^>]*cx="12"[^>]*fill="#34a866"/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/badge-pkg.test.ts`
Expected: FAIL — `renderMomentum is not a function` / import errors.

- [ ] **Step 3: Implement `renderMomentum` + local `styleBlock` helper**

Append to `lib/badge-pkg.ts`:

```ts
import { COLORS, LIGHT_COLORS, fmtCompact } from "@/lib/badge";

const FONT_MICRO =
  "Verdana,'DejaVu Sans',Geneva,sans-serif";
const FONT_CARD =
  "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, monospace";

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );
}

/**
 * Theme-flip CSS for the four shared classes used across all four variants.
 * Status hues (success/destructive) stay inline — semantic, same value in
 * both themes. Mirrors the pattern in app/badge/[slug]/route.ts.
 */
function styleBlock(): string {
  return `
    .bg { fill: ${COLORS.bg}; }
    .panel { fill: #1d1f24; }
    .fg { fill: ${COLORS.fg}; }
    .muted { fill: ${COLORS.muted}; }
    .faint { fill: ${COLORS.faint}; }
    .border { stroke: ${COLORS.border}; }
    @media (prefers-color-scheme: light) {
      .bg { fill: ${LIGHT_COLORS.bg}; }
      .panel { fill: #eef0f4; }
      .fg { fill: ${LIGHT_COLORS.fg}; }
      .muted { fill: ${LIGHT_COLORS.muted}; }
      .faint { fill: ${LIGHT_COLORS.faint}; }
      .border { stroke: ${LIGHT_COLORS.border}; }
    }`;
}

const MICRO_H = 20;
const LEFT_W = 24;     // brand-dot segment
const DOT_R = 4;

export function renderMomentum(d: BadgePackage): string {
  const arrow = d.status === "up" ? "↑" : d.status === "dn" ? "↓" : "·";
  const value = `${arrow} ${fmtCompact(d.lastWeekDownloads)}/wk`;
  // Estimate width: Verdana 11 ≈ 6.6px/char. Add 12px padding.
  const rightW = Math.max(96, value.length * 7 + 16);
  const W = LEFT_W + rightW;
  const rightFill =
    d.status === "up"
      ? COLORS.success
      : d.status === "dn"
        ? COLORS.destructive
        : null;
  const rightRect = rightFill
    ? `<rect x="${LEFT_W}" width="${rightW}" height="${MICRO_H}" fill="${rightFill}"/>`
    : `<rect x="${LEFT_W}" width="${rightW}" height="${MICRO_H}" class="panel"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${MICRO_H}" viewBox="0 0 ${W} ${MICRO_H}" font-family="${FONT_MICRO}">
  <defs><style>${styleBlock()}</style></defs>
  <clipPath id="r"><rect width="${W}" height="${MICRO_H}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${LEFT_W}" height="${MICRO_H}" class="bg"/>
    ${rightRect}
  </g>
  <circle cx="12" cy="10" r="${DOT_R}" fill="${COLORS.success}"/>
  <text x="${LEFT_W + rightW / 2}" y="14" font-size="11" fill="#fff" text-anchor="middle">${escapeXml(value)}</text>
</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/badge-pkg.test.ts -t renderMomentum`
Expected: PASS (4/4 in renderMomentum block).

- [ ] **Step 5: Commit**

```bash
git add lib/badge-pkg.ts __tests__/badge-pkg.test.ts
git commit -m "feat(badge-pkg): renderMomentum — micro badge with status-colored segment"
```

---

### Task 3: `renderSparkline` (TDD)

**Files:**
- Modify: `lib/badge-pkg.ts`
- Modify: `__tests__/badge-pkg.test.ts`

Polyline normalized to the package's own min/max over 12 weeks (not global). Empty weeks → empty polyline (no error, no crash). All-equal values → flat horizontal line at vertical center (no division-by-zero from min==max).

- [ ] **Step 1: Append failing tests**

```ts
describe("renderSparkline", () => {
  it("12-week polyline, dark panel, green stroke", () => {
    const svg = renderSparkline(base);
    expect(svg).toContain("<polyline");
    expect(svg).toContain('stroke="#34a866"');
    // 12 points × at least "x,y " each
    const points = svg.match(/points="([^"]+)"/)?.[1] ?? "";
    expect(points.split(/\s+/).filter(Boolean).length).toBe(12);
  });

  it("empty weeks: no polyline, no crash", () => {
    const svg = renderSparkline({ ...base, weeks: [] });
    expect(svg).not.toContain("<polyline");
    expect(svg).toMatch(/<svg/);
  });

  it("all-equal values: flat line, no NaN", () => {
    const svg = renderSparkline({ ...base, weeks: new Array(12).fill(100) });
    expect(svg).toContain("<polyline");
    expect(svg).not.toContain("NaN");
  });

  it("brand dot logo present", () => {
    const svg = renderSparkline(base);
    expect(svg).toMatch(/<circle [^>]*cx="12"[^>]*fill="#34a866"/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/badge-pkg.test.ts -t renderSparkline`
Expected: FAIL — `renderSparkline is not a function`.

- [ ] **Step 3: Implement `renderSparkline`**

Append to `lib/badge-pkg.ts`:

```ts
const SPARK_RIGHT_W = 106;
const SPARK_PAD_X = 4;
const SPARK_PAD_Y = 4;

export function renderSparkline(d: BadgePackage): string {
  const W = LEFT_W + SPARK_RIGHT_W;
  const innerW = SPARK_RIGHT_W - SPARK_PAD_X * 2;
  const innerH = MICRO_H - SPARK_PAD_Y * 2;
  const xs0 = LEFT_W + SPARK_PAD_X;
  let polyline = "";
  if (d.weeks.length > 0) {
    const min = Math.min(...d.weeks);
    const max = Math.max(...d.weeks);
    const span = max - min || 1; // flat series → midline, no /0
    const step = d.weeks.length > 1 ? innerW / (d.weeks.length - 1) : 0;
    const pts = d.weeks
      .map((v, i) => {
        const x = xs0 + step * i;
        const y =
          SPARK_PAD_Y +
          (max === min ? innerH / 2 : innerH - ((v - min) / span) * innerH);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    polyline = `<polyline points="${pts}" fill="none" stroke="${COLORS.success}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${MICRO_H}" viewBox="0 0 ${W} ${MICRO_H}" font-family="${FONT_MICRO}">
  <defs><style>${styleBlock()}</style></defs>
  <clipPath id="r"><rect width="${W}" height="${MICRO_H}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${LEFT_W}" height="${MICRO_H}" class="bg"/>
    <rect x="${LEFT_W}" width="${SPARK_RIGHT_W}" height="${MICRO_H}" class="panel"/>
  </g>
  <circle cx="12" cy="10" r="${DOT_R}" fill="${COLORS.success}"/>
  ${polyline}
</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/badge-pkg.test.ts -t renderSparkline`
Expected: PASS (4/4 in renderSparkline block).

- [ ] **Step 5: Commit**

```bash
git add lib/badge-pkg.ts __tests__/badge-pkg.test.ts
git commit -m "feat(badge-pkg): renderSparkline — 12w polyline normalized per-pkg"
```

---

### Task 4: `renderStars` (TDD)

**Files:**
- Modify: `lib/badge-pkg.ts`
- Modify: `__tests__/badge-pkg.test.ts`

Right segment dark, content `★ N  +M/w`. If `deltaStars === 0`, omit the delta tail (just `★ N`).

- [ ] **Step 1: Append failing tests**

```ts
describe("renderStars", () => {
  it("with delta: ★ total + signed weekly delta", () => {
    const svg = renderStars(base);
    expect(svg).toContain("★");
    expect(svg).toContain("124");
    expect(svg).toContain("+5/w");
  });

  it("zero delta: no /w tail", () => {
    const svg = renderStars({ ...base, deltaStars: 0 });
    expect(svg).toContain("★");
    expect(svg).toContain("124");
    expect(svg).not.toContain("/w");
  });

  it("zero stars: renders ★ 0", () => {
    const svg = renderStars({ ...base, starsTotal: 0, deltaStars: 0 });
    expect(svg).toContain("★");
    expect(svg).toContain("0");
  });

  it("brand dot logo present", () => {
    const svg = renderStars(base);
    expect(svg).toMatch(/<circle [^>]*cx="12"[^>]*fill="#34a866"/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/badge-pkg.test.ts -t renderStars`
Expected: FAIL — `renderStars is not a function`.

- [ ] **Step 3: Implement `renderStars`**

Append to `lib/badge-pkg.ts`:

```ts
export function renderStars(d: BadgePackage): string {
  const sign = d.deltaStars > 0 ? "+" : d.deltaStars < 0 ? "−" : "";
  const tail = d.deltaStars !== 0 ? `  ${sign}${fmtCompact(Math.abs(d.deltaStars))}/w` : "";
  const value = `★ ${fmtCompact(d.starsTotal)}${tail}`;
  const rightW = Math.max(80, value.length * 7 + 16);
  const W = LEFT_W + rightW;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${MICRO_H}" viewBox="0 0 ${W} ${MICRO_H}" font-family="${FONT_MICRO}">
  <defs><style>${styleBlock()}</style></defs>
  <clipPath id="r"><rect width="${W}" height="${MICRO_H}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${LEFT_W}" height="${MICRO_H}" class="bg"/>
    <rect x="${LEFT_W}" width="${rightW}" height="${MICRO_H}" class="panel"/>
  </g>
  <circle cx="12" cy="10" r="${DOT_R}" fill="${COLORS.success}"/>
  <text x="${LEFT_W + rightW / 2}" y="14" font-size="11" fill="#fff" text-anchor="middle">${escapeXml(value)}</text>
</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/badge-pkg.test.ts -t renderStars`
Expected: PASS (4/4 in renderStars block).

- [ ] **Step 5: Commit**

```bash
git add lib/badge-pkg.ts __tests__/badge-pkg.test.ts
git commit -m "feat(badge-pkg): renderStars — micro badge with optional weekly delta"
```

---

### Task 5: `renderCard` (TDD)

**Files:**
- Modify: `lib/badge-pkg.ts`
- Modify: `__tests__/badge-pkg.test.ts`

440×120, JetBrains Mono. Header: brand dot + package name + freshness (right-aligned). Sparkline across full width. Bottom row: `dl/wk` label + value + signed delta (status-colored), `stars` label + value + signed weekly delta. Pre-sync (zero downloads) renders the structural frame without the sparkline.

- [ ] **Step 1: Append failing tests**

```ts
describe("renderCard", () => {
  it("includes name, freshness, sparkline, bottom-row labels/values", () => {
    const svg = renderCard(base);
    expect(svg).toContain("skill-graveyard");
    expect(svg).toContain("2h ago");
    expect(svg).toContain("dl/wk");
    expect(svg).toContain("340");
    expect(svg).toContain("stars");
    expect(svg).toContain("★ 124");
    expect(svg).toContain("+5/w");
    expect(svg).toContain("<polyline");
    expect(svg).toMatch(/<svg[^>]*width="440"/);
    expect(svg).toMatch(/<svg[^>]*height="120"/);
  });

  it("dn status colors delta destructive, ↓ arrow", () => {
    const svg = renderCard({ ...base, status: "dn", deltaDownloads: -40 });
    expect(svg).toContain("↓");
    expect(svg).toContain("#df6256");
  });

  it("pre-sync (empty weeks): no polyline, no crash, still renders frame", () => {
    const svg = renderCard({ ...base, weeks: [], lastWeekDownloads: 0, deltaDownloads: 0, status: "flat" });
    expect(svg).not.toContain("<polyline");
    expect(svg).toContain("skill-graveyard");
  });

  it("no freshness: header omits the freshness slot text", () => {
    const svg = renderCard({ ...base, freshness: null });
    expect(svg).not.toContain("2h ago");
    expect(svg).toContain("skill-graveyard");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/badge-pkg.test.ts -t renderCard`
Expected: FAIL — `renderCard is not a function`.

- [ ] **Step 3: Implement `renderCard`**

In `lib/badge-pkg.ts`, extend the existing top-level import from `@/lib/badge` to add `signedCompact`:

```ts
import { COLORS, LIGHT_COLORS, fmtCompact, signedCompact } from "@/lib/badge";
```

Then append the renderer:

```ts
const CARD_W = 440;
const CARD_H = 120;
const CARD_PAD_X = 22;

export function renderCard(d: BadgePackage): string {
  const headerY = 26;
  const divider1Y = 38;
  const divider2Y = 92;
  const footerY = 108;

  // Sparkline area (full width, between dividers)
  const sparkTop = divider1Y + 8;
  const sparkBottom = divider2Y - 6;
  let polyline = "";
  let lastDot = "";
  if (d.weeks.length > 0) {
    const innerW = CARD_W - CARD_PAD_X * 2;
    const innerH = sparkBottom - sparkTop;
    const min = Math.min(...d.weeks);
    const max = Math.max(...d.weeks);
    const span = max - min || 1;
    const step = d.weeks.length > 1 ? innerW / (d.weeks.length - 1) : 0;
    const pts = d.weeks.map((v, i) => {
      const x = CARD_PAD_X + step * i;
      const y =
        sparkTop +
        (max === min ? innerH / 2 : innerH - ((v - min) / span) * innerH);
      return { x, y };
    });
    polyline = `<polyline points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="${COLORS.success}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts.at(-1)!;
    lastDot = `<circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3" fill="${COLORS.success}"/>`;
  }

  const dlDeltaColor =
    d.status === "up"
      ? COLORS.success
      : d.status === "dn"
        ? COLORS.destructive
        : COLORS.muted;
  const dlArrow = d.status === "up" ? "↑" : d.status === "dn" ? "↓" : "·";
  const starsDeltaSign = d.deltaStars > 0 ? "+" : d.deltaStars < 0 ? "−" : "";
  const starsDeltaText =
    d.deltaStars !== 0 ? `${starsDeltaSign}${fmtCompact(Math.abs(d.deltaStars))}/w` : "—";

  const freshnessText = d.freshness
    ? `<text x="${CARD_W - CARD_PAD_X}" y="${headerY}" font-size="10" class="muted" text-anchor="end">${escapeXml(d.freshness)}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" font-family="${FONT_CARD}">
  <defs><style>${styleBlock()}</style></defs>
  <rect width="${CARD_W}" height="${CARD_H}" rx="6" class="bg"/>
  <circle cx="${CARD_PAD_X}" cy="22" r="4.5" fill="${COLORS.success}"/>
  <text x="${CARD_PAD_X + 11}" y="${headerY}" font-size="13" font-weight="700" class="fg">${escapeXml(d.name)}</text>
  ${freshnessText}
  <line x1="0" y1="${divider1Y}" x2="${CARD_W}" y2="${divider1Y}" class="border"/>
  ${polyline}
  ${lastDot}
  <line x1="0" y1="${divider2Y}" x2="${CARD_W}" y2="${divider2Y}" class="border"/>
  <text x="${CARD_PAD_X}" y="${footerY}" font-size="11" class="muted">dl/wk</text>
  <text x="${CARD_PAD_X + 52}" y="${footerY}" font-size="11" font-weight="600" class="fg">${escapeXml(fmtCompact(d.lastWeekDownloads))}</text>
  <text x="${CARD_PAD_X + 90}" y="${footerY}" font-size="11" fill="${dlDeltaColor}">${dlArrow}${escapeXml(signedCompact(d.deltaDownloads))}</text>
  <text x="${CARD_PAD_X + 178}" y="${footerY}" font-size="11" class="muted">stars</text>
  <text x="${CARD_PAD_X + 218}" y="${footerY}" font-size="11" font-weight="600" class="fg">★ ${escapeXml(fmtCompact(d.starsTotal))}</text>
  <text x="${CARD_PAD_X + 256}" y="${footerY}" font-size="11" fill="${d.deltaStars > 0 ? COLORS.success : d.deltaStars < 0 ? COLORS.destructive : COLORS.muted}">${escapeXml(starsDeltaText)}</text>
</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/badge-pkg.test.ts -t renderCard`
Expected: PASS (4/4 in renderCard block).

- [ ] **Step 5: Run the full test suite to make sure nothing broke**

Run: `npm test`
Expected: all tests pass (34 existing + 16 new = 50 total).

- [ ] **Step 6: Commit**

```bash
git add lib/badge-pkg.ts __tests__/badge-pkg.test.ts
git commit -m "feat(badge-pkg): renderCard — 440x120 standalone card variant"
```

---

### Task 6: Route handler

**Files:**
- Create: `app/badge/[slug]/[...rest]/route.ts`

Single GET. Catch-all `[...rest]` collects everything past `[slug]`. Last element is the variant filename; everything before is the npm package name (1 segment for unscoped, 2 for `@scope/name`). Next App Router requires the catch-all to be terminal — it cannot be followed by another `[param]` — so the split happens in code, not in the route shape.

Privacy posture mirrors `loadPortfolio`: any miss → `notFound()`.

- [ ] **Step 1: Create the handler file**

```ts
// app/badge/[slug]/[...rest]/route.ts
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import {
  loadBadgePackage,
  renderMomentum,
  renderSparkline,
  renderStars,
  renderCard,
} from "@/lib/badge-pkg";
import { isValidSlug } from "@/lib/slug";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RENDERERS = {
  "momentum.svg": renderMomentum,
  "sparkline.svg": renderSparkline,
  "stars.svg": renderStars,
  "card.svg": renderCard,
} as const;

type Variant = keyof typeof RENDERERS;

function isVariant(v: string): v is Variant {
  return v in RENDERERS;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; rest: string[] }> },
) {
  const { slug, rest } = await params;
  if (!isValidSlug(slug)) notFound();
  if (!rest || rest.length < 2) notFound(); // need ≥1 pkg segment + 1 variant

  const variant = rest[rest.length - 1];
  const pkgSegments = rest.slice(0, -1);
  if (!isVariant(variant)) notFound();
  if (pkgSegments.length === 0) notFound();

  const pkgName = pkgSegments.join("/");
  const viewer = await getViewer();
  const data = await loadBadgePackage(slug, pkgName, viewer?.id ?? null);
  if (!data) notFound();

  const svg = RENDERERS[variant](data);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 type errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/badge/[slug]/[...rest]/route.ts
git commit -m "feat(badge-pkg): route handler — slug/variant/watchlist gates + 1h cache"
```

---

### Task 7: Browser smoke test (Playwright MCP)

**Files:** none modified

Verify all four valid URLs render SVG and all error paths 404 against the dev server.

- [ ] **Step 1: Start dev server in background**

Run: `npm run dev` (background)
Wait for «Ready in» log line on http://localhost:3000.

- [ ] **Step 2: Identify a real package in sfrangulov's watchlist**

Pick the first package that returns 200 on the existing portfolio URL `http://localhost:3000/u/sfrangulov`. Candidate list (from npm registry maintainer search): `skill-graveyard`, `mcp-graveyard`, `n8n-nodes-docx-to-md`, `penwick`. Use whichever resolves.

- [ ] **Step 3: Verify each of the four valid URLs returns SVG**

For PKG ∈ {chosen real package name}, GET each URL and assert response is `Content-Type: image/svg+xml` with body starting `<?xml`:

```
http://localhost:3000/badge/sfrangulov/<PKG>/momentum.svg
http://localhost:3000/badge/sfrangulov/<PKG>/sparkline.svg
http://localhost:3000/badge/sfrangulov/<PKG>/stars.svg
http://localhost:3000/badge/sfrangulov/<PKG>/card.svg
```

Use `mcp__plugin_playwright_playwright__browser_navigate` for each URL → `mcp__plugin_playwright_playwright__browser_take_screenshot` to capture the rendered SVG for visual review.

- [ ] **Step 4: Verify each of the four 404 paths**

```
http://localhost:3000/badge/sfrangulov/this-pkg-does-not-exist-xyz/momentum.svg   → 404
http://localhost:3000/badge/sfrangulov/<PKG>/invalid.svg                            → 404
http://localhost:3000/badge/INVALID%21SLUG/<PKG>/momentum.svg                       → 404
http://localhost:3000/badge/nonexistent-slug-zzz/<PKG>/momentum.svg                 → 404
```

Use `mcp__plugin_playwright_playwright__browser_network_request` or curl via Bash to assert status codes.

- [ ] **Step 5: Save one card screenshot for the spec's design archive**

Run: `mkdir -p docs/superpowers/screenshots` if it doesn't exist, then save the card.svg screenshot as `docs/superpowers/screenshots/2026-05-24-card-<PKG>.png`. Use `open` to surface it to the user.

- [ ] **Step 6: Kill dev server**

Stop the background `npm run dev` task.

- [ ] **Step 7: No commit (no code changes); proceed to Task 8**

---

### Task 8: Close beads issue, push

**Files:** none modified (git ops only)

- [ ] **Step 1: Pull, push, close**

```bash
git pull --rebase
git push
bd close ephemeris-3ir --reason="per-package badges shipped (4 variants, watchlist-gated, 1h cache); palette calibration tracked separately"
bd dolt push
git status   # MUST show "up to date with origin"
```

- [ ] **Step 2: File a follow-up beads issue for palette calibration**

```bash
bd create \
  --type=task \
  --priority=3 \
  --title="per-package badges: calibrate brand-dot vs momentum-segment palette" \
  --description="Spec §TBD. Brand dot is green; momentum 'up' segment is also green — risk of visual merge in shields-row. Prototype three palette options (green/green with frame, neutral dot + green segment, third brand color), eyeball at real pixel size against shields.io neighbors. Land light-theme values in the same calibration pass."
bd dolt push
```

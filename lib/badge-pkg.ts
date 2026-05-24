import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { momentumStatus, weeklyBuckets, type Status } from "@/lib/aggregate";
import { relAgo } from "@/lib/freshness";
import { COLORS, LIGHT_COLORS, fmtCompact, signedCompact } from "@/lib/badge";

export interface BadgePackage {
  name: string;
  weeks: number[];
  lastWeekDownloads: number;
  deltaDownloads: number;
  status: Status;
  starsTotal: number;
  deltaStars: number;
  freshness: string | null;
}

// 12 weeks (vs portfolio's 13): per-package sparkline is narrower; one extra
// bucket would be illegible in a ~106px panel.
const WEEKS = 12;

export const loadBadgePackage = cache(
  async (
    slug: string,
    pkgName: string,
    viewerUserId: string | null = null,
  ): Promise<BadgePackage | null> => {
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
    const cutoff = new Date(Date.now() - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
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
  },
);

const FONT_MICRO =
  "Verdana,'DejaVu Sans',Geneva,sans-serif";
const FONT_CARD =
  "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, monospace";

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );
}

// Theme-flip CSS for the four shared classes used across all four variants.
// Status hues (success/destructive) stay inline — semantic, same value in
// both themes. Mirrors the pattern in app/badge/[slug]/route.ts.
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
const LEFT_W = 24;
const DOT_R = 4;

export function renderMomentum(d: BadgePackage): string {
  const arrow = d.status === "up" ? "↑" : d.status === "dn" ? "↓" : "·";
  const value = `${arrow} ${fmtCompact(d.lastWeekDownloads)}/wk`;
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
    const span = max - min || 1;
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

export function renderStars(d: BadgePackage): string {
  const tail = d.deltaStars !== 0 ? `  ${signedCompact(d.deltaStars)}/w` : "";
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

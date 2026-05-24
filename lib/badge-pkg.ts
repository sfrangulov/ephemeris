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

// 12 weeks (vs portfolio's 13): per-package sparkline panel is narrower; one
// extra bucket would be illegible in the ~92px area.
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

const FONT_MONO =
  "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, monospace";

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );
}

// All chrome and status hues flip via class. Brand dot (#34a866) is the one
// inline fill — it's a brand mark, not text, and stays green in both themes.
// Status colors (.up/.dn) are deepened in light mode for 4.5:1 AA contrast.
function styleBlock(): string {
  return `
    .bg { fill: ${COLORS.bg}; }
    .fg { fill: ${COLORS.fg}; }
    .muted { fill: ${COLORS.muted}; }
    .up { fill: ${COLORS.success}; }
    .dn { fill: ${COLORS.destructive}; }
    .line { stroke: ${COLORS.success}; }
    .baseline { stroke: ${COLORS.baseline}; }
    .border { stroke: ${COLORS.border}; }
    @media (prefers-color-scheme: light) {
      .bg { fill: ${LIGHT_COLORS.bg}; }
      .fg { fill: ${LIGHT_COLORS.fg}; }
      .muted { fill: ${LIGHT_COLORS.muted}; }
      .up { fill: ${LIGHT_COLORS.success}; }
      .dn { fill: ${LIGHT_COLORS.destructive}; }
      .line { stroke: ${LIGHT_COLORS.success}; }
      .baseline { stroke: ${LIGHT_COLORS.baseline}; }
      .border { stroke: ${LIGHT_COLORS.border}; }
    }`;
}

// Shared micro geometry. Square strip, 20px tall, JetBrains Mono 11/10.
const MICRO_H = 20;
const DOT_CX = 10;
const DOT_CY = 10;
const DOT_R = 3.5;
const ARROW_X = 22;
const NUM_X = 36;
const TEXT_Y = 14;
// JetBrains Mono ~7.7px/char at font-size 11, ~6.5 at 10. Rounded up — over-pad
// is harmless, under-pad clips the trailing "/wk".
const CHAR_W_11 = 8;
const CHAR_W_10 = 7;
const GAP = 6;
const RIGHT_PAD = 8;
const META_W = "/wk".length * CHAR_W_10;

const STATUS_ARROW: Record<Status, string> = { up: "↑", dn: "↓", flat: "·" };
const STATUS_CLASS: Record<Status, string> = {
  up: "up",
  dn: "dn",
  flat: "muted",
};

function deltaStatus(n: number): Status {
  return n > 0 ? "up" : n < 0 ? "dn" : "flat";
}

export function renderMomentum(d: BadgePackage): string {
  const arrow = STATUS_ARROW[d.status];
  const arrowClass = STATUS_CLASS[d.status];
  const num = fmtCompact(d.lastWeekDownloads);
  const metaX = NUM_X + num.length * CHAR_W_11 + GAP;
  const W = metaX + META_W + RIGHT_PAD;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${MICRO_H}" viewBox="0 0 ${W} ${MICRO_H}" font-family="${FONT_MONO}">
  <defs><style>${styleBlock()}</style></defs>
  <rect width="${W}" height="${MICRO_H}" class="bg"/>
  <circle cx="${DOT_CX}" cy="${DOT_CY}" r="${DOT_R}" fill="${COLORS.success}"/>
  <text x="${ARROW_X}" y="${TEXT_Y}" font-size="11" font-weight="700" class="${arrowClass}">${arrow}</text>
  <text x="${NUM_X}" y="${TEXT_Y}" font-size="11" font-weight="500" class="fg">${escapeXml(num)}</text>
  <text x="${metaX}" y="${TEXT_Y}" font-size="10" class="muted">/wk</text>
</svg>`;
}

// Sparkline panel is fixed-width — content has no variable text.
const SPARK_AREA_W = 92;
const SPARK_X0 = ARROW_X;
const SPARK_X1 = SPARK_X0 + SPARK_AREA_W;
const SPARK_TOP = 3;
const SPARK_BOTTOM = 13;
const SPARK_BASELINE_Y = 16;

export function renderSparkline(d: BadgePackage): string {
  const W = SPARK_X1 + RIGHT_PAD;
  let polyline = "";
  let endDot = "";
  if (d.weeks.length > 0) {
    const min = Math.min(...d.weeks);
    const max = Math.max(...d.weeks);
    const innerH = SPARK_BOTTOM - SPARK_TOP;
    const step =
      d.weeks.length > 1 ? SPARK_AREA_W / (d.weeks.length - 1) : 0;
    const pts = d.weeks.map((v, i) => {
      const x = SPARK_X0 + step * i;
      const y =
        max === min
          ? SPARK_TOP + innerH / 2
          : SPARK_TOP + innerH - ((v - min) / (max - min)) * innerH;
      return { x, y };
    });
    polyline = `<polyline points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" class="line" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts.at(-1)!;
    endDot = `<circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2" class="up"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${MICRO_H}" viewBox="0 0 ${W} ${MICRO_H}" font-family="${FONT_MONO}">
  <defs><style>${styleBlock()}</style></defs>
  <rect width="${W}" height="${MICRO_H}" class="bg"/>
  <circle cx="${DOT_CX}" cy="${DOT_CY}" r="${DOT_R}" fill="${COLORS.success}"/>
  <line x1="${SPARK_X0}" y1="${SPARK_BASELINE_Y}" x2="${SPARK_X1}" y2="${SPARK_BASELINE_Y}" class="baseline" stroke-width="1"/>
  ${polyline}
  ${endDot}
</svg>`;
}

export function renderStars(d: BadgePackage): string {
  const star = "★";
  const total = fmtCompact(d.starsTotal);
  const starX = ARROW_X;
  const totalX = NUM_X;
  const totalW = total.length * CHAR_W_11;
  let svgParts = `
  <text x="${starX}" y="${TEXT_Y}" font-size="11" class="fg">${star}</text>
  <text x="${totalX}" y="${TEXT_Y}" font-size="11" font-weight="500" class="fg">${escapeXml(total)}</text>`;
  let cursor = totalX + totalW + GAP;
  if (d.deltaStars !== 0) {
    const delta = signedCompact(d.deltaStars);
    const deltaClass = STATUS_CLASS[deltaStatus(d.deltaStars)];
    svgParts += `
  <text x="${cursor}" y="${TEXT_Y}" font-size="11" class="${deltaClass}">${escapeXml(delta)}</text>`;
    cursor += delta.length * CHAR_W_11 + GAP;
    svgParts += `
  <text x="${cursor}" y="${TEXT_Y}" font-size="10" class="muted">/wk</text>`;
    cursor += META_W;
  }
  const W = cursor + RIGHT_PAD;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${MICRO_H}" viewBox="0 0 ${W} ${MICRO_H}" font-family="${FONT_MONO}">
  <defs><style>${styleBlock()}</style></defs>
  <rect width="${W}" height="${MICRO_H}" class="bg"/>
  <circle cx="${DOT_CX}" cy="${DOT_CY}" r="${DOT_R}" fill="${COLORS.success}"/>${svgParts}
</svg>`;
}

const CARD_W = 440;
const CARD_H = 120;
const CARD_PAD_X = 20;

export function renderCard(d: BadgePackage): string {
  const headerY = 26;
  const divider1Y = 38;
  const divider2Y = 94;
  const footerY = 110;
  const sparkTop = divider1Y + 10;
  const sparkBottom = divider2Y - 8;

  let polyline = "";
  let endDot = "";
  if (d.weeks.length > 0) {
    const innerW = CARD_W - CARD_PAD_X * 2;
    const innerH = sparkBottom - sparkTop;
    const min = Math.min(...d.weeks);
    const max = Math.max(...d.weeks);
    const step =
      d.weeks.length > 1 ? innerW / (d.weeks.length - 1) : 0;
    const pts = d.weeks.map((v, i) => {
      const x = CARD_PAD_X + step * i;
      const y =
        max === min
          ? sparkTop + innerH / 2
          : sparkTop + innerH - ((v - min) / (max - min)) * innerH;
      return { x, y };
    });
    polyline = `<polyline points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" class="line" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts.at(-1)!;
    endDot = `<circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3" class="up"/>`;
  }

  const dlArrow = STATUS_ARROW[d.status];
  const dlArrowClass = STATUS_CLASS[d.status];
  const starsDeltaClass = STATUS_CLASS[deltaStatus(d.deltaStars)];
  const starsDeltaText =
    d.deltaStars !== 0 ? `${signedCompact(d.deltaStars)}/w` : "—";

  const freshness = d.freshness
    ? `<text x="${CARD_W - CARD_PAD_X}" y="${headerY}" font-size="10" class="muted" text-anchor="end">${escapeXml(d.freshness)}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" font-family="${FONT_MONO}">
  <defs><style>${styleBlock()}</style></defs>
  <rect width="${CARD_W}" height="${CARD_H}" class="bg"/>
  <circle cx="${CARD_PAD_X}" cy="22" r="4.5" fill="${COLORS.success}"/>
  <text x="${CARD_PAD_X + 12}" y="${headerY}" font-size="13" font-weight="700" class="fg">${escapeXml(d.name)}</text>
  ${freshness}
  <line x1="0" y1="${divider1Y}" x2="${CARD_W}" y2="${divider1Y}" class="border"/>
  ${polyline}
  ${endDot}
  <line x1="0" y1="${divider2Y}" x2="${CARD_W}" y2="${divider2Y}" class="border"/>
  <text x="${CARD_PAD_X}" y="${footerY}" font-size="11" class="muted">dl/wk</text>
  <text x="${CARD_PAD_X + 48}" y="${footerY}" font-size="11" font-weight="700" class="${dlArrowClass}">${dlArrow}</text>
  <text x="${CARD_PAD_X + 60}" y="${footerY}" font-size="11" font-weight="600" class="fg">${escapeXml(fmtCompact(d.lastWeekDownloads))}</text>
  <text x="${CARD_PAD_X + 100}" y="${footerY}" font-size="10" class="${dlArrowClass}">${escapeXml(signedCompact(d.deltaDownloads))}</text>
  <text x="${CARD_PAD_X + 200}" y="${footerY}" font-size="11" class="muted">stars</text>
  <text x="${CARD_PAD_X + 240}" y="${footerY}" font-size="11" class="fg">★</text>
  <text x="${CARD_PAD_X + 252}" y="${footerY}" font-size="11" font-weight="600" class="fg">${escapeXml(fmtCompact(d.starsTotal))}</text>
  <text x="${CARD_PAD_X + 280}" y="${footerY}" font-size="10" class="${starsDeltaClass}">${escapeXml(starsDeltaText)}</text>
</svg>`;
}

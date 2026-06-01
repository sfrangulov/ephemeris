import { NextResponse } from "next/server";
import {
  COLORS,
  DEFAULT_TOP_N,
  LIGHT_COLORS,
  TOP_N_CAP,
  badgeNotFound,
  dotColor,
  dotSize,
  fmtCompact,
  loadBadgeOrNull,
  signedCompact,
} from "@/lib/badge";
import { isValidSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 760;
// H is derived per request from row count (HEADER_H + N*ROW_H + bottom pad + FOOTER_H).
const PAD_X = 18;
const HEADER_H = 46;
const ROW_H = 30;
const FOOTER_H = 26;
const BODY_BOTTOM_PAD = 28; // gap between last row and the footer divider
const NAME_W = 200;
const WEEKS_W = 252;
const NUM_W = 56; // downloads number column
const DELTA_INLINE_W = 50; // room for the small delta hanging right of a number
const STAR_W = 52; // "★ 12.3k"
const GAP = 10;
const NAME_X = PAD_X;
const WEEKS_X = NAME_X + NAME_W;
const WEEKS_SLOT = WEEKS_W / 7;
const NUM_X = WEEKS_X + WEEKS_W + GAP;
const NUM_RIGHT = NUM_X + NUM_W; // downloads number right-anchored here
const DL_DELTA_X = NUM_RIGHT + 5; // download delta hangs right, left-anchored
const STAR_X = NUM_RIGHT + DELTA_INLINE_W + GAP;
const STAR_RIGHT = STAR_X + STAR_W; // "★ total" right-anchored here
const STAR_DELTA_X = STAR_RIGHT + 5; // star delta hangs right, left-anchored
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
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) return badgeNotFound();

  // ?n=N — clamp to [1, TOP_N_CAP]; invalid input falls back to default.
  const nParam = new URL(req.url).searchParams.get("n");
  const nParsed = nParam ? parseInt(nParam, 10) : NaN;
  const n =
    Number.isFinite(nParsed) && nParsed > 0
      ? Math.min(TOP_N_CAP, nParsed)
      : DEFAULT_TOP_N;

  const res = await loadBadgeOrNull(slug, n);
  if (!res) return badgeNotFound();
  const { rows, freshness, totalPackages, totalWeeklyDownloads } = res;

  const H = HEADER_H + rows.length * ROW_H + BODY_BOTTOM_PAD + FOOTER_H;

  const cells = rows
    .map((r, ri) => {
      const y = HEADER_H + ri * ROW_H + ROW_H / 2;
      const baselineY = y + 4;
      const dots = r.weeks
        .map((dl, i, arr) => {
          const cx = WEEKS_X + WEEKS_SLOT * i + WEEKS_SLOT / 2;
          if (dl <= 0) {
            return `<circle cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" r="2" class="muted-fill" opacity="0.2"/>`;
          }
          const d = dotSize(dl, DOT_SCALE);
          const color = dotColor(dl, arr[i - 1]);
          return `<circle cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" r="${(d / 2).toFixed(1)}" fill="${color}" opacity="0.85"/>`;
        })
        .join("");
      // dl/wk merged column: number (fg) + smaller status-colored delta beside
      // it, hidden when momentum is flat (sub-noise-floor). Mirrors the matrix.
      const dlDelta =
        r.status === "flat"
          ? ""
          : `<text x="${DL_DELTA_X}" y="${baselineY}" font-size="10" fill="${
              r.status === "up" ? COLORS.success : COLORS.destructive
            }">${signedCompact(r.deltaDownloads)}</text>`;
      // ★ merged column: total (muted) + sign-colored weekly delta beside it,
      // hidden when 0 — full parity with the matrix ★ column.
      const starDelta =
        r.deltaStars === 0
          ? ""
          : `<text x="${STAR_DELTA_X}" y="${baselineY}" font-size="10" fill="${
              r.deltaStars > 0 ? COLORS.success : COLORS.destructive
            }">${signedCompact(r.deltaStars)}</text>`;
      return [
        `<text x="${NAME_X}" y="${baselineY}" font-size="12" class="fg-fill">${escapeXml(r.name)}</text>`,
        dots,
        `<text x="${NUM_RIGHT}" y="${baselineY}" font-size="12" class="fg-fill" text-anchor="end">${fmtCompact(r.lastWeekDownloads)}</text>`,
        dlDelta,
        `<text x="${STAR_RIGHT}" y="${baselineY}" font-size="12" class="muted-fill" text-anchor="end">★ ${fmtCompact(r.starsTotal)}</text>`,
        starDelta,
      ].join("");
    })
    .join("\n  ");

  const headerSummary = `${totalPackages} pkgs · Σ ${fmtCompact(totalWeeklyDownloads)} dl/wk`;
  const tableTop = HEADER_H - 8;
  const footerY = H - FOOTER_H;

  // Chrome (bg/fg/muted/faint/border) flips with prefers-color-scheme.
  // Status hues (success/destructive in deltas + active dots) stay inline —
  // semantic meaning, same value either theme.
  const styleBlock = `
    .bg-fill { fill: ${COLORS.bg}; }
    .fg-fill { fill: ${COLORS.fg}; }
    .muted-fill { fill: ${COLORS.muted}; }
    .faint-fill { fill: ${COLORS.faint}; }
    .border-stroke { stroke: ${COLORS.border}; }
    @media (prefers-color-scheme: light) {
      .bg-fill { fill: ${LIGHT_COLORS.bg}; }
      .fg-fill { fill: ${LIGHT_COLORS.fg}; }
      .muted-fill { fill: ${LIGHT_COLORS.muted}; }
      .faint-fill { fill: ${LIGHT_COLORS.faint}; }
      .border-stroke { stroke: ${LIGHT_COLORS.border}; }
    }`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <defs><style>${styleBlock}</style></defs>
  <rect width="${W}" height="${H}" class="bg-fill"/>
  <circle cx="${PAD_X + 6}" cy="22" r="5" fill="${COLORS.success}"/>
  <text x="${PAD_X + 18}" y="26" font-size="14" font-weight="700" class="fg-fill">ephemeris/${escapeXml(slug)}</text>
  <text x="${W - PAD_X}" y="26" font-size="11" class="muted-fill" text-anchor="end">${escapeXml(headerSummary)}</text>
  <line x1="0" y1="${tableTop}" x2="${W}" y2="${tableTop}" class="border-stroke"/>
  ${cells}
  <line x1="0" y1="${footerY}" x2="${W}" y2="${footerY}" class="border-stroke"/>
  <text x="${PAD_X}" y="${H - 8}" font-size="10" class="faint-fill">ephemeris.tools/u/${escapeXml(slug)}</text>
  <text x="${W - PAD_X}" y="${H - 8}" font-size="10" class="faint-fill" text-anchor="end">${escapeXml(freshness ?? "")}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Client sees max-age=300 (Vercel strips s-maxage/SWR from the client
      // header). CDN-Cache-Control governs the edge: 1h fresh window caps the
      // displayed freshness-pill error (it's frozen into the SVG at render),
      // staying well inside the 6h sync cadence; a ≤1h SWR serve never hides
      // staleness beyond relAgo's tolerance.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}

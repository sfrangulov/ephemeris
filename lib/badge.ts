import { loadPortfolio } from "@/lib/portfolio";
import type { Status } from "@/lib/aggregate";

/** Default row count; route layer can override via ?n=N (capped 1..50). */
export const DEFAULT_TOP_N = 5;
export const TOP_N_CAP = 50;
const WEEKS = 7;

export interface BadgeRow {
  name: string;
  weeks: number[];
  lastWeekDownloads: number;
  deltaDownloads: number;
  status: Status;
  starsTotal: number;
}

export interface BadgeData {
  rows: BadgeRow[];
  freshness: string | null;
  totalPackages: number;
  totalWeeklyDownloads: number;
}

export async function loadBadge(
  slug: string,
  topN: number = DEFAULT_TOP_N,
): Promise<BadgeData> {
  const snap = await loadPortfolio(slug);
  const rows: BadgeRow[] = snap.packages.slice(0, topN).map((p) => {
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

export function magnitude(dl: number): number {
  if (dl <= 0) return 10;
  return Math.max(0, Math.min(10, 10 - 2.5 * Math.log10(dl)));
}

export function dotSize(dl: number, scale = 1): number {
  const m = magnitude(dl);
  return Math.max(1.5, (10 - m) * 1.1 + 1.5) * scale;
}

export function dotColor(dl: number, prev: number | undefined): string {
  if (dl <= 0) return COLORS.muted;
  if (prev != null && prev > 0) {
    const diff = dl - prev;
    const threshold = Math.max(prev * 0.05, Math.sqrt(prev));
    if (Math.abs(diff) > threshold) {
      return diff > 0 ? COLORS.success : COLORS.destructive;
    }
  }
  return COLORS.muted;
}

// sRGB-hex equivalents of the dashboard's Blueprint v5 tokens (app/globals.css).
// Plain hex (not oklch) for compatibility with embed-SVG pipelines (GitHub
// READMEs etc.) and satori (next/og) that don't always honor CSS Color Level 4.
// Dark palette is the default; light variant is opt-in via prefers-color-scheme
// inside the badge SVG so README readers see a theme-appropriate render.
export const COLORS = {
  bg: "#0b0b0c",          // near-black, matches the portfolio badge surface
  fg: "#f5f6f8",
  muted: "#8a93a3",
  faint: "#5e687a",
  border: "#44495b",
  baseline: "#2a2d36",    // sparkline guide-line stroke
  success: "#34a866",     // semantic up
  destructive: "#df6256", // semantic down
};

// Light-mode override. Status hues are deepened for 4.5:1 AA contrast on the
// lighter surface — #34a866 on #f7f8fa fails (~2.8:1).
export const LIGHT_COLORS = {
  bg: "#f7f8fa",
  fg: "#1b1f24",
  muted: "#5b6273",
  faint: "#9aa1ad",
  border: "#d8dce4",
  baseline: "#cfd4dc",
  success: "#1e7c41",
  destructive: "#c4493d",
};

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function signedCompact(n: number): string {
  return `${n < 0 ? "−" : "+"}${fmtCompact(Math.abs(n))}`;
}

import { loadPortfolio } from "@/lib/portfolio";
import type { Status } from "@/lib/aggregate";

const TOP_N = 5;
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

export async function loadBadge(): Promise<BadgeData> {
  const snap = await loadPortfolio();
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

export const COLORS = {
  bg: "#0b0b0c",
  fg: "#e5e5e5",
  muted: "#9a9a9a",
  faint: "#666",
  border: "#2a2a2d",
  success: "#1aa364",
  destructive: "#ef4444",
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

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { momentumStatus, weeklyBuckets, type Status } from "@/lib/aggregate";
import { relAgo } from "@/lib/freshness";

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

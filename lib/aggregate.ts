export type Status = "up" | "flat" | "dn";

export interface DailyPoint {
  day: string;
  downloads: number;
}

/**
 * Collapse daily download points into trailing 7-day sums, newest last,
 * capped to the most recent `maxWeeks` weeks.
 */
export function weeklyBuckets(daily: DailyPoint[], maxWeeks = 13): number[] {
  if (!daily.length) return [];
  const vals = daily.slice(-maxWeeks * 7).map((d) => d.downloads);
  const weeks: number[] = [];
  for (let i = vals.length; i > 0 && weeks.length < maxWeeks; i -= 7) {
    weeks.push(vals.slice(Math.max(0, i - 7), i).reduce((a, b) => a + b, 0));
  }
  return weeks.reverse();
}

/**
 * Classify week-over-week momentum honestly. A package is "up" or "dn" only
 * when the change clears BOTH a relative band (5%) AND an absolute Poisson
 * floor (sqrt(prev)). Below a minimum prior volume (20) every change is
 * counting noise, so we force "flat" — a 2→3 swing is not a trend.
 */
export function momentumStatus(last: number, prev: number): Status {
  if (prev < 20) return "flat";
  const diff = last - prev;
  const threshold = Math.max(prev * 0.05, Math.sqrt(prev));
  if (Math.abs(diff) <= threshold) return "flat";
  return diff > 0 ? "up" : "dn";
}

export interface StarDay {
  day: string;
  stars_total: number;
  stars_delta: number;
}

/**
 * Net stars gained over the trailing 7 days: the sum of daily `stars_delta`
 * within the half-open window `(now − 7d, now]`. This is the honest
 * week-over-week star metric — a 7-day sum is robust to the
 * "ingested-now ≠ measured-now" jitter that makes any single most-recent
 * `star_daily` row untrustworthy (see DESIGN.md §Honest data layer). Shared by
 * the portfolio matrix (`lib/portfolio.ts`) and the per-package badge
 * (`lib/badge-pkg.ts`) so the two surfaces never drift.
 */
export function weeklyStarDelta(
  history: { day: string; stars_delta: number }[],
  nowMs: number = Date.now(),
): number {
  const cutoff = new Date(nowMs - 7 * 86_400_000).toISOString().slice(0, 10);
  return history
    .filter((r) => r.day > cutoff)
    .reduce((sum, r) => sum + (r.stars_delta ?? 0), 0);
}

/**
 * Bucket stargazer `starred_at` timestamps into cumulative daily totals.
 * Days with no new stars are omitted; running total carries across gaps.
 */
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

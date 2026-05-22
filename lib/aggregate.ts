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

/** Classify week-over-week momentum with a +-5% dead band. */
export function momentumStatus(last: number, prev: number): Status {
  const ratio = prev > 0 ? (last - prev) / prev : last === 0 ? 0 : 1;
  return ratio > 0.05 ? "up" : ratio < -0.05 ? "dn" : "flat";
}

export interface StarDay {
  day: string;
  stars_total: number;
  stars_delta: number;
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

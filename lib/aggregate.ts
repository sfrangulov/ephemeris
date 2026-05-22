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

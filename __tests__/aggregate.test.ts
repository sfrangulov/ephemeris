import { describe, it, expect } from "vitest";
import {
  weeklyBuckets,
  momentumStatus,
  starDailyFromTimestamps,
  weeklyStarDelta,
} from "@/lib/aggregate";

describe("weeklyBuckets", () => {
  it("buckets trailing 7-day sums, newest last", () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      day: `d${i}`,
      downloads: 1,
    }));
    expect(weeklyBuckets(daily, 2)).toEqual([7, 7]);
  });

  it("returns [] for empty input", () => {
    expect(weeklyBuckets([], 13)).toEqual([]);
  });

  it("caps to maxWeeks, keeping the most recent weeks", () => {
    const daily = Array.from({ length: 21 }, (_, i) => ({
      day: `d${i}`,
      downloads: i < 7 ? 1 : i < 14 ? 2 : 3,
    }));
    // 3 weeks of [7,14,21]; capped to last 2 -> [14, 21]
    expect(weeklyBuckets(daily, 2)).toEqual([14, 21]);
  });
});

describe("momentumStatus", () => {
  it("up when change clears both 5% and Poisson floor", () =>
    expect(momentumStatus(140, 100)).toBe("up"));
  it("dn when drop clears both 5% and Poisson floor", () =>
    expect(momentumStatus(60, 100)).toBe("dn"));
  it("flat when within the 5% band", () =>
    expect(momentumStatus(102, 100)).toBe("flat"));
  it("flat when change exceeds 5% but is below sqrt(prev) noise floor", () =>
    // 110 vs 100: +10% > 5%, but |diff|=10 == sqrt(100); still "flat" because
    // honest threshold uses Math.max(5%, sqrt(prev)) = 10, and we require strictly
    // exceeding noise.
    expect(momentumStatus(110, 100)).toBe("flat"));
  it("flat for low-volume packages regardless of relative swing", () =>
    expect(momentumStatus(2, 1)).toBe("flat"));
  it("flat from zero prev", () =>
    expect(momentumStatus(5, 0)).toBe("flat"));
  it("flat when both zero", () =>
    expect(momentumStatus(0, 0)).toBe("flat"));
});

describe("starDailyFromTimestamps", () => {
  it("buckets starred_at into cumulative daily totals with deltas", () => {
    const ts = [
      "2026-01-01T10:00:00Z",
      "2026-01-01T20:00:00Z",
      "2026-01-03T00:00:00Z",
    ];
    expect(starDailyFromTimestamps(ts)).toEqual([
      { day: "2026-01-01", stars_total: 2, stars_delta: 2 },
      { day: "2026-01-03", stars_total: 3, stars_delta: 1 },
    ]);
  });

  it("returns [] for no timestamps", () => {
    expect(starDailyFromTimestamps([])).toEqual([]);
  });

  it("sorts unordered timestamps before accumulating", () => {
    const ts = ["2026-02-02T00:00:00Z", "2026-02-01T00:00:00Z"];
    expect(starDailyFromTimestamps(ts)).toEqual([
      { day: "2026-02-01", stars_total: 1, stars_delta: 1 },
      { day: "2026-02-02", stars_total: 2, stars_delta: 1 },
    ]);
  });
});

describe("weeklyStarDelta", () => {
  // Fixed clock: 2026-01-15T00:00:00Z -> cutoff day = 2026-01-08 (exclusive).
  const NOW = Date.UTC(2026, 0, 15);
  const d = (day: string, stars_delta: number) => ({ day, stars_delta });

  it("sums stars_delta over the trailing 7 days, cutoff exclusive", () => {
    const history = [
      d("2026-01-01", 10), // older than the window -> excluded
      d("2026-01-08", 7), // == cutoff day -> excluded (window is half-open)
      d("2026-01-09", 2), // in window
      d("2026-01-14", 3), // in window
      d("2026-01-15", 1), // today, in window
    ];
    expect(weeklyStarDelta(history, NOW)).toBe(6);
  });

  it("returns 0 for empty history", () => {
    expect(weeklyStarDelta([], NOW)).toBe(0);
  });

  it("returns 0 when every observation predates the window", () => {
    const history = [d("2025-12-01", 5), d("2026-01-07", 9)];
    expect(weeklyStarDelta(history, NOW)).toBe(0);
  });

  it("nets out unstars (negative deltas) within the window", () => {
    const history = [d("2026-01-10", 4), d("2026-01-12", -1)];
    expect(weeklyStarDelta(history, NOW)).toBe(3);
  });
});

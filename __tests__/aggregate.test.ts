import { describe, it, expect } from "vitest";
import {
  weeklyBuckets,
  momentumStatus,
  starDailyFromTimestamps,
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
  it("up when last exceeds prev by >5%", () =>
    expect(momentumStatus(110, 100)).toBe("up"));
  it("dn when last below prev by >5%", () =>
    expect(momentumStatus(90, 100)).toBe("dn"));
  it("flat within +-5%", () =>
    expect(momentumStatus(102, 100)).toBe("flat"));
  it("up from zero prev with positive last", () =>
    expect(momentumStatus(5, 0)).toBe("up"));
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

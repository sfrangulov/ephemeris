import { describe, it, expect } from "vitest";
import { weeklyBuckets, momentumStatus } from "@/lib/aggregate";

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

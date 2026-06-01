import { describe, it, expect } from "vitest";
import {
  daysSince,
  latestWeekVersions,
  toPackageStats,
  type VersionRow,
} from "@/lib/insight";
import type { PortfolioPackage } from "@/lib/portfolio";

const NOW = Date.parse("2026-06-01T00:00:00Z");

const pkg = (over: Partial<PortfolioPackage>): PortfolioPackage => ({
  id: 1,
  name: "p",
  latestVersion: "1.0.0",
  lastPublishedAt: null,
  weeks: [],
  status: "flat",
  lastWeekDownloads: 0,
  deltaDownloads: 0,
  starsTotal: 0,
  deltaStars: 0,
  starsSeries: [],
  ...over,
});

describe("daysSince", () => {
  it("counts whole days since an iso timestamp", () => {
    expect(daysSince("2026-05-22T00:00:00Z", NOW)).toBe(10);
  });
  it("returns null for missing or unparseable input", () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince("not-a-date", NOW)).toBeNull();
  });
});

describe("latestWeekVersions", () => {
  it("keeps only the newest week_ending per package", () => {
    const rows: VersionRow[] = [
      { package_id: 1, week_ending: "2026-05-25", version: "1.0.0", downloads: 5 },
      { package_id: 1, week_ending: "2026-06-01", version: "2.0.0", downloads: 90 },
      { package_id: 1, week_ending: "2026-06-01", version: "1.0.0", downloads: 10 },
      { package_id: 2, week_ending: "2026-06-01", version: "3.0.0", downloads: 7 },
    ];
    const out = latestWeekVersions(rows);
    expect(out.get(1)).toEqual([
      { version: "2.0.0", downloads: 90 },
      { version: "1.0.0", downloads: 10 },
    ]);
    expect(out.get(2)).toEqual([{ version: "3.0.0", downloads: 7 }]);
  });

  it("is empty for no rows", () => {
    expect(latestWeekVersions([]).size).toBe(0);
  });
});

describe("toPackageStats", () => {
  it("maps weeks -> downloads/prev, publish age, and version data by id", () => {
    const packages = [
      pkg({
        id: 7,
        name: "docx-to-md",
        weeks: [5000, 6000, 7000],
        lastPublishedAt: "2026-05-27T00:00:00Z",
      }),
      pkg({ id: 8, name: "old-thing", weeks: [1], lastPublishedAt: null }),
    ];
    const versions = new Map([
      [7, [{ version: "5.0.0", downloads: 6800 }]],
    ]);
    const stats = toPackageStats(packages, versions, NOW);
    expect(stats[0]).toEqual({
      name: "docx-to-md",
      downloads: 7000,
      prevDownloads: 6000,
      lastPublishDays: 5,
      versions: [{ version: "5.0.0", downloads: 6800 }],
    });
    expect(stats[1]).toEqual({
      name: "old-thing",
      downloads: 1,
      prevDownloads: 0,
      lastPublishDays: null,
      versions: undefined,
    });
  });

  it("defaults to no version data when the map is omitted", () => {
    const stats = toPackageStats([pkg({ weeks: [10, 20] })]);
    expect(stats[0].downloads).toBe(20);
    expect(stats[0].prevDownloads).toBe(10);
    expect(stats[0].versions).toBeUndefined();
  });
});

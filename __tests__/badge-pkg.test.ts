import { describe, it, expect } from "vitest";
import { renderMomentum, type BadgePackage } from "../lib/badge-pkg";

const base: BadgePackage = {
  name: "skill-graveyard",
  weeks: [100, 120, 140, 150, 160, 180, 200, 220, 240, 280, 300, 340],
  lastWeekDownloads: 340,
  deltaDownloads: 40,
  status: "up",
  starsTotal: 124,
  deltaStars: 5,
  freshness: "2h ago",
};

describe("renderMomentum", () => {
  it("up: green segment, ↑ arrow, compacted value", () => {
    const svg = renderMomentum(base);
    expect(svg).toContain("↑");
    expect(svg).toContain("#34a866");
    expect(svg).toContain("340");
    expect(svg).toContain("/wk");
    expect(svg).toMatch(/<svg[^>]*width="\d+"/);
  });

  it("dn: red segment, ↓ arrow", () => {
    const svg = renderMomentum({ ...base, status: "dn", deltaDownloads: -40 });
    expect(svg).toContain("↓");
    expect(svg).toContain("#df6256");
  });

  it("flat: dark segment, · glyph, no status hue on the segment", () => {
    const svg = renderMomentum({ ...base, status: "flat", deltaDownloads: 5 });
    expect(svg).toContain("·");
    // Brand dot is always green (logo, not status); status hue lives on the right segment.
    expect(svg).not.toMatch(/<rect[^>]*fill="#34a866"/);
    expect(svg).not.toMatch(/<rect[^>]*fill="#df6256"/);
  });

  it("brand dot logo present (green circle, left segment)", () => {
    const svg = renderMomentum(base);
    expect(svg).toMatch(/<circle [^>]*cx="12"[^>]*fill="#34a866"/);
  });
});

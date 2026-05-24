import { describe, it, expect } from "vitest";
import { renderMomentum, renderSparkline, renderStars, type BadgePackage } from "../lib/badge-pkg";

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

describe("renderSparkline", () => {
  it("12-week polyline, dark panel, green stroke", () => {
    const svg = renderSparkline(base);
    expect(svg).toContain("<polyline");
    expect(svg).toContain('stroke="#34a866"');
    const points = svg.match(/points="([^"]+)"/)?.[1] ?? "";
    expect(points.split(/\s+/).filter(Boolean).length).toBe(12);
  });

  it("empty weeks: no polyline, no crash", () => {
    const svg = renderSparkline({ ...base, weeks: [] });
    expect(svg).not.toContain("<polyline");
    expect(svg).toMatch(/<svg/);
  });

  it("all-equal values: flat line, no NaN", () => {
    const svg = renderSparkline({ ...base, weeks: new Array(12).fill(100) });
    expect(svg).toContain("<polyline");
    expect(svg).not.toContain("NaN");
  });

  it("brand dot logo present", () => {
    const svg = renderSparkline(base);
    expect(svg).toMatch(/<circle [^>]*cx="12"[^>]*fill="#34a866"/);
  });
});

describe("renderStars", () => {
  it("with delta: ★ total + signed weekly delta", () => {
    const svg = renderStars(base);
    expect(svg).toContain("★");
    expect(svg).toContain("124");
    expect(svg).toContain("+5/w");
  });

  it("zero delta: no /w tail in the rendered text", () => {
    const svg = renderStars({ ...base, deltaStars: 0 });
    expect(svg).toContain("★");
    expect(svg).toContain("124");
    const textContent = svg.match(/<text[^>]*>([^<]*)<\/text>/)?.[1] ?? "";
    expect(textContent).not.toContain("/w");
  });

  it("zero stars: renders ★ 0", () => {
    const svg = renderStars({ ...base, starsTotal: 0, deltaStars: 0 });
    expect(svg).toContain("★");
    expect(svg).toContain("0");
  });

  it("brand dot logo present", () => {
    const svg = renderStars(base);
    expect(svg).toMatch(/<circle [^>]*cx="12"[^>]*fill="#34a866"/);
  });
});

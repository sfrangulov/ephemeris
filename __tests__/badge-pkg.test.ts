import { describe, it, expect } from "vitest";
import {
  renderMomentum,
  renderSparkline,
  renderStars,
  renderCard,
  type BadgePackage,
} from "../lib/badge-pkg";

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
  it("up: ↑ arrow with .up class, value in .fg, /wk in .muted", () => {
    const svg = renderMomentum(base);
    expect(svg).toContain(">↑<");
    expect(svg).toMatch(/<text[^>]*class="up"[^>]*>↑</);
    expect(svg).toMatch(/<text[^>]*class="fg"[^>]*>340</);
    expect(svg).toMatch(/<text[^>]*class="muted"[^>]*>\/wk</);
    expect(svg).toMatch(/<svg[^>]*width="\d+"/);
  });

  it("dn: ↓ arrow with .dn class", () => {
    const svg = renderMomentum({ ...base, status: "dn", deltaDownloads: -40 });
    expect(svg).toMatch(/<text[^>]*class="dn"[^>]*>↓</);
    expect(svg).not.toMatch(/<text[^>]*class="up"[^>]*>↓</);
  });

  it("flat: · glyph with .muted class, no status hue on the arrow", () => {
    const svg = renderMomentum({ ...base, status: "flat", deltaDownloads: 5 });
    expect(svg).toContain(">·<");
    expect(svg).toMatch(/<text[^>]*class="muted"[^>]*>·</);
    expect(svg).not.toMatch(/<text[^>]*class="up"[^>]*>·</);
    expect(svg).not.toMatch(/<text[^>]*class="dn"[^>]*>·</);
  });

  it("brand dot at cx=10, always inline #34a866 (brand mark — both themes)", () => {
    const svg = renderMomentum(base);
    expect(svg).toMatch(/<circle [^>]*cx="10"[^>]*fill="#34a866"/);
  });

  it("square strip: no border-radius on the surface rect", () => {
    const svg = renderMomentum(base);
    expect(svg).not.toMatch(/<rect[^>]*class="bg"[^>]*rx=/);
  });
});

describe("renderSparkline", () => {
  it("12-point polyline using .line class", () => {
    const svg = renderSparkline(base);
    expect(svg).toContain("<polyline");
    expect(svg).toMatch(/<polyline[^>]*class="line"/);
    const points = svg.match(/points="([^"]+)"/)?.[1] ?? "";
    expect(points.split(/\s+/).filter(Boolean).length).toBe(12);
  });

  it("baseline guide line beneath the polyline", () => {
    const svg = renderSparkline(base);
    expect(svg).toMatch(/<line[^>]*class="baseline"/);
  });

  it("end-dot at the last polyline point (in addition to brand dot)", () => {
    const svg = renderSparkline(base);
    const dots = svg.match(/<circle[^>]+\/>/g) ?? [];
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });

  it("empty weeks: no polyline, no end-dot, baseline still drawn, no crash", () => {
    const svg = renderSparkline({ ...base, weeks: [] });
    expect(svg).not.toContain("<polyline");
    expect(svg).toMatch(/<line[^>]*class="baseline"/);
    expect(svg).toMatch(/<svg/);
  });

  it("all-equal values: flat line at vertical center, no NaN", () => {
    const svg = renderSparkline({ ...base, weeks: new Array(12).fill(100) });
    expect(svg).toContain("<polyline");
    expect(svg).not.toContain("NaN");
  });

  it("brand dot at cx=10", () => {
    const svg = renderSparkline(base);
    expect(svg).toMatch(/<circle [^>]*cx="10"[^>]*fill="#34a866"/);
  });
});

describe("renderStars", () => {
  it("with delta: ★, total in .fg, signed delta in status class, /wk in .muted", () => {
    const svg = renderStars(base);
    expect(svg).toContain(">★<");
    expect(svg).toMatch(/<text[^>]*class="fg"[^>]*>124</);
    expect(svg).toMatch(/<text[^>]*class="up"[^>]*>\+5</);
    expect(svg).toMatch(/<text[^>]*class="muted"[^>]*>\/wk</);
  });

  it("negative delta: .dn class and U+2212 minus", () => {
    const svg = renderStars({ ...base, deltaStars: -3 });
    expect(svg).toMatch(/<text[^>]*class="dn"[^>]*>−3</);
  });

  it("zero delta: no delta text, no /wk", () => {
    const svg = renderStars({ ...base, deltaStars: 0 });
    expect(svg).toContain("124");
    expect(svg).not.toMatch(/<text[^>]*class="(up|dn)"/);
    expect(svg).not.toContain("/wk");
  });

  it("zero stars: renders ★ 0", () => {
    const svg = renderStars({ ...base, starsTotal: 0, deltaStars: 0 });
    expect(svg).toContain(">★<");
    expect(svg).toMatch(/<text[^>]*class="fg"[^>]*>0</);
  });

  it("brand dot at cx=10", () => {
    const svg = renderStars(base);
    expect(svg).toMatch(/<circle [^>]*cx="10"[^>]*fill="#34a866"/);
  });
});

describe("renderCard", () => {
  it("440x120, name, freshness, polyline, dl/wk + stars rows", () => {
    const svg = renderCard(base);
    expect(svg).toMatch(/<svg[^>]*width="440"/);
    expect(svg).toMatch(/<svg[^>]*height="120"/);
    expect(svg).toContain("skill-graveyard");
    expect(svg).toContain("2h ago");
    expect(svg).toContain("dl/wk");
    expect(svg).toContain("340");
    expect(svg).toContain("stars");
    expect(svg).toContain(">★<");
    expect(svg).toContain("124");
    expect(svg).toContain("<polyline");
  });

  it("up status: ↑ arrow and signed dl delta both carry .up class", () => {
    const svg = renderCard(base);
    expect(svg).toMatch(/<text[^>]*class="up"[^>]*>↑</);
    expect(svg).toMatch(/<text[^>]*class="up"[^>]*>\+40</);
  });

  it("dn status: ↓ arrow and signed dl delta both carry .dn class", () => {
    const svg = renderCard({ ...base, status: "dn", deltaDownloads: -40 });
    expect(svg).toMatch(/<text[^>]*class="dn"[^>]*>↓</);
    expect(svg).toMatch(/<text[^>]*class="dn"[^>]*>−40</);
  });

  it("pre-sync (empty weeks): no polyline, no end-dot, frame still renders", () => {
    const svg = renderCard({
      ...base,
      weeks: [],
      lastWeekDownloads: 0,
      deltaDownloads: 0,
      status: "flat",
    });
    expect(svg).not.toContain("<polyline");
    expect(svg).toContain("skill-graveyard");
  });

  it("no freshness: header omits the freshness slot text", () => {
    const svg = renderCard({ ...base, freshness: null });
    expect(svg).not.toContain("2h ago");
    expect(svg).toContain("skill-graveyard");
  });

  it("zero star delta: em-dash placeholder, not signed delta with .up", () => {
    const svg = renderCard({ ...base, deltaStars: 0 });
    expect(svg).toContain("—");
    expect(svg).not.toMatch(/<text[^>]*class="up"[^>]*>\+\d+\/w</);
  });
});

import { describe, it, expect } from "vitest";
import { buildBadgeUrl, buildBadgeMarkdown } from "../lib/badge-markdown";

const ORIGIN = "https://ephemeris.tools";

describe("buildBadgeUrl", () => {
  it("omits the theme query for the dark default", () => {
    expect(buildBadgeUrl(ORIGIN, "sfrangulov", "skill-graveyard", "card", "dark")).toBe(
      "https://ephemeris.tools/badge/sfrangulov/skill-graveyard/card.svg",
    );
  });

  it("appends ?theme=light", () => {
    expect(buildBadgeUrl(ORIGIN, "sfrangulov", "skill-graveyard", "momentum", "light")).toBe(
      "https://ephemeris.tools/badge/sfrangulov/skill-graveyard/momentum.svg?theme=light",
    );
  });

  it("appends ?theme=auto", () => {
    expect(buildBadgeUrl(ORIGIN, "sfrangulov", "skill-graveyard", "sparkline", "auto")).toBe(
      "https://ephemeris.tools/badge/sfrangulov/skill-graveyard/sparkline.svg?theme=auto",
    );
  });

  it("preserves scoped package names", () => {
    expect(buildBadgeUrl(ORIGIN, "sfrangulov", "@scope/pkg", "stars", "dark")).toBe(
      "https://ephemeris.tools/badge/sfrangulov/@scope/pkg/stars.svg",
    );
  });
});

describe("buildBadgeMarkdown", () => {
  it("wraps the SVG URL in an npm link", () => {
    expect(
      buildBadgeMarkdown(ORIGIN, "sfrangulov", "skill-graveyard", "card", "dark"),
    ).toBe(
      "[![skill-graveyard](https://ephemeris.tools/badge/sfrangulov/skill-graveyard/card.svg)](https://www.npmjs.com/package/skill-graveyard)",
    );
  });
});
